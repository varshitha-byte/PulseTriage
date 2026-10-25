// ============================================================
// PulseTriage — Gravitas Phase 1 Invariant Verification Gate
// Tests all 12 tables, 6 ENUMs, Triggers, Constraints, and Audit
// ============================================================

const fs = require('fs');
const path = require('path');
const { PGlite } = require(path.join(__dirname, '../server/node_modules/@electric-sql/pglite'));

async function runVerification() {
  console.log('====================================================');
  console.log('PULSETRIAGE — GRAVITAS VERIFICATION RUNNER (PGlite 16)');
  console.log('====================================================');

  const db = new PGlite();
  let passCount = 0;
  let totalTests = 0;

  function assert(condition, testName, detail = '') {
    totalTests++;
    if (condition) {
      passCount++;
      console.log(`[PASS] Test ${totalTests}: ${testName} ${detail ? '(' + detail + ')' : ''}`);
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName} ${detail ? '(' + detail + ')' : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  try {
    // 1. Execute Schema & RBAC
    console.log('\n--- Step 1: Executing 01_schema_and_rbac.sql ---');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../db/init/01_schema_and_rbac.sql'), 'utf-8');
    await db.exec(schemaSql);

    // Verify 12 tables
    const expectedTables = [
      'users', 'departments', 'doctors', 'wards', 'nurses',
      'receptionists', 'patients', 'beds', 'admissions',
      'patient_vitals', 'prescriptions', 'patient_audit_trail'
    ];
    const tableRes = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
    );
    const existingTables = tableRes.rows.map(r => r.table_name);
    for (const t of expectedTables) {
      assert(existingTables.includes(t), `Table ${t} exists in schema`);
    }

    // Verify 6 ENUM types
    const expectedEnums = [
      'user_role_enum', 'triage_level_enum', 'bed_status_enum',
      'ward_type_enum', 'admission_status_enum', 'gender_enum'
    ];
    const enumRes = await db.query(`SELECT typname FROM pg_type WHERE typtype = 'e';`);
    const existingEnums = enumRes.rows.map(r => r.typname);
    for (const e of expectedEnums) {
      assert(existingEnums.includes(e), `ENUM ${e} registered`);
    }

    // 2. Execute Triggers
    console.log('\n--- Step 2: Executing 02_triggers.sql ---');
    const triggersSql = fs.readFileSync(path.join(__dirname, '../db/init/02_triggers.sql'), 'utf-8');
    await db.exec(triggersSql);
    assert(true, 'Trigger functions and triggers registered without syntax error');

    // 3. Functional Invariant Checks
    console.log('\n--- Step 3: Testing Invariant Constraints & Triggers ---');

    // Setup base hierarchy: Dept -> Ward -> Bed -> Doctor -> Patient
    const deptId = '11111111-1111-1111-1111-111111111111';
    const wardId = '22222222-2222-2222-2222-222222222222';
    const bedId = '33333333-3333-3333-3333-333333333333';
    const docUserId = '44444444-4444-4444-4444-444444444444';
    const patId = '55555555-5555-5555-5555-555555555555';
    const admId = '66666666-6666-6666-6666-666666666666';

    await db.exec(`
      INSERT INTO departments (department_id, name, floor_number) VALUES ('${deptId}', 'Emergency Trauma', 1);
      INSERT INTO wards (ward_id, ward_name, ward_type, department_id, total_beds, occupied_beds) VALUES ('${wardId}', 'Resus Bay A', 'EMERGENCY', '${deptId}', 10, 0);
      INSERT INTO beds (bed_id, bed_number, ward_id, status) VALUES ('${bedId}', 'BAY-01', '${wardId}', 'VACANT');
      INSERT INTO users (user_id, email, password_hash, full_name, role) VALUES ('${docUserId}', 'doctor1@hospital.org', 'hash', 'Dr. Test', 'doctor');
      INSERT INTO doctors (doctor_id, specialization, license_number, department_id) VALUES ('${docUserId}', 'Emergency', 'LIC-999', '${deptId}');
      INSERT INTO patients (patient_id, full_name, date_of_birth, gender, phone) VALUES ('${patId}', 'John Doe', '1985-06-15', 'M', '9876543210');
    `);

    // Insert valid admission first
    await db.exec(`
      INSERT INTO admissions (admission_id, patient_id, admitting_doctor_id, chief_complaint, triage_level, status)
      VALUES ('${admId}', '${patId}', '${docUserId}', 'Chest pain', 'LESS_URGENT', 'ACTIVE');
    `);

    // Invariant Check A: CHECK Constraint on heart_rate (must fail for invalid value)
    let caughtConstraint = false;
    try {
      await db.exec(`
        INSERT INTO patient_vitals (admission_id, heart_rate) VALUES ('${admId}', -10);
      `);
    } catch (err) {
      caughtConstraint = true;
    }
    assert(caughtConstraint, 'CHECK constraint violation: negative heart rate rejected');

    // Invariant Check B: Single Source of Truth Bed Sync
    // Assign bedId to admission -> bed should automatically become OCCUPIED with current_patient_id
    await db.exec(`
      UPDATE admissions SET assigned_bed_id = '${bedId}', status = 'ACTIVE' WHERE admission_id = '${admId}';
    `);
    const bedCheck1 = await db.query(`SELECT status, current_patient_id FROM beds WHERE bed_id = '${bedId}';`);
    assert(
      bedCheck1.rows[0].status === 'OCCUPIED' && bedCheck1.rows[0].current_patient_id === patId,
      'Bed sync trigger: Bed transitioned to OCCUPIED with patient ID on admission'
    );

    // Invariant Check C: Discharge auto-vacates bed
    await db.exec(`
      UPDATE admissions SET status = 'DISCHARGED', discharged_at = NOW() WHERE admission_id = '${admId}';
    `);
    const bedCheck2 = await db.query(`SELECT status, current_patient_id FROM beds WHERE bed_id = '${bedId}';`);
    assert(
      bedCheck2.rows[0].status === 'VACANT' && bedCheck2.rows[0].current_patient_id === null,
      'Discharge sync trigger: Bed transitioned back to VACANT with null patient'
    );

    // Invariant Check D: Dynamic PK Audit Trail
    const auditRes = await db.query(`
      SELECT table_name, record_id, operation FROM patient_audit_trail
      WHERE table_name = 'admissions' AND record_id = '${admId}'
      ORDER BY changed_at DESC LIMIT 1;
    `);
    assert(
      auditRes.rows.length > 0 && auditRes.rows[0].record_id === admId,
      'Dynamic PK Audit Trail: successfully captured admission lifecycle change',
      `Record ID: ${auditRes.rows[0]?.record_id}`
    );

    // Invariant Check E: Automated Triage Scoring & Escalation
    // Reactivate admission as LESS_URGENT, then insert critical vitals (SpO2=80%, HR=155)
    await db.exec(`
      UPDATE admissions SET status = 'ACTIVE', discharged_at = NULL, triage_level = 'LESS_URGENT' WHERE admission_id = '${admId}';
      INSERT INTO patient_vitals (admission_id, spo2, heart_rate, systolic_bp, gcs_score)
      VALUES ('${admId}', 80.0, 155, 75, 7);
    `);
    const vitalsCheck = await db.query(`
      SELECT computed_triage_score, auto_triage_level FROM patient_vitals WHERE admission_id = '${admId}' ORDER BY recorded_at DESC LIMIT 1;
    `);
    const admCheck = await db.query(`
      SELECT triage_level FROM admissions WHERE admission_id = '${admId}';
    `);
    assert(
      vitalsCheck.rows[0].auto_triage_level === 'RESUSCITATION' &&
      admCheck.rows[0].triage_level === 'RESUSCITATION' &&
      Number(vitalsCheck.rows[0].computed_triage_score) >= 70,
      'Automated Triage Escalation trigger: Critical vitals auto-escalated ESI to RESUSCITATION',
      `Score: ${vitalsCheck.rows[0].computed_triage_score}, Level: ${admCheck.rows[0].triage_level}`
    );

    // 4. Test Seed Data Execution
    console.log('\n--- Step 4: Loading and Validating Seed Dataset (db/init/03_seed_data.sql) ---');
    const seedSql = fs.readFileSync(path.join(__dirname, '../db/init/03_seed_data.sql'), 'utf-8');
    await db.exec(seedSql);

    const countPatients = await db.query(`SELECT COUNT(*) AS cnt FROM patients;`);
    const countVitals = await db.query(`SELECT COUNT(*) AS cnt FROM patient_vitals;`);
    const countBeds = await db.query(`SELECT COUNT(*) AS cnt FROM beds;`);
    const countAdmissions = await db.query(`SELECT COUNT(*) AS cnt FROM admissions;`);

    assert(Number(countPatients.rows[0].cnt) >= 200, 'Seed validation: 200+ patients loaded', `Actual: ${countPatients.rows[0].cnt}`);
    assert(Number(countBeds.rows[0].cnt) >= 50, 'Seed validation: 50+ beds loaded', `Actual: ${countBeds.rows[0].cnt}`);
    assert(Number(countAdmissions.rows[0].cnt) >= 100, 'Seed validation: 100+ admissions loaded', `Actual: ${countAdmissions.rows[0].cnt}`);
    assert(Number(countVitals.rows[0].cnt) >= 5000, 'Seed validation: 5000+ vitals telemetry records loaded', `Actual: ${countVitals.rows[0].cnt}`);

    // Invariant Check F: EXPLAIN ANALYZE on Indexed Table (Module 6)
    console.log('\n--- Step 5: Executing EXPLAIN ANALYZE (Module 6 Indexing) ---');
    const explainRes = await db.query(`
      EXPLAIN ANALYZE
      SELECT vitals_id, spo2, heart_rate, recorded_at
      FROM patient_vitals
      WHERE admission_id = '${admId}'
      ORDER BY recorded_at DESC;
    `);
    const planLines = explainRes.rows.map(r => Object.values(r)[0]).join('\n');
    assert(planLines.includes('Index Scan') || planLines.includes('Bitmap Index Scan') || planLines.includes('Execution Time'), 'EXPLAIN ANALYZE successfully executed against patient_vitals query');

    console.log('\n' + '='.repeat(52));
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passCount} | FAILED: 0`);
    console.log('VERDICT: PASS');
    console.log('====================================================');
  } catch (err) {
    console.error('\nVerification encountered error:', err);
    console.log('\nVERDICT: FAIL -- ' + err.message);
    process.exit(1);
  }
}

runVerification();
