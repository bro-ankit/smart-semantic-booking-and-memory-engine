# Smart Semantic Bookmarking & Memory Engine

A production-grade micro-RAG pipeline that transforms raw text and URLs into searchable semantic memory. Feed in content — the system enriches it, embeds it, and lets you retrieve grounded answers in plain English.

No hallucinations. No keyword matching. Pure semantic understanding.

---

## What it does

1. **Accepts** raw text directly, or scrapes a URL asynchronously via a job queue
2. **Enriches** content using Gemini 2.5 Flash — extracting a summary, tags, and action items
3. **Reviews** AI output via a human-in-the-loop queue before embedding — corrections are stored as training signal
4. **Embeds** the content into a 768-dimensional vector space (pgvector)
5. **Retrieves** semantically similar bookmarks and generates grounded answers to questions
6. **Measures** answer quality automatically via an LLM-as-judge eval harness

---

## System Architecture

Four core layers: an ingestion pipeline with human review, a retrieval surface, an eval harness, and a resilience layer protecting all external calls.

---

### Layer 1 — Ingestion Loop

Accepts either raw text (synchronous) or a URL (async via BullMQ). Both paths converge at the same enrichment and embedding pipeline.

![Ingestion Loop](docs/diagrams/ingestion-loop.png)

#### Tiered URL Scraping

`ScraperService` avoids launching a headless browser for every request:

| Tier | Mechanism | When |
|------|-----------|------|
| **1 — Fast** | `fetch` + `@mozilla/readability` | Always attempted first |
| **2 — Full** | Puppeteer (`networkidle2`) | Only when Tier 1 yields < 200 chars |

Static pages (GitHub, documentation, blog posts) never touch Chrome. JavaScript-rendered SPAs fall back to Puppeteer automatically.

#### Ingestion State Machine

```
PENDING ──► PROCESSING ──► REVIEW_PENDING ──► COMPLETED
                       ╲                  ╲
                        ──► FAILED          ──► FAILED (HUMAN_REJECTED)
```

A `PENDING` row is written **before** any scraping or LLM call. Every attempt is observable from the start. Enrichment completes to `REVIEW_PENDING` — a human approves, edits, or rejects before embedding runs. Every AI-vs-human delta is stored in the `corrections` table as future fine-tuning signal.

#### Execution Sequence — rawText

```
POST /api/v1/bookmarks  { rawText: "..." }
  │
  ├─ Write PENDING row to DB
  ├─ Transition PENDING → PROCESSING
  ├─ EnrichmentService.enrich()  [@Resilient()]
  │    └─ Gemini 2.5 Flash → { contentSummary, tags, actionItems }
  ├─ IAiClient.generateEmbedding()  [@Resilient()]
  │    └─ gemini-embedding-001 → float[768]
  └─ Atomic transaction
       ├─ updateEnrichment → COMPLETED
       └─ insertMany(todos) linked to bookmark
```

#### Execution Sequence — URL

```
POST /api/v1/bookmarks  { url: "https://..." }
  │
  ├─ Write PENDING row to DB
  ├─ Enqueue BullMQ job  (jobId = bookmarkId, 3 retries, exponential backoff)
  └─ Return PENDING bookmark immediately  ← HTTP response ends here

  [async — BullMQ worker]
  ├─ ScraperService.scrape(url)
  │    ├─ Tier 1: fetch + Readability  (fast path)
  │    └─ Tier 2: Puppeteer            (JS-rendered fallback)
  └─ IngestService.processRawText()  → same enrichment pipeline as above
```

---

### Layer 2 — Retrieval Loop

![Retrieval Loop](docs/diagrams/retrieval-loop.png)

#### Semantic Search — `GET /api/v1/search?q=...`

The query string is embedded via `gemini-embedding-001`, then a cosine distance query (`<=>`) runs against the pgvector HNSW index, returning the top 3 closest bookmarks. Searching `"broker scaling"` surfaces a document about Kafka partitioning — no keyword overlap needed.

#### Grounded Q&A — `POST /api/v1/ask`

