-- Enable the pgvector extension
create extension if not exists vector;

-- Create a table to store PDF chunks and their embeddings
create table if not exists documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(768)
);

-- Create a function to search for documents (RAG)
create or replace function match_documents (
  query_embedding vector(768),
  match_count int default 5
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create chat_logs table to store student conversations
create table if not exists chat_logs (
  id uuid default gen_random_uuid() primary key,
  student_id text not null,
  student_name text not null,
  role text not null, -- 'user' or 'model'
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) if needed, but for simplicity in this project we allow all for anon (or service role)
-- We will use the service_role key to bypass RLS in the server for admin tasks, 
-- and anon key for inserting chat logs from client.
alter table chat_logs enable row level security;
alter table documents enable row level security;

-- Create policies for chat_logs (allow insert and select for anon)
create policy "Allow public insert to chat_logs" on chat_logs for insert with check (true);
create policy "Allow public select to chat_logs" on chat_logs for select using (true);

-- Create policies for documents (allow select for anon, insert only via service_role)
create policy "Allow public select to documents" on documents for select using (true);
