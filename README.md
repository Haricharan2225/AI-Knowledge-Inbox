# Turium AI – AI Knowledge Inbox

> **Enterprise-Grade AI Knowledge Inbox with Hybrid RAG & Transparent Source Citations**  
> Built as a Technical Recruitment Assignment for **Turium AI**.

---

## 🎨 Design System

Strictly adhering to the required **3-color brand palette**:

| Token | Hex Code | Role | Tailwind Token |
| :--- | :--- | :--- | :--- |
| **Cream** | `#F3ECE0` | Primary application canvas background and modal surfaces | `brand-cream` / `bg-[#F3ECE0]` |
| **Sand** | `#D9C3A5` | Cards, secondary surfaces, and subtle borders | `brand-sand` / `bg-[#D9C3A5]` |
| **Orange** | `#F26A1B` | Primary actions, active navigation indicators, and highlights | `brand-orange` / `bg-[#F26A1B]` |

Neutral text colors (`#2C221E` Dark Brown, `#5A4D45` Charcoal, `#FFFFFF` White) are used strictly for typography hierarchy and readability. No unapproved accent colors (blue, purple, violet, green) are used anywhere in the codebase.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT CLIENT (Vite)                              │
│  • Dashboard (Live Metrics, Logs)     • Add Knowledge (Text & Public URLs)  │
│  • Knowledge Library (Search, Filter) • AI Assistant (Hybrid RAG Chat)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST (Port 3000 -> 5000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            EXPRESS.JS BACKEND                               │
│  • Request Correlation Middleware & Winston Structured JSON Logging         │
│  • Zod Input Validation & Global Error Handler                              │
│  • Ingest Controller: Deduplication, SSRF-Safe Scraper, Semantic Chunker    │
│  • Hybrid Vector Engine: BM25 Lexical Index + Dense Cosine Similarity       │
│  • RAG Engine: Multi-part Query Decomposition & Strict Citation Grounding   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ better-sqlite3 (Binary BLOBs)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             SQLITE DATABASE                                 │
│  • items: Document metadata, content hash, URL source                       │
│  • chunks: 500-char chunks, 100-char overlap, IEEE 754 vector BLOBs         │
│  • logs: Structured audit logs with query latency and metadata              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

1. **Dual Knowledge Ingestion Pipeline**:
   - **Text Notes**: Manual paste or text composition with automatic sentence-boundary chunking (~500 chars with ~100-char semantic overlap).
   - **Public Web Scraping**: Cheerio-based cleaner stripping scripts, navigation, footers, and tracking tags.
   - **Enterprise Security**: Strict SSRF guard blocking private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`, and `localhost`).
   - **Content Deduplication**: SHA-256 content/URL hashing prevents redundant clone records.

2. **Advanced Hybrid Retrieval Engine**:
   - **BM25 Lexical Engine**: Exact keyword and technical acronym matching (e.g. `JVM`, `OOP`, `try/catch/finally`).
   - **Dense Vector Search**: High-dimensional semantic embeddings stored as raw IEEE 754 float32 binary BLOBs inside SQLite.
   - **Reciprocal Rank Fusion (RRF)**: Combines dense cosine similarity with sparse lexical BM25 scores.
   - **Adaptive Thresholding**: Filters out noise below 45% of the top candidate's score to eliminate irrelevant document retrieval.

3. **Strict RAG Generation & Anti-Hallucination Guardrails**:
   - **Zero Hallucination**: Out-of-context or unsupported questions are transparently rejected (`"I do not have enough information in the saved knowledge to answer this question."`).
   - **Multi-part Decomposition**: Compound questions with multiple sub-questions are partitioned, answered individually from context, and synthesized.
   - **Partial Information Handling**: Questions with partially available knowledge answer the supported component while clearly highlighting what was not found.
   - **Auditable Citations**: Every claim is cited with clickable `[Source X]` chips displaying the document title, chunk preview, and similarity score.

---

## 📁 Repository Structure

```
AI-Knowledge-Inbox/
├── package.json                   # Root orchestrator (dev, test, build)
├── server/                        # Express.js + SQLite Backend
│   ├── src/
│   │   ├── config/                # Database connection, env, logger
│   │   ├── controllers/           # ingestController, itemController, queryController
│   │   ├── services/
│   │   │   ├── scraperService.js  # SSRF-safe public URL scraper
│   │   │   ├── chunkingService.js # Sentence-aware chunker with overlap
│   │   │   ├── embeddingService.js# Multi-provider vector generator
│   │   │   ├── bm25Service.js     # BM25 sparse lexical engine
│   │   │   ├── vectorStore.js     # Hybrid search & SQLite vector store
│   │   │   ├── llmService.js      # Grounded answer synthesis
│   │   │   └── ragService.js      # End-to-end RAG orchestrator
│   │   ├── middleware/            # Error handling, request logger, validators
│   │   ├── routes/                # Ingest, Items, Query, Health routes
│   │   └── tests/
│   │       ├── phase2_test.js     # Ingestion & scraper tests
│   │       ├── phase3_test.js     # Vector math & storage tests
│   │       ├── phase4_test.js     # RAG query & citation tests
│   │       └── rag_accuracy_test.js # 8/8 Accuracy benchmark suite
│   └── data/                      # Persistent SQLite database (knowledge.db)
└── client/                        # React + Vite + Tailwind CSS Frontend
    └── src/
        ├── components/
        │   ├── common/            # Toast, Modal, StatCard, Badge
        │   ├── layout/            # Sidebar, Header
        │   ├── knowledge/         # IngestForm, ChunkViewer, DocumentInspector
        │   └── assistant/         # ChatWindow, SourceCitationCard
        ├── pages/
        │   ├── Dashboard.jsx      # Metrics overview, recent activity, system audit
        │   ├── KnowledgeLibrary.jsx# Search, filter, inspect, and delete documents
        │   ├── AddKnowledge.jsx   # Tabbed note & URL ingestion interface
        │   └── AIAssistant.jsx    # Grounded RAG conversation interface
        └── services/              # API HTTP client
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ingest` | Ingests a text note or public URL, creates chunks & embeddings |
| `GET` | `/api/items` | Retrieves all saved items with chunk counts and search query support |
| `GET` | `/api/items/:id` | Retrieves a single item with its raw content and full vector chunks |
| `DELETE` | `/api/items/:id` | Cascading deletion of an item and all associated vector chunks |
| `POST` | `/api/query` | Executes hybrid search and synthesizes a grounded answer with citations |
| `GET` | `/api/stats` | Returns aggregate counts of items, chunks, embeddings, and logs |
| `GET` | `/api/health` | Health check with database connectivity and embedding engine status |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Installation
Install all dependencies (root, backend, and frontend) with a single command:
```bash
npm run install:all
```

### 3. Environment Configuration
Backend `.env` file is located at `server/.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
DB_PATH=./data/knowledge.db
EMBEDDING_PROVIDER=deterministic   # Switch to 'gemini' or 'openai' if keys are set
LLM_PROVIDER=deterministic         # Switch to 'gemini' or 'openai' if keys are set
GEMINI_API_KEY=
OPENAI_API_KEY=
```

### 4. Running Development Servers
Run both backend (`localhost:5000`) and frontend (`localhost:3000`) concurrently:
```bash
npm run dev
```

Visit **http://localhost:3000** in your web browser.

---

## 🧪 Testing & Verification

Run the entire automated verification suite (covering Phase 2, Phase 3, Phase 4, and the 8/8 RAG Accuracy Benchmarks):
```bash
npm test
```

### Benchmark Scenarios Verified:
1. **Exact Question Matching**: Retrieves targeted OOP principles chunk with `1.00` precision.
2. **Semantic Question with Different Wording**: Maps "What is JVM and why is it used?" to Java execution bytecode principles.
3. **Multi-Concept Compound Question**: Answers 3 distinct sub-questions (OOP, JVM, exception handling) in one synthesized output.
4. **Partially Available Information**: Answers the supported topic while explicitly citing what was absent.
5. **Completely Unrelated Question**: Zero-hallucination guardrail cleanly refuses quantum computing questions.
6. **Vector Similarity Query**: Retrieves vector space mathematics from ingested docs.
7. **Platform Architecture Query**: Accurately cites Turium AI hybrid architecture.
8. **Deduplication Integrity**: Re-ingesting existing documents updates them without creating duplicate clones.
