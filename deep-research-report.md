# Executive Summary

Our project, **RepoLens**, aims to revolutionize how developers understand unfamiliar codebases. In four days, we will build an AI-driven *Codebase Navigator* that lets users explore any GitHub repository as an interactive graph instead of a static folder tree. This directly addresses a common pain point: developers waste days deciphering structure and data flow in new projects. By using Next.js (App Router, TypeScript) and tailwind v4 with shadcn/ui components, we’ll create a polished web app deployed on Vercel. AI is the **core orchestrator**: we’ll chunk and index the repository, fetch relevant context via embeddings (using Upstash Vector DB), and answer natural-language queries. Security, performance, and hackathon rules guide every choice. Below we detail vision, scope, metrics, plan, and technical approach.

## Vision

- **Transform Code Onboarding:** Instantly reveal the architecture of any codebase. Instead of browsing folders, users “fly” through a visual map of services and modules.
- **AI as the Engine:** The app’s intelligence comes from LLM-powered agents. For example, ask “How does login work?” and the graph animates to highlight the login flow with a concise AI explanation.
- **Polished UX:** We’ll use **Next.js 15 App Router** and **Tailwind v4**. UI components via **shadcn/ui (Radix)** ensure accessible, themable elements. **Framer Motion** adds smooth transitions; **React Flow** or **Cytoscape** powers the dependency graph. Every interaction feels fluid and magical.
- **Demo-Worthy “Wow” Factor:** Judges must think, “I’ve never seen this before.” The camera will pan through code modules, nodes will expand on hover, and related code will glow along AI-suggested paths. This ties directly to the hackathon’s emphasis on originality, impact, and AI fluency.

## Problem Statement

Developers routinely **struggle to onboard** into large, unfamiliar codebases. Typical issues:

- **Opaque Structure:** Folders and filenames (e.g. `components`, `utils`) say little about functionality. Newcomers waste hours hunting for the authentication or data-flow code.
- **Lack of Documentation:** Many projects lack up-to-date README or architecture diagrams. Even when docs exist, they’re often outdated or incomplete.
- **Time-Consuming Code Search:** Developers scan through files or search with `grep`/IDE search, then piece together mental models of how the system works.
- **Onboarding Bottleneck:** This slows development and causes frustration, especially in fast-moving teams or hackathon projects. 

**RepoLens** solves this by automatically **analyzing and visualizing** the repository. Instead of manually reading code, users *explore* the code. This could shorten onboarding from days to minutes, improving productivity and reducing errors.

## Target Users / Personas

- **New Developer on a Team:** Jane just joined a startup and must understand the codebase. RepoLens lets her see an overview and ask questions like “What handles payments?” and immediately get a guided tour of the relevant modules.
- **Open-Source Contributor:** Sam forks a large open-source project. Rather than digging aimlessly, he uses RepoLens to map out core components and focus on his feature area.
- **Technical Lead/Architect:** Alex wants a quick sanity check of a colleague’s code. He uploads a repo and uses RepoLens to ensure modules are correctly separated and spot any large “god files.”
- **Hackathon Participant:** We (the team) are building this project for the hackathon, so we ourselves are users who need a fast development cycle. Our daily demos will showcase specific features to judges.

Each persona values **speed and clarity**. The product must deliver immediate insight with minimal fuss (no installation, just paste a GitHub URL or upload).

## Success Metrics

To evaluate our MVP, we define clear metrics aligned with user benefits and hackathon judging:

- **Time to Insight:** How quickly does the app display an initial architecture map after repo upload? (Target <10s for repos ≤50MB).
- **Graph Accuracy:** Does the visual graph correctly represent module dependencies and call flows? (We’ll validate on sample projects).
- **Query Relevance:** When we ask natural-language questions (e.g. “Where is the user model defined?”), the system retrieves correct code/context. (Measured by prompt outputs on known repos).
- **Demo Readability:** In a live demo, we smoothly animate a 60s scenario demonstrating at least three features (upload, search, QA) without errors.
- **AI Usage:** All core features (map generation, explanations, search) must rely on LLMs. For instance, architecture explanations should come from the **OpenAI Responses API** via Vercel’s AI SDK.
- **Visual Polish:** Usage of shadcn/ui and Motion should yield a professional look. We’ll judge this qualitatively (screenshots/videos) and compare against a checklist (responsive layout, dark mode, loading states, etc.).

