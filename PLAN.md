# Project Plan — AI-Driven SEO Keyword Research Tool

## Current Goal
Ship an MVP that turns **seed topics/URLs** into a **clustered, intent-labeled, prioritized keyword universe**, enriches with **SERP features & difficulty**, and outputs **AI content briefs** + **exports**.

## MVP Scope (Vertical Slice)
1. **Seed → Expansion**
   - Inputs: seed keywords, URLs/domains.
   - Expansion via BM25 (OpenSearch) + Sentence-BERT nearest neighbors + KeyBERT/YAKE.
   - Dedup/normalize (lemmatize, fuzzy match).
2. **SERP Enrichment**
   - Fetch top 10/20 SERP results via provider API.
   - Capture features (PAA/snippet/video/local), titles/H1, schema types.
3. **Scoring**
   - **Intent** classifier (informational/commercial/transactional/navigational/local).
   - **Difficulty** = authority proxy + SERP entropy + snippet ownership.
   - **Traffic potential** from priors + sibling head→tail families.
4. **Clustering & Topic Map**
   - Embeddings → HDBSCAN/k-means; label clusters; topic graph with key entities.
5. **Content Briefs**
   - For selected clusters: H2/H3 outline, FAQs (PAA), entities, internal link targets, meta suggestions.
6. **Exports & Integrations**
   - CSV/XLSX lists; PDF research deck; JSON bundle; Notion/Docs push.
7. **Governance**
   - Roles (Owner/Admin/Strategist/Writer/Viewer), approvals for briefs, audit log.

## Build Strategy
- **FE**: Next.js 14 (React 18, TS), **Ant Design** + Tailwind, Recharts/AntV; TanStack Query; WS for job progress.
- **API**: NestJS `/v1` + WebSocket; OpenAPI 3.1; Zod/AJV; RBAC (Casbin); RLS; Problem+JSON; Idempotency-Key; Request-ID.
- **Workers (Python 3.11)**: `expand`, `serp`, `scrape`, `nlp` (entities/embeddings), `cluster`, `intent`, `difficulty`, `trend`, `brief`, `gap` (post-MVP), `export`, `sync`, `graph`.
- **Data**: Postgres 16 (+ **pgvector**), **OpenSearch** (BM25/agg), **ClickHouse** (telemetry), Redis (cache), S3/R2 (exports).
- **Bus**: NATS — `seed.expand`, `serp.fetch`, `scrape.page`, `nlp.embed`, `cluster.build`, `intent.score`, `difficulty.score`, `trend.calc`, `brief.make`, `export.make`, `sync.*`.
- **Compliance**: Robots/terms aware; rate-limit governance; PII redaction for GSC.

## Milestones
- **M0 (wk1)**: Monorepo, CI/CD, base schema, auth/RBAC.
- **M1 (wk2)**: Seed ingestion + expansion pipeline (BM25 + embeddings + dedupe).
- **M2 (wk3)**: SERP enrichment via provider; basic features & parsing.
- **M3 (wk4)**: Intent + difficulty + traffic potential scoring.
- **M4 (wk5)**: Clustering + topic graph; keyword table UX.
- **M5 (wk6)**: Content brief generator + editor; CSV/XLSX/JSON exports.
- **M6 (wk7)**: PDF research deck; Notion/Docs push; dashboards.
- **M7 (wk8)**: Hardening, robots/SLA checks, SLO gates.

## Non-Goals (MVP)
- Rank tracking over time; deep competitor gap automation; GA4/GSC sync at scale (add after MVP).
- Local SEO pack details per city at scale; CMS write-backs beyond Notion/Docs.

## Success Criteria
- **Operational**: Expansion of 10k candidates **< 5 min p95**; SERP fetch (100 kw) **< 2 min p95**; cluster job (10k) **< 3 min p95**; brief **< 60 s p95**.
- **Product**: Writers adopt ≥ **80%** of briefs; robots/API compliance ≥ **95%**; measurable content efficiency lift ≥ **20%** (traffic/word) on pilots.
