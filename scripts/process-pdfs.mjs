import fs from 'fs';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
const pdfExtract = new PDFExtract();

const PDF_DIR = path.resolve(process.cwd(), '..', '참조 자료'); // The parent folder where PDFs are located

async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  // Supabase에 설정된 768차원에 맞게 배열을 자릅니다.
  return result.embedding.values.slice(0, 768);
}

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
  
  const data = await pdfExtract.extract(filePath, {});
  const text = data.pages.map(page => page.content.map(item => item.str).join(' ')).join('\n');

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

  console.log("Clearing existing documents from Supabase...");
  await supabase.from('documents').delete().neq('id', 0);

  for (const file of pdfFiles) {
    const fullPath = path.join(PDF_DIR, file);
    await processPdf(fullPath);
  }

  console.log("All PDFs processed and uploaded to Supabase!");
}

main().catch(console.error);