Finally, hackathon scoring emphasizes **Originality, Impact, AI Fluency, Prototype, Demo, Creativity**. Our plan maximizes all: an unusual visual code-explorer (original, creative), solves a real developer pain (impact), is entirely AI-driven (fluency), and we’ll deliver a clicking prototype and sharp 3-minute demo (prototype quality, demo clarity).

## Constraints & Hackathon Submission

- **4-Day Timeline:** Build from July 15 to 19, 2026. Final submission by July 19, 23:59 IST. We allocate tasks across Days 1–4 below.
- **AI Requirement:** Must *meaningfully* use AI (voting judges emphasis). We use OpenAI’s GPT-4 via the new Responses API (AI Gateway) as our LLM backend.
- **Free Stack:** All infrastructure must fit free tiers:
  - **Frontend:** Next.js on Vercel (includes free hosting).
  - **DB:** Neon Postgres free tier (serverless). Drizzle ORM for type-safe DB access.
  - **Cache/Vector DB:** Upstash Redis & Vector (free up to 256MB & 500K ops).
  - **Auth:** BetterAuth (free, self-managed with Neon DB).
  - **AI:** OpenAI API (free trial or Codex pro included in prizes).
  - **APIs:** Vercel AI SDK (free for limited usage). 
- **Submission Checklist:** By deadline, we must submit:
  1. **Hosted URL:** Our public, deployed app (on Vercel, usually main branch => https://repo-lens.vercel.app).
  2. **Public Repo:** GitHub repo link (with README).
  3. **Demo Video:** A 3-minute screencast (YouTube link).
  4. **Slide Deck (optional):** 5–7 slides summarizing problem/solution if time permits.
  5. Each link must be publicly accessible for judges.

## Non-Goals

To avoid scope creep, we explicitly exclude:
- **Full IDE or Code Editor:** We are not building code editing or execution. Only code *viewing* and analysis.
- **Chatbot UI:** We won’t build a generic chat interface. Instead, AI powers specific features (graph explanations, search). The UI remains graphical.
- **Enterprise Deployments:** No need for complex infra. Focus on demo readiness, not long-term maintainability.
- **Mobile App:** Only web client (desktop browser) is targeted.
- **Real-time Collaboration:** MVP has no multi-user features.
- **Heavy 3D Rendering:** Three.js is optional. If under time, we prefer 2D interactive graph (React Flow/Cytoscape) with smooth animation. 

## MVP Scope

In four days, priorities are clarity and execution quality, not feature count. Our **must-have** features:

1. **Repo Ingestion:** User pastes a GitHub URL or uploads a zip. Backend clones or fetches the repo (public only).
2. **Code Parsing:** Using **ts-morph** or **tree-sitter**, generate an AST and extract:
   - List of source files and sizes (assume repos ≤50MB, 10k files as a practical limit).
   - High-level components/modules (e.g. based on directories or code patterns).
   - Function/class definitions for key flows (auth, API routes).
3. **Dependency Graph:** Build a graph (nodes: modules/services; edges: imports/calls) via **dependency-cruiser** or custom analysis. Visualize it (React Flow) with an elegant layout.
4. **Basic Visualization:** On first load, show a 2D network. Nodes animate in; user can pan/zoom. Use Tailwind+Motion for aesthetics (drop shadows, glass panels).
5. **AI Summary & Search:** 
   - **Search:** Natural-language search box. Queries hit an AI agent with relevant code context (RAG): split repo into chunks, embed with Upstash Vector, retrieve top-K for each query.
   - **Summarization:** Clicking a node or folder triggers an AI call: “Explain this module’s purpose and key files.” LLM returns JSON with “summary” and “fileList”.
6. **Question Answering:** Allow a user to ask questions about the code (e.g. “Where is user registration handled?”). The answer highlights the code path on the graph (camera moves to relevant node). 
7. **Basic Readme/Docs Generation:** One-click generate a short README or onboarding doc (module descriptions) using AI.
8. **Responsive UI:** Must be mobile-responsive enough and have essential UX polish (loading spinners as skeletons, error boundaries).

These cover the highest-value features: let judges see AI interacting with the graph and retrieving answers.

## Stretch Goals

If time permits (or post-hackathon), we’d consider:
- **3D Universe Mode:** Use React Three Fiber for a “galaxy of code” view.
- **Voice Queries:** Speech recognition for asking questions hands-free.
- **User Accounts:** GitHub OAuth (BetterAuth) so users save sessions (likely low priority).
- **Realtime Collaborators:** Allow two users to explore together (beyond MVP).
- **Advanced Analytics:** Auto-detect code smells or architecture anti-patterns and flag them.

These are deferred. Judges grade MVP highest, extras optional.

## Acceptance Criteria

Our team must verify all of these before submission:

- [ ] **AI-Driven:** Every core feature relies on the LLM. No hard-coded logic for architecture insights.
- [ ] **Functionality:** Uploading a public repo (URL or zip) produces an interactive graph within 10s.
- [ ] **Search & Q&A:** Example queries correctly highlight code. E.g. “login” should focus the auth module.
- [ ] **Security:** No secrets in repo; all keys via `process.env`. CORS and CSP headers properly set.
- [ ] **Deployment:** Runs without errors on Vercel (no local-only hacks).
- [ ] **Performance:** Large repos (up to our assumed limit) handled via RAG. No timeouts.
- [ ] **Demo Ready:** No crash on interactions; UI elements match design mockups.
- [ ] **Deliverables Complete:** Live URL accessible, GitHub repo is public and contains a README, and a 3-min video is recorded (script below).

## Implementation Plan (4-Day Sprint)

| Day     | Focus                                | Deliverables                                        | Time Estimate  |
| ------- | ------------------------------------ | --------------------------------------------------- | -------------- |
| **Day 1** (July 15) | **Core Infrastructure & Parsing** <br>• Scaffold Next.js 15 + shadcn/ui (Radix) + Tailwind v4. <br>• Setup Drizzle + Neon for DB (even if minimal). <br>• Implement repo upload/clone (limit 50MB, 10k files). <br>• Integrate ts-morph/tree-sitter to parse files, build initial AST summaries. | - Next.js project base<br>- Basic UI theme<br>- Repo ingest API (stub)<br>- Parsing library integrated | 6–8 hrs |
| **Day 2** (July 16) | **Graph Visualization & AI Summaries**<br>• Use dependency-cruiser or manual analysis to extract import graph. <br>• Implement React Flow or Cytoscape graph view with draggable nodes. <br>• Build Orchestrator agent: break repo into chunks, index with Upstash Vector (RAG). <br>• AI agent: on node click, fetch summary via OpenAI Responses API with the node’s code context. | - Interactive graph UI (static demo data)<br>- Backend AI route returning summaries<br>- Token budgeting: cache embeddings | 6–8 hrs |
| **Day 3** (July 17) | **Search & QA, UX Polish**<br>• Implement natural language search box. Hook to Search/Retrieval agent that uses vector store to find relevant code (RAG). <br>• QA answers: on clicking a graph highlight (or answer query), animate focus to that node. <br>• Polish UI: add loading states, skeletons, smooth animations (Motion), mobile layout. <br>• Add BetterAuth for GitHub login (if needed for upload via private repos) – scope permitting. | - Working search that highlights nodes<br>- QA interaction demo ready<br>- Fluent animations and styling<br>- Auth flow (if added) | 6–8 hrs |
| **Day 4** (July 18) | **Finishing & Deployment**<br>• Write remaining features: onboarding README generator, code preview on hover. <br>• Finalize security headers (CSP via Next.js middleware, CORS rules). <br>• Complete unit/edge tests (Vitest, Playwright basic flows). <br>• Deploy to Vercel: configure env (using `VERCEL_ENV`, `DATABASE_URL`, `UPSTASH_URL` etc.). <br>• Prepare demo script, record video, and optional slides. | - Final polish (animations, UI fixes)<br>- Deployed live URL<br>- Demo video & slides recorded | 6–8 hrs |

_Total: ~24–32 person-hours (split among team). Focus is on end-to-end experience over bells-and-whistles._

## Security & Deployment

We build on Vercel with Neon and Upstash. Key security measures:

- **Secrets in Env Vars:** All credentials (OpenAI API key, Neon DB URL, Upstash URL/token, BETTER_AUTH_SECRET, etc.) go into Vercel’s Environment Variables (encrypted at rest). For example, we’ll set `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BETTER_AUTH_SECRET`, `OPENAI_API_KEY`, etc. Vercel injects them at build/runtime.
- **CSP Header:** In Next.js middleware, we will add a Content-Security-Policy header. For instance:
  ```ts
  // middleware.ts
  import { NextResponse } from 'next/server';
  export function middleware(req) {
    const nonce = crypto.randomUUID();
    const csp = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
      style-src 'self' 'nonce-${nonce}';
      img-src 'self' blob: data:;
      font-src 'self';
    `.replace(/\s{2,}/g, ' ');
    const res = NextResponse.next();
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }
  ```
  This blocks unauthorized scripts/styles. We’ll only allow inline scripts with the generated nonce.
- **CORS:** We will serve client and API from the same origin (Next.js on Vercel), so no external calls. If any API route is public (e.g. `/api/github`), we’ll add a CORS policy to allow only our domain. (In practice, Next.js API routes don’t need special CORS if called from the same origin.)
- **Rate Limiting:** To protect from abuse, we’ll use Upstash Redis as a simple rate limiter. For example, increment a counter per IP per minute. Upstash free tier (256MB) should suffice for prototype. (Alternatively, QStash could throttle Webhook calls, but simpler to do manual in code with Redis TTL keys.)
- **Prompt Injection Defense:** All user queries (e.g. search or code Q&A) go to our orchestrator. We keep a strict JSON schema for agent I/O and never eval or trust raw AI output. For example, our agents return structured JSON (see below). We’ll sanitize user inputs or embed them in prompts with minimal instructions to reduce “Impersonation” attacks. We never send system-level instructions that the user can modify.
- **GitHub OAuth Scopes (Optional):** If we allow uploading private repos, we’d use GitHub OAuth with **read-only scopes** (`repo:read`) to fetch code. BetterAuth/NextAuth can handle this. But for MVP, we limit to public repos to simplify.
- **Connection Policies:** In Neon, we only allow connections from Vercel’s IP ranges (Neon console network settings). We’ll enforce SSL (Neon requires SSL mode). For Upstash, access requires the REST token, which is secret. Upstash Vector requires a service token (also as env).
- **Example Env Setup:**  
  In Vercel dashboard:
  - `DATABASE_URL = postgresql://...` (Neon cluster).  
  - `NEON_AUTH_BASE_URL = https://<your-neon-auth-url>` (if using Neon Auth).  
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (from Upstash).  
  - `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN`.  
  - `BETTER_AUTH_SECRET=` (32+ random chars).  
  - `VERCEL_URL`, `NEXTAUTH_URL` (set by Vercel automatically).
