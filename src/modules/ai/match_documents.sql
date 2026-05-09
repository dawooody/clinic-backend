create or replace function match_documents(
  query_embedding vector(768),
  match_count int default 5
)
returns table (
  disease text,
  specialty text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    documents.disease,
    documents.specialty,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.embedding is not null
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
