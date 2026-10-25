# PulseTriage — Emergency Triage & Hospital DBMS

[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL_16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node: Express.js](https://img.shields.io/badge/Backend-Express.js-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React 19 + Vite](https://img.shields.io/badge/Frontend-React_19_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Reliability: Gravitas](https://img.shields.io/badge/Reliability-GRAVITAS_Verified-10B981)](https://github.com/udaysharmadev/Gravitas)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Course:** CS302 / AD302 — Database Management Systems  
> **Programme:** B.Tech V Sem (CSE / AI&DS)  
> **Faculty:** Dr. K. E. Srinivasa Desikan & Dr. S. Manoj Kumar  
> **Project:** Emergency Triage, ICU Resource Allocation & Hospital Management System  
> **Standard:** Built and verified under the [GRAVITAS](https://github.com/udaysharmadev/Gravitas) reliability runtime.

---

## 🏥 Problem Overview

Emergency Departments (EDs) require rapid, high-acuity decision making under severe resource constraints. **PulseTriage** is an ACID-compliant Relational Database Management System built to eliminate:
1. **Triage Drift:** Patient deterioration in waiting areas without automated acuity recalculation.
2. **Bed Double-Allocation Race Conditions:** Concurrent admissions clashing over scarce ICU / Trauma beds.
3. **Data Redundancy:** Desynchronized bed and admission states via a strictly enforced **Single Source of Truth**.
4. **Unaccountable Clinical Overrides:** Unaudited changes to clinical acuity or medication orders.

---

## 📋 Syllabus Traceability Matrix

| Module | Syllabus Topic | PulseTriage Implementation | File Location |
| :--- | :--- | :--- | :--- |
| **M1–M2** | Enhanced Entity-Relationship (EER) | Specialization/Generalization (`users` -> `doctors`, `nurses`, `receptionists`), cardinalities (1:N, M:N), Weak Entities. | [`MASTER_PLAN.md`](MASTER_PLAN.md) |
| **M3** | SQL DDL/DML, Triggers, Views | 6 ENUM types, 12 normalized tables, check constraints, 4 PL/pgSQL triggers (`fn_compute_triage_score`, `fn_sync_bed_on_admission_change`, `fn_sync_ward_occupancy`). | [`db/init/01_schema_and_rbac.sql`](db/init/01_schema_and_rbac.sql), [`db/init/02_triggers.sql`](db/init/02_triggers.sql) |
| **M4** | Normalization (3NF / BCNF) | Functional dependency closure analysis, candidate key proofs, lossless-join & dependency preservation proof. | [`MASTER_PLAN.md`](MASTER_PLAN.md) |
| **M5** | Transactions & Concurrency Control | Two-Phase Locking (2PL) with `SELECT ... FOR UPDATE`, Conflict-Serializability proof with Precedence Graph, transaction retry handling for `40001` (Serialization) & `40P01` (Deadlock). | [`server/routes/beds.js`](server/routes/beds.js), [`server/db.js`](server/db.js) |
| **M6** | Query Optimization & Indexing | Strategic B-Tree composite & partial indexes, concrete `EXPLAIN (ANALYZE, BUFFERS)` benchmark demonstrating 825x speedup and 99.5% buffer reduction. | [`db/init/01_schema_and_rbac.sql`](db/init/01_schema_and_rbac.sql), [`MASTER_PLAN.md`](MASTER_PLAN.md) |
| **M7** | Security & Crash Recovery | Native PostgreSQL RBAC (`CREATE ROLE`, `GRANT/REVOKE`), Row-Level Security (RLS) on audit trail and prescriptions, application-layer temporal audit logging with JSON diffs. | [`db/init/01_schema_and_rbac.sql`](db/init/01_schema_and_rbac.sql), [`server/routes/inspector.js`](server/routes/inspector.js) |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  React 19 + Vite + Tailwind CSS + Framer Motion                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │ Live Triage  │  │ Ward Bed     │  │  DBMS Inspector        │  │  │
│  │  │ Kanban Board │  │ Status Matrix│  │  Panel (M2,M4,M5,M6,M7)│  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘  │  │
│  └─────────┼─────────────────┼──────────────────────┼───────────────┘  │
│            │     REST / JSON │                      │                  │
└────────────┼─────────────────┼──────────────────────┼──────────────────┘
             │                 │                      │
┌────────────▼─────────────────▼──────────────────────▼──────────────────┐
│                     BACKEND API SERVER                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Node.js + Express (Raw SQL with pg native driver — NO ORM)     │   │
│  │  • JWT Auth -> Database SET ROLE on each session                │   │
│  │  • 40001 / 40P01 Transaction retry wrapper with backoff         │   │
│  │  • Two-Phase Locking (2PL) Bed Allocation                       │   │
│  │  • Server-Sent Events (SSE) live telemetry stream               │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────────┐
│                      PostgreSQL 16 Engine                             │
│  ┌─────────────┐  ┌────────────────┐  ┌────────────────────────────┐  │
│  │ 12 Tables   │  │ PL/pgSQL       │  │ Security & Audit           │  │
│  │ 6 ENUMs     │  │ Triggers       │  │ • 4 DB Roles (RBAC)        │  │
│  │ 3NF / BCNF  │  │ • Auto Triage  │  │ • Row-Level Security (RLS) │  │
│  │ Composite   │  │ • Single-source│  │ • Application-Layer        │  │
│  │ Indexes     │  │   Bed Sync     │  │   Temporal Audit Trail     │  │
│  └─────────────┘  └────────────────┘  └────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart

### Option A: Local Zero-Docker Execution (Embedded PostgreSQL 16)
PulseTriage features a self-contained embedded WebAssembly PostgreSQL 16 engine (`PGlite`) for zero-dependency evaluation:

```bash
# 1. Install backend dependencies
cd server
npm install

# 2. Run Gravitas automated verification test suite
node ../scripts/verify_schema.js
node ../tests/api_verification.js

# 3. Start API server
npm start
```

### Option B: One-Command Docker Compose
```bash
docker-compose up --build
```
* **PostgreSQL Database:** `localhost:5432` (`pt_admin` / `pulsetriage_secret`)
* **Backend API:** `http://localhost:3001`
* **Health Check:** `http://localhost:3001/api/health`

---

## 🧪 Verification & Evidence (Gravitas Invariant 3)

The project includes deterministic executable test suites verifying all syllabus deliverables:

1. **Schema & Trigger Invariants (`scripts/verify_schema.js`):**
   * 29/29 tests passing: validates 12 tables, 6 ENUMs, check constraints (negative vitals rejected), bed sync triggers, auto-triage scoring, and EXPLAIN ANALYZE execution.
2. **API & Concurrency Suite (`tests/api_verification.js`):**
   * 16/16 tests passing: validates JWT auth, RBAC permissions, atomic 2PL bed allocation with row-level locks, conflict detection (409 Conflict), and temporal audit trail JSON diffs.

```bash
node scripts/verify_schema.js
node tests/api_verification.js
```

---

## 📜 License

MIT © 2026 PulseTriage Contributors.
