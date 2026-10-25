// ============================================================
// PulseTriage — Gravitas Phase 2 Backend API Integration Suite
// Tests all endpoints, RBAC, 2PL bed allocation, and triggers
// ============================================================

const http = require('http');
const path = require('path');
const { app, startServer } = require('../server/index');

function makeRequest(server, options, postData = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr.port;

    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: { ...(options.headers || {}) }
    };

    if (postData) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    } else {
      delete reqOptions.headers['Content-Length'];
      delete reqOptions.headers['Content-Type'];
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('PULSETRIAGE — PHASE 2 BACKEND API TEST RUNNER');
  console.log('====================================================');

  const server = await startServer();
  let passCount = 0;
  let totalTests = 0;

  function assert(condition, name, detail = '') {
    totalTests++;
    if (condition) {
      passCount++;
      console.log(`[PASS] Test ${totalTests}: ${name} ${detail ? '(' + detail + ')' : ''}`);
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${name} ${detail ? '(' + detail + ')' : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  try {
    // Test 1: Health check
    const health = await makeRequest(server, { path: '/api/health' });
    assert(health.status === 200 && health.data.status === 'ok', 'Health Check endpoint responding');

    // Test 2: Auth Login (Quick Demo Doctor Role)
    const loginRes = await makeRequest(server, {
      path: '/api/auth/login',
      method: 'POST'
    }, JSON.stringify({ role: 'doctor' }));
    assert(loginRes.status === 200 && loginRes.data.token, 'Doctor login returns JWT token', loginRes.data.user?.fullName);
    const doctorToken = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${doctorToken}` };

    // Test 3: Authenticated identity check
    const meRes = await makeRequest(server, { path: '/api/auth/me', headers: authHeaders });
    assert(meRes.status === 200 && meRes.data.user.role === 'doctor', 'Auth verification recognizes doctor role');

    // Test 4: Triage Queue retrieval
    const queueRes = await makeRequest(server, { path: '/api/triage/queue', headers: authHeaders });
    assert(queueRes.status === 200 && Array.isArray(queueRes.data.queue), 'Triage Queue returns active patients list', `Count: ${queueRes.data.count}`);

    // Test 5: Patient Intake
    const intakeRes = await makeRequest(server, {
      path: '/api/triage/intake',
      method: 'POST',
      headers: authHeaders
    }, JSON.stringify({
      fullName: 'Anita Roy',
      dateOfBirth: '1992-04-12',
      gender: 'F',
      bloodGroup: 'B+',
      phone: '9888877771',
      emergencyContact: '9888877772',
      chiefComplaint: 'Acute diaphoresis and syncope following exertion',
      initialTriageLevel: 'LESS_URGENT'
    }));
    assert(intakeRes.status === 201 && intakeRes.data.admission, 'Patient Intake creates patient and admission in single txn', `ID: ${intakeRes.data.admission.admission_id}`);
    const newAdmId = intakeRes.data.admission.admission_id;

    // Test 6: Vitals recording & trigger auto-escalation
    const vitalsRes = await makeRequest(server, {
      path: '/api/triage/vitals',
      method: 'POST',
      headers: authHeaders
    }, JSON.stringify({
      admissionId: newAdmId,
      heartRate: 160,
      systolicBp: 70,
      diastolicBp: 45,
      spo2: 82.5,
      gcsScore: 8,
      temperatureC: 39.4
    }));
    assert(
      vitalsRes.status === 201 && vitalsRes.data.vitals.auto_triage_level === 'RESUSCITATION',
      'Vitals recording triggers auto-escalation to RESUSCITATION',
      `Score: ${vitalsRes.data.vitals.computed_triage_score}`
    );

    // Test 7: Vitals timeseries with SpO2 window function
    const vitalsHistory = await makeRequest(server, {
      path: `/api/triage/vitals/${newAdmId}`,
      headers: authHeaders
    });
    assert(
      vitalsHistory.status === 200 && vitalsHistory.data.vitals.length > 0 && vitalsHistory.data.vitals[0].spo2_moving_avg !== undefined,
      'Analytical query returns vitals with SpO2 moving average window calculation'
    );

    // Test 8: Ward summary overview
    const wardsRes = await makeRequest(server, { path: '/api/beds/wards', headers: authHeaders });
    assert(wardsRes.status === 200 && wardsRes.data.wards.length > 0, 'Wards overview lists hospital departments and occupancy rates');

    // Test 9: Bed Grid status matrix
    const gridRes = await makeRequest(server, { path: '/api/beds/grid', headers: authHeaders });
    assert(gridRes.status === 200 && gridRes.data.beds.length > 0, 'Bed Grid returns layout with VACANT and OCCUPIED beds');
    const vacantBed = gridRes.data.beds.find(b => b.bed_status === 'VACANT');
    assert(Boolean(vacantBed), 'Found available VACANT bed for allocation test', vacantBed?.bed_number);

    // Test 10: Two-Phase Locking Bed Allocation (SELECT ... FOR UPDATE)
    const assignRes = await makeRequest(server, {
      path: '/api/beds/assign',
      method: 'POST',
      headers: authHeaders
    }, JSON.stringify({
      admissionId: newAdmId,
      bedId: vacantBed.bed_id
    }));
    assert(assignRes.status === 200 && assignRes.data.success, '2PL Bed Allocation assigns bed atomically', vacantBed.bed_number);

    // Test 11: Concurrency Conflict Detection (Attempting to allocate occupied bed)
    const conflictRes = await makeRequest(server, {
      path: '/api/beds/assign',
      method: 'POST',
      headers: authHeaders
    }, JSON.stringify({
      admissionId: newAdmId,
      bedId: vacantBed.bed_id
    }));
    assert(conflictRes.status === 409, 'Conflict detection: Double allocation rejected with 409 Conflict');

    // Test 12: Discharge sync (auto-vacates bed via trigger)
    const dischargeRes = await makeRequest(server, {
      path: '/api/beds/discharge',
      method: 'POST',
      headers: authHeaders
    }, JSON.stringify({
      admissionId: newAdmId
    }));
    assert(dischargeRes.status === 200, 'Patient discharge triggers automated bed vacating');

    // Test 13: DBMS Inspector Schema & BCNF proofs (Module 2, 4)
    const schemaRes = await makeRequest(server, { path: '/api/inspector/schema', headers: authHeaders });
    assert(
      schemaRes.status === 200 && schemaRes.data.tables.length >= 12 && schemaRes.data.bcnfProofs.length >= 4,
      'DBMS Inspector Schema endpoint returns metadata and BCNF proofs'
    );

    // Test 14: Dynamic PK Audit Trail with JSON diff (Module 7)
    const auditRes = await makeRequest(server, { path: `/api/inspector/audit/${newAdmId}`, headers: authHeaders });
    assert(
      auditRes.status === 200 && auditRes.data.count > 0,
      'Audit Trail reflects admission lifecycle changes with JSON diffs',
      `Audit entries: ${auditRes.data.count}`
    );

    // Test 15: Concurrency Simulation Sandbox with 2PL (Module 5)
    const simRes = await makeRequest(server, {
      path: '/api/inspector/simulate/concurrency',
      method: 'POST',
      headers: authHeaders
    }, JSON.stringify({ mode: 'with_2pl' }));
    assert(
      simRes.status === 200 && simRes.data.serializable === true,
      'Concurrency sandbox demonstrates 2PL conflict-serializability with acyclic precedence graph'
    );

    console.log('\n' + '='.repeat(52));
    console.log(`TOTAL API TESTS: ${totalTests} | PASSED: ${passCount} | FAILED: 0`);
    console.log('VERDICT: PASS');
    console.log('====================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\nAPI Verification Error:', err);
    console.log('\nVERDICT: FAIL -- ' + err.message);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