The question is embedded and used to retrieve the top 3 semantically relevant bookmarks. Those are injected as a system instruction into Gemini 2.5 Flash, which is instructed to answer **only** from the provided context. If nothing relevant exists, the system returns a defined fallback phrase rather than hallucinating.

---

### Layer 3 — Eval Harness

`POST /api/v1/evals/run` runs a repeatable quality measurement against the golden dataset:

```
POST /api/v1/evals/run
  │
  ├─ EvalGoldenSetService.load()            — reads evals/golden-set.json (15 cases)
  │
  └─ For each golden case:
       ├─ RAGService.execute(question)       — semantic search + Gemini answer + context chunks
       ├─ EvalJudgeService.score()           — Gemini 2.5 Flash as judge
       │    └─ Returns { relevance, faithfulness, reasoning }
       └─ EvalsRepository.insert()           — persist to eval_runs table
  │
  └─ Return summary
       ├─ avgRelevance, avgFaithfulness
       └─ weakCases (scored below 0.7)       — your regression watchlist
```

The judge is a separate Gemini call that rates two orthogonal dimensions:
- **relevance** — does the answer address the question and expected topics?
- **faithfulness** — are all claims grounded in the retrieved context (no hallucination)?

Run before and after any retrieval or prompt change to prove it helped.

---

### Layer 4 — Resilience Layer

![Resilience Layer](docs/diagrams/resilience-loop.png)

`@Resilient()` is applied to `EnrichmentService.enrich` and `GeminiClient.generateEmbedding`. Each decorated method gets both a retry policy and a circuit breaker transparently — callers are unaware.

| Policy | Configuration |
|--------|---------------|
| Retry | 3 attempts, exponential backoff + full jitter |
| Circuit Breaker | Opens at 50% failure rate, probes recovery after 10s |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + TypeScript (NestJS) |
| Vector DB | PostgreSQL 16 + pgvector |
| LLM | Gemini 2.5 Flash |
| Embeddings | gemini-embedding-001 (768 dimensions) |
| Validation | Zod (structured LLM output) |
| ORM | Drizzle ORM |
| Job Queue | BullMQ + Redis 7 |
| Scraping — Tier 1 | `fetch` + `@mozilla/readability` |
| Scraping — Tier 2 | Puppeteer (headless Chrome, Docker-compatible) |
| Resilience | cockatiel (retry + circuit breaker) |
| Architecture | NestJS CQRS (`CommandBus`) |
| Eval Harness | LLM-as-judge (Gemini 2.5 Flash) + `eval_runs` table + golden-set.json |

---

## Running Locally

**Prerequisites:** Docker, Node.js 20+

```bash
git clone <repo>
cd smart-semantic-bookmarking-and-memory-engine
cp .env.example .env
# Set DB_PASSWORD and GEMINI_API_KEY in .env

docker compose up -d --build
```

Swagger UI: `http://localhost:3000/api/v1/docs`

### Environment Variables

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<your password>
DB_NAME=bookmarks_db
DB_POOL_SIZE=10
SERVER_PORT=3000
GEMINI_API_KEY=<your key>
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Running Tests

```bash
npm run test
```

---

## API Reference

### Ingest — Raw Text

```http
POST /api/v1/bookmarks
Content-Type: application/json

{ "rawText": "Kafka uses a partition-per-consumer model to achieve horizontal scale." }
```

```json
{
  "id": "d3f1a2b4-...",
  "originalUrl": "Kafka uses a partition-per-consumer model...",
  "contentSummary": "Kafka achieves horizontal scalability through partition assignment within consumer groups.",
  "tags": ["kafka", "partitioning", "distributed-systems", "scalability"],
  "status": "COMPLETED",
  "errorMessage": null,
  "createdAt": "2026-05-29T10:00:00.000Z"
}
```

### Ingest — URL

```http
POST /api/v1/bookmarks
Content-Type: application/json

{ "url": "https://kafka.apache.org/documentation/#design_pull" }
```

```json
{
  "id": "a1b2c3d4-...",
  "originalUrl": "https://kafka.apache.org/documentation/#design_pull",
  "contentSummary": "",
  "tags": [],
  "status": "PENDING",
  "errorMessage": null,
  "createdAt": "2026-05-29T10:00:00.000Z"
}
```

