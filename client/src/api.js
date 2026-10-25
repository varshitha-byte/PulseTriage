// ============================================================
// PulseTriage — Frontend API Client (client/src/api.js)
// ============================================================

const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('pulse_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// Authentication
export async function login(role = 'doctor', email = null) {
  const payload = email ? { email } : { role };
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (res.token) {
    localStorage.setItem('pulse_token', res.token);
    localStorage.setItem('pulse_user', JSON.stringify(res.user));
  }
  return res;
}

export async function getCurrentUser() {
  return request('/auth/me');
}

export async function getDemoUsers() {
  return request('/auth/demo-users');
}

// Triage Queue & Vitals
export async function getTriageQueue() {
  return request('/triage/queue');
}

export async function submitPatientIntake(formData) {
  return request('/triage/intake', {
    method: 'POST',
    body: JSON.stringify(formData)
  });
}

export async function submitVitals(vitalsData) {
  return request('/triage/vitals', {
    method: 'POST',
    body: JSON.stringify(vitalsData)
  });
}

export async function getVitalsHistory(admissionId) {
  return request(`/triage/vitals/${admissionId}`);
}

// Beds & Wards
export async function getWardsOverview() {
  return request('/beds/wards');
}

export async function getBedGrid() {
  return request('/beds/grid');
}

export async function assignBed(admissionId, bedId) {
  return request('/beds/assign', {
    method: 'POST',
    body: JSON.stringify({ admissionId, bedId })
  });
}

export async function dischargePatient(admissionId) {
  return request('/beds/discharge', {
    method: 'POST',
    body: JSON.stringify({ admissionId })
  });
}

// DBMS Inspector Endpoints
export async function getSchemaCatalog() {
  return request('/inspector/schema');
}

export async function getAuditTrail(recordId) {
  return request(`/inspector/audit/${recordId}`);
}

export async function runExplainAnalyze(admissionId = null) {
  return request('/inspector/explain', {
    method: 'POST',
    body: JSON.stringify({ admissionId })
  });
}

export async function runConcurrencySimulation(mode, bedNumber = 'BAY-01') {
  return request('/inspector/simulate/concurrency', {
    method: 'POST',
    body: JSON.stringify({ mode, bedNumber })
  });
}
