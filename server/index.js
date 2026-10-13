const express = require("express");
const dotenv = require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");
const { QdrantClient } = require("@qdrant/js-client-rest");

const app = express();
app.use(cors());

const uploads = multer({ dest: "uploads/" });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function createEmbedding(text) {
  const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
    });
    return response.embeddings[0].values;
}

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

function cosineSimilarity(vecA,vecB) {
  let dotProduct = 0;
  for(let i=0;i<vecA.length;i++){
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

app.get("/", (req, res) => {
  res.send("Hello World");
});


//create collection
app.get('/create-collection',async (req, res) => {
  try {
    await qdrant.createCollection('pdf-docs',{
      vectors: {
        size: 3072,
        distance: 'Cosine'
      }
    })
    res.status(200).json({ message: 'Collection created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.post("/upload", uploads.single("pdf"), async (req, res) => {
  console.log(req.file);
  try {
    // read the uploaded PDF file and extract text from it
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    // devide the text into chunks of 500 characters
    const chunks = text.split("\n\n").filter((chunk) => chunk.trim() !== "");

    //create embedding of every chunk
    // const embeddings = await createEmbedding(chunks[0])
    const chunkEmbedding = [];
    for(const chunk of chunks){
      const embedding = await createEmbedding(chunk)
      chunkEmbedding.push({
        text:chunk,
        embedding
      })
    }

    const points = chunkEmbedding.map((item,index)=>({
      id:index + 1,
      vector:item.embedding,
      payload:{
        text:item.text
      }
    }))

    await qdrant.upsert("pdf-docs",{
      points
    })

    const question = req.body.question;
    const questionEmbedding = await createEmbedding(question);
    // const matchedChunk = chunks.find((chunk) => chunk.toLowerCase().includes(question));
    // let bestChunk = null;
    // let bestScore = -Infinity;
    // for (const items of chunkEmbedding) {
    //   const score = cosineSimilarity(questionEmbedding, items.embedding);
    //   if(score > bestScore){
    //     bestChunk = items.text;
    //     bestScore =  score
    //   }
    // }

    // console.log(bestScore)

    const searchResult = await qdrant.query('pdf-docs',{
      vector:questionEmbedding,
      limit:1,
      with_payload: true
    })
    const bestChunk = searchResult.points[0].payload.text;
    

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `answer the question based on the following text: ${bestChunk} and question: ${question} `,
    });

    res.send(response.text);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("server is running on port 3000");
});
