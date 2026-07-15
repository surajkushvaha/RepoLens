# RepoLens

Explore any GitHub codebase as a living, interactive map instead of a static
folder tree. Paste a repo, fly through its architecture, and ask questions in
plain language — understand a project in minutes, not days.

> Status: **Day 1 scaffold.** App shell, provider-agnostic AI layer, and stub
> API routes are in place. Repo ingestion, the dependency graph, and RAG land
> in the following slices. See [`deep-research-report.md`](./deep-research-report.md)
> for the full plan.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind v4** + **shadcn/ui**
- **Vercel AI SDK** — provider-agnostic (`anthropic` by default, `openai` swappable via env)
- **bun** for install/scripts
- Deferred until needed: Neon + Drizzle (DB), Upstash Vector/Redis (RAG + cache), BetterAuth

## Getting started

```bash
bun install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
bun dev
```

Open http://localhost:3000.

## Layout

```
src/
  app/
    page.tsx            # landing hero + repo URL input
    api/
      analyze/route.ts  # POST repoUrl  -> ingest + graph  (stub)
      search/route.ts   # POST query    -> RAG search       (stub)
      ask/route.ts      # POST question -> Q&A              (stub)
  lib/ai/
    model.ts            # provider/model selection via env
    orchestrator.ts     # central AI entry point
  components/ui/        # shadcn components
```

## License

MIT — see [LICENSE](./LICENSE).