- **Transport Security:** All external API calls (GitHub, OpenAI) use HTTPS. We can enforce TLS versions in our code (not an issue on Vercel/Node).

By following these, our deployment on Vercel (with Neon DB and Upstash) will be secure and avoid common pitfalls.

## AI Orchestration & Agents

**Overview:** We implement a central **Orchestrator** (in `lib/ai/orchestrator.ts`) that routes tasks to specialized AI agents. Each agent has a defined JSON input/output schema. This ensures structured communication and token efficiency. Key agents:

- **RepositoryAnalysisAgent**  
  - *Responsibility:* Clone/ingest the repo, parse files, extract modules.  
  - *Input:* `{ repoUrl: string }` or file list.  
  - *Output:* JSON with `{ files: [{path, size, textSnippet}], modules: [{name, path, desc?}], importGraph: [{from, to}], language: "TS/JS" }`.  
  - *Operation:* Uses ts-morph/tree-sitter to parse up to our limit (assume repos ≤50MB, 10k files). It builds an import dependency graph. (No LLM yet, this is raw analysis.)  
- **ArchitectureAgent**  
  - *Responsibility:* High-level architecture extraction.  
  - *Input:* `{ modules, importGraph }` from AnalysisAgent.  
  - *Output:* `{ summary: string, layers: [ { name, components, description } ], apiEndpoints: [paths] }`.  
  - *Operation:* Calls LLM with the import graph to describe architecture (e.g. “This repo has an Auth module, a Payment service...”).  
