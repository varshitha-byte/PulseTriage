// ============================================================
// PulseTriage — Wards & Beds Resource Management (server/routes/beds.js)
// Implements:
// 1. Ward Bed Grid status matrix
// 2. Atomic Bed Assignment using 2PL (SELECT ... FOR UPDATE)
// 3. Discharge synchronization (Triggers auto-vacate bed)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

// GET /api/beds/wards
// Overview of all hospital wards and occupancy rates
router.get('/wards', authMiddleware, async (req, res) => {
  try {
    const queryText = `
      SELECT
        w.ward_id,
        w.ward_name,
        w.ward_type,
        d.name AS department_name,
        w.total_beds,
        w.occupied_beds,
        ROUND((w.occupied_beds::NUMERIC / w.total_beds::NUMERIC) * 100, 1) AS occupancy_rate_percent
      FROM wards w
      JOIN departments d ON d.department_id = w.department_id
      ORDER BY w.ward_name ASC;
    `;
    const result = await db.query(queryText);
    res.json({ wards: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/beds/grid
// Returns complete bed grid with ward details and occupied patient info
router.get('/grid', authMiddleware, async (req, res) => {
  try {
    const queryText = `
      SELECT
        b.bed_id,
        b.bed_number,
        b.status AS bed_status,
        b.last_sanitized_at,
        w.ward_id,
        w.ward_name,
        w.ward_type,
        p.patient_id,
        p.full_name AS current_patient_name,
        p.gender AS current_patient_gender,
        a.admission_id,
        a.triage_level
      FROM beds b
      JOIN wards w ON w.ward_id = b.ward_id
      LEFT JOIN patients p ON p.patient_id = b.current_patient_id
      LEFT JOIN admissions a ON a.assigned_bed_id = b.bed_id AND a.status = 'ACTIVE'
      ORDER BY w.ward_name ASC, b.bed_number ASC;
    `;
    const result = await db.query(queryText);
    res.json({ beds: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/beds/assign
// Two-Phase Locking (2PL) Bed Allocation with SELECT ... FOR UPDATE
router.post('/assign', authMiddleware, requireRole('nurse', 'doctor', 'admin'), async (req, res) => {
  const { admissionId, bedId } = req.body;
  if (!admissionId || !bedId) {
    return res.status(400).json({ error: 'Missing admissionId or bedId' });
  }

  try {
    const result = await db.withTransaction(async (client) => {
      // 1. Acquire exclusive row lock on the target bed (Growing Phase of 2PL)
      const bedLockRes = await client.query(`
        SELECT bed_id, bed_number, status, current_patient_id
        FROM beds
        WHERE bed_id = $1
        FOR UPDATE;
      `, [bedId]);

      if (bedLockRes.rows.length === 0) {
        throw new Error('Target bed not found');
      }

      const bed = bedLockRes.rows[0];
      if (bed.status !== 'VACANT') {
        const conflictErr = new Error(`Bed ${bed.bed_number} is currently ${bed.status}. Allocation blocked.`);
        conflictErr.statusCode = 409;
        throw conflictErr;
      }

      // 2. Verify admission is active and eligible
      const admRes = await client.query(`
        SELECT admission_id, patient_id, status, assigned_bed_id
        FROM admissions
        WHERE admission_id = $1
        FOR UPDATE;
      `, [admissionId]);

      if (admRes.rows.length === 0) {
        throw new Error('Admission not found');
      }
      if (admRes.rows[0].status !== 'ACTIVE') {
        throw new Error('Cannot assign bed to non-active admission');
      }

      // 3. Update admissions table (the Single Source of Truth)
      // The trigger trg_sync_bed_on_admission_change will automatically update beds.status to OCCUPIED
      await client.query(`
        UPDATE admissions
        SET assigned_bed_id = $1
        WHERE admission_id = $2;
      `, [bedId, admissionId]);

      return {
        success: true,
        message: `Bed ${bed.bed_number} allocated successfully`,
        admissionId,
        bedId,
        bedNumber: bed.bed_number
      };
    });

    db.broadcastEvent('bed_allocated', result);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/beds/discharge
// Discharge patient -> Triggers automatically vacate bed and decrement ward count
router.post('/discharge', authMiddleware, requireRole('doctor', 'admin'), async (req, res) => {
  const { admissionId } = req.body;
  if (!admissionId) {
    return res.status(400).json({ error: 'Missing admissionId' });
  }

  try {
    const result = await db.withTransaction(async (client) => {
      const updateRes = await client.query(`
        UPDATE admissions
        SET status = 'DISCHARGED',
            discharged_at = NOW()
        WHERE admission_id = $1 AND status = 'ACTIVE'
        RETURNING admission_id, assigned_bed_id, status, discharged_at;
      `, [admissionId]);

      if (updateRes.rows.length === 0) {
        throw new Error('Active admission not found or already discharged');
      }

      return updateRes.rows[0];
    });

    db.broadcastEvent('patient_discharged', result);
    res.json({
      message: 'Patient discharged successfully. Bed automatically vacated via trigger.',
      admission: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