The bookmark transitions to `COMPLETED` in the background. `rawText` and `url` are mutually exclusive — supplying both returns a `400`.

### Semantic Search

```http
GET /api/v1/search?q=how does broker scaling work
```

```json
[
  {
    "id": "d3f1a2b4-...",
    "contentSummary": "Kafka achieves horizontal scalability through partition assignment within consumer groups.",
    "tags": ["kafka", "partitioning", "distributed-systems", "scalability"],
    "status": "COMPLETED",
    "createdAt": "2026-05-29T10:00:00.000Z"
  }
]
```

### Ask Your Bookmarks

```http
POST /api/v1/ask
Content-Type: application/json

{ "question": "How does Kafka handle consumer scaling?" }
```

```json
{
  "answer": "Kafka achieves consumer scaling through its partition model — each partition is assigned to exactly one consumer within a consumer group, allowing throughput to scale horizontally by adding partitions and consumers in tandem."
}
```

### Human Review Queue

```http
GET /api/v1/bookmarks/review
```

Returns all bookmarks in `REVIEW_PENDING` state with AI-generated summaries and tags.

```http
PATCH /api/v1/bookmarks/:id/review
Content-Type: application/json

{ "approved": true, "editedSummary": "Better description.", "editedTags": ["kafka"] }
```

`approved: false` → transitions to `FAILED` with reason `HUMAN_REJECTED`. Human edits (if any) replace AI output before embedding. Every correction is stored in the `corrections` table.

### Run Evals

```http
POST /api/v1/evals/run
```

```json
{
  "totalCases": 15,
  "avgRelevance": 0.84,
  "avgFaithfulness": 0.91,
  "weakCases": [
    { "question": "What are the tradeoffs between sync and async ingestion?", "relevanceScore": 0.65, "faithfulnessScore": 0.72 }
  ],
  "runs": [...]
}
```

---

## Design Decisions

Full records in [`docs/decisions/`](docs/decisions/). Highlights:

| ADR | Decision | Why |
|-----|----------|-----|
| [003](docs/decisions/003-ai-client-abstraction.md) | Provider-agnostic `IAiClient` | Swap LLM providers without touching service code |
| [006](docs/decisions/006-drizzle-transaction-propagation.md) | `DrizzleTransactionContext` via AsyncLocalStorage | Transaction propagation across async boundaries without passing context manually |
| [009](docs/decisions/009-semantic-search-query.md) | Cosine distance (`<=>`) over L2 | Magnitude-invariant — correct for embeddings regardless of text length |
| [011](docs/decisions/011-ingestion-state-machine.md) | `PENDING` written before any LLM call | No silent failures; every attempt is observable |
| [012](docs/decisions/012-resilience-module.md) | `@Resilient()` decorator | One-line fault tolerance; callers are unaware of retries |
| [013](docs/decisions/013-async-url-ingestion-bullmq.md) | BullMQ queue for URL ingestion | Non-blocking HTTP response; durable across restarts; built-in retry |
| [014](docs/decisions/014-tiered-scraping-strategy.md) | Cheerio/Readability first, Puppeteer fallback | Puppeteer only when genuinely needed — saves ~2–5s and 250MB RAM per static page |
| [015](docs/decisions/015-cqrs-command-handler-and-ingest-module.md) | CQRS command handler for ingestion branching | Thin controller; no circular module dependencies |
| [016](docs/decisions/016-human-review-before-embedding.md) | Human review gate before embedding | Vector store only ever holds human-approved content; corrections become training signal |
| [017](docs/decisions/017-llm-as-judge-eval-harness.md) | LLM-as-judge over keyword matching | Measures relevance and faithfulness independently; catches hallucinations that keywords cannot |
| [018](docs/decisions/018-plaintToInstance-in-handlers-not-controllers.md) | `plainToInstance` in handlers, not controllers | `CommandBus.execute()` returns `any` — only handlers have the typed return to safely drive the conversion |