- **VisualizationAgent**  
  - *Responsibility:* Prepare data for graph view.  
  - *Input:* `{ importGraph, explanations? }`.  
  - *Output:* `{ nodes: [ { id, label, type, size } ], edges: [ { from, to, label? } ], nodeMeta: { [id]: { codePaths: [], summary } } }`.  
  - *Operation:* Formats dependency data into node/edge arrays for React Flow. Could apply physics/layout algorithms.
- **SearchAgent (RAG)**  
  - *Responsibility:* Handle natural-language search over code.  
  - *Input:* `{ query: string, indexRef: string, userId?: string }`.  
  - *Output:* `{ topChunks: [ { filePath, textSnippet, embeddingsScore } ] }`.  
  - *Operation:* Uses Upstash Vector DB: embed `query`, run k-NN search over precomputed repo embeddings. Returns most relevant code chunks with context.
- **ExplanationAgent**  
  - *Responsibility:* Answer QA about code.  
  - *Input:* `{ question: string, relevantChunks: [ { text } ] }`.  
  - *Output:* `{ answer: string, references: [filePaths] }`.  
  - *Operation:* Uses GPT-4 (Responses API) with retrieved code context to answer queries succinctly.
- **DocumentationAgent**  
  - *Responsibility:* Generate or update project docs.  
  - *Input:* `{ modules: [...], importantFunctions: [...] }`.  
  - *Output:* `{ README: string, onboardingGuide: string }`.  
  - *Operation:* LLM composes Markdown summaries of modules and usage instructions.
