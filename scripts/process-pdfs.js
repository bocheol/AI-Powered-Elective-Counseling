const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
  console.error("Missing required environment variables. Please check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const PDF_DIR = path.resolve(process.cwd(), '..'); // The parent folder where PDFs are located

async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Simple chunking function (split by double newline, or arbitrary length)
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let index = 0;
  while (index < text.length) {
    chunks.push(text.slice(index, index + chunkSize));
    index += chunkSize - overlap;
  }
  return chunks;
}

async function processPdf(filePath) {
  const fileName = path.basename(filePath);
  console.log(`Processing ${fileName}...`);
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  const text = data.text;

  // Chunk the text
  const chunks = chunkText(text);
  console.log(`- Extracted ${chunks.length} chunks from ${fileName}`);

  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunk = chunks[i];
      const embedding = await getEmbedding(chunk);

      const { error } = await supabase.from('documents').insert({
        content: chunk,
        metadata: { source: fileName, chunkIndex: i },
        embedding: embedding
      });

      if (error) throw error;
    } catch (e) {
      console.error(`Error processing chunk ${i} of ${fileName}:`, e.message);
    }
  }
  console.log(`- Finished processing ${fileName}`);
}

async function main() {
  const files = fs.readdirSync(PDF_DIR);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

  console.log(`Found ${pdfFiles.length} PDF files.`);

  // Clear existing documents
  console.log("Clearing existing documents from Supabase...");
  await supabase.from('documents').delete().neq('id', 0); // Delete all

  for (const file of pdfFiles) {
    const fullPath = path.join(PDF_DIR, file);
    await processPdf(fullPath);
  }

  console.log("All PDFs processed and uploaded to Supabase!");
}

main().catch(console.error);
