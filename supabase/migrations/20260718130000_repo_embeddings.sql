-- Shared server-side RAG. The first user to open a repo builds embeddings in
-- their browser (Transformers.js) and uploads them here, keyed by repo + commit.
-- Everyone else reuses them; we only re-embed when the repo's commit changes.
-- Like the other tables: RLS on with no policies, so only the server-side
-- service_role key (from Clerk-authenticated routes) can read/write.

create extension if not exists vector;

-- One row per chunk. embedding is the 384-dim MiniLM vector (Xenova/all-MiniLM-L6-v2).
create table if not exists public.repo_embeddings (
  id uuid primary key default gen_random_uuid(),
  repo_key text not null,                    -- "owner/repo" lowercased
  commit_sha text not null,                  -- commit token the vectors were built from
  path text not null,
  start_line int not null default 0,
  end_line int not null default 0,
  content text not null,                     -- the chunk text (returned as RAG context)
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);
alter table public.repo_embeddings enable row level security;
create index if not exists repo_embeddings_key on public.repo_embeddings (repo_key);
create index if not exists repo_embeddings_vec
  on public.repo_embeddings using hnsw (embedding vector_cosine_ops);

-- Quick "is this repo already indexed at this commit?" lookup.
create table if not exists public.repo_index_meta (
  repo_key text primary key,
  commit_sha text not null,
  chunks int not null default 0,
  model text,
  updated_at timestamptz not null default now()
);
alter table public.repo_index_meta enable row level security;

-- Cosine-similarity search over one repo's chunks. Called via RPC from the
-- server (service_role), which bypasses RLS.
create or replace function public.match_repo_chunks(
  p_repo_key text,
  p_query vector(384),
  p_match_count int default 12
)
returns table (path text, start_line int, end_line int, content text, score float)
language sql stable as $$
  select path, start_line, end_line, content,
         1 - (embedding <=> p_query) as score
  from public.repo_embeddings
  where repo_key = p_repo_key
  order by embedding <=> p_query
  limit p_match_count;
$$;