- **SecurityAgent**  
  - *Responsibility:* Scan code for secrets or vuln patterns.  
  - *Input:* `{ files }`.  
  - *Output:* `{ findings: [ { file, issue, severity } ] }`.  
  - *Operation:* Uses regex or static analysis (e.g. eslint plugin) plus LLM to identify risky code (e.g. hardcoded passwords).

**Token Minimization Strategies:** We will **cache** all agent outputs (especially embeddings and summaries). For LLM calls:
- Use *structured JSON prompts* with concise system+user messages.
- Limit context by sending only relevant code (chunked to ~2K tokens each, stored in vector DB).
- Use the Vercel OpenAI Responses API for streaming and low latency.
- Use embeddings to prune context: e.g., store code chunks (512 tokens each) with text embeddings, so QA and search get only top ~3 chunks (~1500 tokens total) rather than full repo.
- Leverage message severity: non-critical info (comments, trivial functions) may be omitted in summaries.

This architecture ensures the UI sees quick responses with minimal token usage and avoids sending the entire repo to GPT-4 at once.

## File Structure Scaffold

Our repository on GitHub will be organized as follows:

```
/app
  /layout.tsx          # Top-level layout (NavBar, theming)
/components
  /GraphView.tsx       # React Flow graph component
  /NodePopup.tsx       # UI for node details on click
  /SearchBar.tsx       # NLQ search input component
  /... (other UI components: Spinner, Header, Footer, etc.)
/pages
  /api
    /analyze.ts        # POST: upload URL triggers repo analysis
    /search.ts         # POST: query triggers RAG search
    /ask.ts            # POST: question triggers Q&A agent
    /auth/[...nextauth].ts # BetterAuth config (optional)
/lib
  /ai
    orchestrator.ts    # Routes tasks to agents (calls OpenAI SDK)
    repository.ts      # RepoAnalysisAgent: cloning/parsing logic
    architecture.ts    # ArchitectureAgent logic
    visualization.ts   # VisualizationAgent formatting
    search.ts          # SearchAgent (vector DB queries)
    explanation.ts     # ExplanationAgent (LLM Q&A prompts)
    docs.ts            # DocumentationAgent
    security.ts        # SecurityAgent (static scans)
/db
  schema.ts            # Drizzle ORM schema definitions
  client.ts            # Neon DB connection
/public
  /styles
    tailwind.css       # Tailwind base (if separate) 
  favicon.ico
README.md             # Project overview and local setup
LICENSE
vercel.json           # Vercel config (rewrites, headers including CSP)
.eslintrc             # Linting rules
.prettierrc           # Formatting rules
tsconfig.json         # TypeScript config
```

