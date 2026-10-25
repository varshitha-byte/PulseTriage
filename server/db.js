// ============================================================
// PulseTriage — Database Layer (server/db.js)
// Implements:
// 1. Dual-mode DB Engine: Native PostgreSQL (pg.Pool) or embedded PGlite
// 2. Transaction retry wrapper for 40001 (Serialization Failure) & 40P01 (Deadlock)
// 3. PostgreSQL Role switching (SET ROLE) for true database-level RBAC
// ============================================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PGlite } = require('@electric-sql/pglite');

let pgPool = null;
let pgliteDb = null;
let isEmbedded = false;

// Initialize Database connection
async function initDb() {
  if (process.env.DATABASE_URL) {
    try {
      console.log('Connecting to PostgreSQL database at:', process.env.DATABASE_URL);
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 20
      });
      // Test connectivity
      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('Successfully connected to external PostgreSQL 16 cluster.');
      return;
    } catch (err) {
      console.warn('Could not connect to external PostgreSQL, falling back to embedded PGlite:', err.message);
      pgPool = null;
    }
  }

  // Fallback: Embedded PGlite engine (Pure WASM PostgreSQL 16)
  console.log('Initializing embedded PostgreSQL 16 (PGlite)...');
  pgliteDb = new PGlite();
  isEmbedded = true;

  // Run schema, triggers, and seed data
  const schemaPath = path.join(__dirname, '../db/init/01_schema_and_rbac.sql');
  const triggersPath = path.join(__dirname, '../db/init/02_triggers.sql');
  const seedPath = path.join(__dirname, '../db/init/03_seed_data.sql');

  if (fs.existsSync(schemaPath)) {
    console.log('Running 01_schema_and_rbac.sql...');
    await pgliteDb.exec(fs.readFileSync(schemaPath, 'utf-8'));
  }
  if (fs.existsSync(triggersPath)) {
    console.log('Running 02_triggers.sql...');
    await pgliteDb.exec(fs.readFileSync(triggersPath, 'utf-8'));
  }
  if (fs.existsSync(seedPath)) {
    console.log('Running 03_seed_data.sql...');
    await pgliteDb.exec(fs.readFileSync(seedPath, 'utf-8'));
  }
  console.log('Embedded PostgreSQL 16 initialized and seeded successfully.');
}

// Sleep helper for exponential backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generic Query Runner
async function query(text, params = [], client = null) {
  if (client) {
    return client.query(text, params);
  }

  if (pgPool) {
    return pgPool.query(text, params);
  } else if (pgliteDb) {
    return pgliteDb.query(text, params);
  } else {
    throw new Error('Database not initialized. Call initDb() first.');
  }
}

// Transaction Retry Wrapper (Fix #5: 40001 Serialization & 40P01 Deadlock)
async function withTransaction(txnFn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const isolationLevel = options.isolationLevel || 'READ COMMITTED'; // or 'SERIALIZABLE'
  const role = options.role || null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client = null;
    let isDedicatedClient = false;

    if (pgPool) {
      client = await pgPool.connect();
      isDedicatedClient = true;
    } else {
      // In PGlite, query executes directly on instance
      client = pgliteDb;
    }

    try {
      await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);

      // Set DB Role if provided (RBAC enforcement at connection level)
      if (role && !isEmbedded) {
        await client.query(`SET ROLE ${role}`);
      }

      const result = await txnFn(client);

      if (role && !isEmbedded) {
        await client.query(`RESET ROLE`);
      }

      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback failure if connection broke
      }

      // Check for serialization failure (40001) or deadlock detected (40P01)
      const isRetryable = err.code === '40001' || err.code === '40P01' || (err.message && (err.message.includes('deadlock') || err.message.includes('could not serialize')));
      if (isRetryable && attempt < maxRetries) {
        const backoffMs = 100 * Math.pow(2, attempt - 1);
        console.warn(`[Txn Retry] Conflict caught (${err.code || err.message}). Retrying attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      // Non-retryable or exceeded max retries
      throw err;
    } finally {
      if (isDedicatedClient && client) {
        client.release();
      }
    }
  }
}

// Event Bus for Real-time SSE dispatch
const eventSubscribers = new Set();

function broadcastEvent(type, data) {
  const eventPayload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of eventSubscribers) {
    try {
      client.write(eventPayload);
    } catch (err) {
      eventSubscribers.delete(client);
    }
  }
}

module.exports = {
  initDb,
  query,
  withTransaction,
  broadcastEvent,
  eventSubscribers,
  isEmbedded: () => isEmbedded
};
