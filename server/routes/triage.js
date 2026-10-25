// ============================================================
// PulseTriage — Triage Queue & Clinical Vitals Routes
// (server/routes/triage.js)
// Implements:
// 1. Live Triage Kanban Queue (sorted by Acuity and Wait Time)
// 2. Patient Intake & Registration
// 3. Vitals telemetry logging with auto-escalation trigger
// 4. Moving Average SpO2 window function query (Module 3)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

// GET /api/triage/queue
// Live active emergency triage queue with latest vitals
router.get('/queue', authMiddleware, async (req, res) => {
  try {
    const queryText = `
      SELECT
        a.admission_id,
        a.patient_id,
        p.full_name AS patient_name,
        p.gender,
        p.blood_group,
        p.phone,
        EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER AS age,
        a.triage_level,
        a.chief_complaint,
        a.admitted_at,
        a.assigned_bed_id,
        b.bed_number,
        w.ward_name,
        latest_vital.heart_rate,
        latest_vital.systolic_bp,
        latest_vital.diastolic_bp,
        latest_vital.spo2,
        latest_vital.temperature_c,
        latest_vital.gcs_score,
        latest_vital.computed_triage_score,
        latest_vital.recorded_at AS last_vitals_at
      FROM admissions a
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN beds b ON b.bed_id = a.assigned_bed_id
      LEFT JOIN wards w ON w.ward_id = b.ward_id
      LEFT JOIN LATERAL (
        SELECT
          pv.heart_rate,
          pv.systolic_bp,
          pv.diastolic_bp,
          pv.spo2,
          pv.temperature_c,
          pv.gcs_score,
          pv.computed_triage_score,
          pv.recorded_at
        FROM patient_vitals pv
        WHERE pv.admission_id = a.admission_id
        ORDER BY pv.recorded_at DESC
        LIMIT 1
      ) latest_vital ON TRUE
      WHERE a.status = 'ACTIVE'
      ORDER BY
        CASE a.triage_level
          WHEN 'RESUSCITATION' THEN 1
          WHEN 'EMERGENT' THEN 2
          WHEN 'URGENT' THEN 3
          WHEN 'LESS_URGENT' THEN 4
          WHEN 'NON_URGENT' THEN 5
          ELSE 6
        END ASC,
        a.admitted_at ASC;
    `;

    const result = await db.query(queryText);
    res.json({ queue: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/triage/intake
// Register a new patient and create active emergency admission
router.post('/intake', authMiddleware, requireRole('receptionist', 'nurse', 'doctor', 'admin'), async (req, res) => {
  try {
    const {
      fullName,
      dateOfBirth,
      gender,
      bloodGroup,
      phone,
      emergencyContact,
      chiefComplaint,
      initialTriageLevel
    } = req.body;

    if (!fullName || !dateOfBirth || !gender || !phone || !chiefComplaint) {
      return res.status(400).json({ error: 'Missing required patient intake fields' });
    }

    const result = await db.withTransaction(async (client) => {
      // 1. Get or create patient
      let patientId;
      const existingPat = await client.query('SELECT patient_id FROM patients WHERE phone = $1', [phone]);
      if (existingPat.rows.length > 0) {
        patientId = existingPat.rows[0].patient_id;
      } else {
        const newPat = await client.query(`
          INSERT INTO patients (full_name, date_of_birth, gender, blood_group, phone, emergency_contact)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING patient_id;
        `, [fullName, dateOfBirth, gender, bloodGroup || 'Unknown', phone, emergencyContact || null]);
        patientId = newPat.rows[0].patient_id;
      }

      // 2. Pick an admitting doctor
      const docRes = await client.query('SELECT doctor_id FROM doctors LIMIT 1');
      const doctorId = docRes.rows[0].doctor_id;

      // 3. Create active admission
      const admRes = await client.query(`
        INSERT INTO admissions (patient_id, admitting_doctor_id, triage_level, chief_complaint, status)
        VALUES ($1, $2, $3, $4, 'ACTIVE')
        RETURNING admission_id, triage_level, admitted_at, status;
      `, [patientId, doctorId, initialTriageLevel || 'LESS_URGENT', chiefComplaint]);

      return {
        patientId,
        admission: admRes.rows[0]
      };
    });

    db.broadcastEvent('new_admission', result);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/triage/vitals
// Record vitals telemetry -> fires automated triage scoring trigger trg_auto_triage_score
router.post('/vitals', authMiddleware, requireRole('nurse', 'doctor', 'admin'), async (req, res) => {
  try {
    const {
      admissionId,
      heartRate,
      systolicBp,
      diastolicBp,
      spo2,
      temperatureC,
      respiratoryRate,
      gcsScore
    } = req.body;

    if (!admissionId) {
      return res.status(400).json({ error: 'Missing admissionId' });
    }

    const result = await db.query(`
      INSERT INTO patient_vitals (
        admission_id, heart_rate, systolic_bp, diastolic_bp,
        spo2, temperature_c, respiratory_rate, gcs_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING vitals_id, computed_triage_score, auto_triage_level, recorded_at;
    `, [
      admissionId,
      heartRate || null,
      systolicBp || null,
      diastolicBp || null,
      spo2 !== undefined ? spo2 : null,
      temperatureC !== undefined ? temperatureC : null,
      respiratoryRate || null,
      gcsScore || null
    ]);

    const row = result.rows[0];

    // Broadcast live telemetry update
    db.broadcastEvent('vitals_updated', {
      admissionId,
      vitalsId: row.vitals_id,
      computedTriageScore: row.computed_triage_score,
      autoTriageLevel: row.auto_triage_level,
      spo2,
      heartRate
    });

    res.status(201).json({
      message: 'Vitals recorded and triage evaluated successfully',
      vitals: row
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/triage/vitals/:admissionId
// Analytical Query with Window Function: 5-point moving average SpO2 (Module 3)
router.get('/vitals/:admissionId', authMiddleware, async (req, res) => {
  try {
    const { admissionId } = req.params;
    const queryText = `
      SELECT
        pv.vitals_id,
        pv.admission_id,
        pv.heart_rate,
        pv.systolic_bp,
        pv.diastolic_bp,
        pv.spo2,
        pv.temperature_c,
        pv.respiratory_rate,
        pv.gcs_score,
        pv.computed_triage_score,
        pv.auto_triage_level,
        pv.recorded_at,
        ROUND(AVG(pv.spo2) OVER (
          PARTITION BY pv.admission_id
          ORDER BY pv.recorded_at
          ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
        ), 1) AS spo2_moving_avg
      FROM patient_vitals pv
      WHERE pv.admission_id = $1
      ORDER BY pv.recorded_at DESC
      LIMIT 100;
    `;

    const result = await db.query(queryText, [admissionId]);
    res.json({ vitals: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