- We use **pnpm** (fast, free) as per instructions.
- Each API route under `/api` handles specific backend tasks.
- The **`/lib/ai`** directory contains our AI orchestration code. We keep logic modular so each agent is testable.
- **Drizzle ORM** schema and connection live in `/db`.
- All environment-sensitive config is via Vercel env vars (not checked in).
- The `README.md` will summarize usage and architecture (we’ll generate part of it with AI or manually).

## Submission Compliance & Demo Tips

- **Submission Checklist:** 
  - ✅ Live app URL (Vercel)  
  - ✅ Public GitHub repo link (with code and README)  
  - ✅ YouTube demo video (~3 minutes)  
  - ✅ (Optional) Slide PDF or presentation link  
  - Ensure all links work and contain required info.

- **Demo Recording (3 minutes):** We will script and practice. Rough outline:
  - **0:00–0:15** – *Problem statement.* E.g. “I’m a developer facing a large unfamiliar codebase.”
  - **0:15–0:30** – *Solution intro.* Show app landing page: “Paste repo URL, analyze.”
  - **0:30–0:50** – *Upload demo.* Paste a medium repo (e.g. Next.js template). Graph animates in (~10s).
  - **0:50–1:20** – *Highlight features.* Zoom on nodes, hover. Use command palette or search box. Demo search: “auth”, shows Auth module. 
  - **1:20–1:50** – *Q&A demo.* Ask “Explain login flow.” App focuses on nodes in order, AI text bubble with steps.
  - **1:50–2:20** – *Docs feature.* Click “Generate README”, show a readable summary of repo.
  - **2:20–2:40** – *Performance & polish.* Briefly note tech: “powered by GPT-4” (AI icon flashes), show loading skeletons, mention free stack.
  - **2:40–3:00** – *Wrap-up pitch.* Emphasize originality (“This isn’t a regular code search”), impact (time saved), and AI at core. End on logo or tagline.

**Timing is tight**, so we’ll rehearse to hit each point clearly. The flow should feel like a story: “Discovering the unknown code universe.”

We will narrate in first person plural (“we”, “our tool”) but not refer to ChatGPT or having developer persona. Focus on problem->demo->solution impact.

**Execution Note:** The judges often decide interest in the first 30 seconds. We will start with a short hook (e.g. “Ever wasted hours reading code?”) and dive into the visual to grab attention quickly.

With this plan and specification, our RepoLens project will be technically robust, meet all hackathon guidelines (AI-driven, deployable on Vercel, etc.), and ready for a compelling 3-minute demo. All decisions here (e.g. using ts-morph for AST, Upstash for vectors) are based on latest practices. Next, we will detail functional requirements and architecture in 01_PRODUCT_REQUIREMENTS.md.

