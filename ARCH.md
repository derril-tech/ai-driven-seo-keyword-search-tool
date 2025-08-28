# Architecture — AI-Driven SEO Keyword Research Tool

## Topology
- **Frontend/BFF**: Next.js 14 (Vercel). Server Actions for presigned uploads & light mutations; SSR/ISR for reports.
- **API Gateway**: NestJS (Node 20) — REST `/v1` + WebSocket; OpenAPI 3.1; Zod/AJV; RBAC (Casbin); RLS; rate limits; Idempotency-Key; Request-ID.
- **Workers (Python 3.11 + FastAPI)**
  - `expand-worker`: seeds → candidates (BM25/embeddings/KeyBERT/YAKE) + dedupe.
  - `serp-worker`: SERP API calls; features (PAA/snippet/video/local).
  - `scrape-worker`: robots-aware fetch; outline/entities/schema extraction.
  - `nlp-worker`: Sentence-BERT embeddings; spaCy entities; text cleanup.
  - `cluster-worker`: HDBSCAN/k-means; cluster labeling; diagnostics.
  - `intent-worker`: transformer classifier + SERP-mix rules.
  - `difficulty-worker`: compute difficulty & traffic potential.
  - `trend-worker`: seasonality/Prophet forecast (post-MVP optional).
  - `brief-worker`: content brief generation.
  - `gap-worker`: competitor diff (post-MVP).
  - `graph-worker`: topic map (networkx).
  - `export-worker`: CSV/XLSX/PDF/JSON.
  - `sync-worker`: Notion/Docs/GSC/GA4 (scoped tokens).
- **Event Bus (NATS)**: `seed.expand`, `serp.fetch`, `scrape.page`, `nlp.embed`, `cluster.build`, `intent.score`, `difficulty.score`, `trend.calc`, `brief.make`, `graph.build`, `export.make`, `sync.*`.
- **Datastores**
  - **Postgres 16** (+ **pgvector**): tenancy, projects, seeds, keywords, clusters, entities, briefs, approvals, exports, audit.
  - **OpenSearch**: BM25 search + aggregations; keyword lookup & filters.
  - **ClickHouse**: job telemetry/metrics; SLA dashboards.
  - **Redis**: cache/session/rate limits/job progress.
  - **S3/R2**: artifacts/exports (CSV/XLSX/PDF/JSON).

## Data Model (high level)
- Tenancy: `orgs`, `users`, `memberships` (RLS by `org_id`).
- Projects & Seeds: `projects`, `seeds`.
- Keywords & SERP: `keywords` (score fields, features), `serp_results`, `pages`.
- Embeddings & Clusters: `embeddings`, `clusters`, `cluster_members`, `entities`.
- Scoring & Briefs: `intent_scores`, `difficulty`, `traffic_potential`, `briefs`.
- Links & Gap: `internal_links`, `competitor_gap` (post-MVP).
- Ops: `exports`, `audit_log`.

## Public API (REST/WebSocket)
- `POST /projects`
- `POST /seeds`
- `POST /expand`
- `POST /serp/fetch`
- `POST /pages/fetch`
- `POST /embed`
- `POST /cluster`
- `POST /score/intent`
- `POST /score/difficulty`
- `POST /score/traffic`
- `POST /briefs`
- `POST /exports`
- `GET /keywords|/clusters|/briefs|/exports`
- **WS**: `project:{id}:jobs`, `cluster:{id}:status`, `brief:{id}:progress`

## Pipelines
1. **Seeds → Expansion** (BM25 + embeddings + extraction) → dedupe → store.
2. **SERP Enrichment** (API) → features + outlines/entities → store.
3. **Embeddings & Clustering** → cluster labels + topic graph.
4. **Scoring** → intent, difficulty, traffic potential.
5. **Brief Generation** → outline/FAQs/entities/internal links.
6. **Export/Sync** → CSV/XLSX/PDF/JSON → Notion/Docs.

## Realtime
- WebSockets for job progress (expand/serp/cluster/brief).
- SSE fallback for long running exports.

## Caching & Performance
- Redis caches hot keywords/SERP summaries.
- OpenSearch for fast BM25 & aggregations; pgvector for semantic neighbors.
- Batch SERP calls with concurrency + backoff; rate-limit governance.

## Security & Compliance
- TLS/HSTS/CSP; KMS-wrapped secrets; Postgres RLS; S3 signed URLs.
- Robots.txt & site terms compliance; audit every fetch/export.
- PII redaction for GSC/GA4; data retention & DSR endpoints.
- SSO/SAML/OIDC; SCIM (enterprise).

## SLOs
- Expand 1k seeds **< 5 min p95**; SERP (100 kw) **< 2 min p95**; cluster 10k **< 3 min p95**; brief **< 60 s p95**.
- Pipeline success ≥ **99%**; coverage for SERP enrichment ≥ **95%**; 5xx **< 0.5%/1k**.
