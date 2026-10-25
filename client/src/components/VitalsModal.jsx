import React, { useState, useEffect } from 'react';
import { X, Activity, Zap, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { submitVitals, getVitalsHistory } from '../api';

export function VitalsModal({ patient, onClose, onVitalsSubmitted }) {
  const [formData, setFormData] = useState({
    heartRate: patient.heart_rate || 78,
    systolicBp: patient.systolic_bp || 120,
    diastolicBp: patient.diastolic_bp || 80,
    spo2: patient.spo2 || 98.0,
    temperatureC: patient.temperature_c || 37.0,
    respiratoryRate: 16,
    gcsScore: 15
  });

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [patient.admission_id]);

  async function loadHistory() {
    try {
      const data = await getVitalsHistory(patient.admission_id);
      setHistory(data.vitals || []);
    } catch (err) {
      console.warn('Could not load vitals history:', err.message);
    }
  }

  function handlePreset(type) {
    if (type === 'CRITICAL') {
      // Triggers auto-escalation trigger in PostgreSQL
      setFormData({
        heartRate: 155,
        systolicBp: 70,
        diastolicBp: 42,
        spo2: 81.5,
        temperatureC: 39.5,
        respiratoryRate: 30,
        gcsScore: 7
      });
    } else {
      setFormData({
        heartRate: 74,
        systolicBp: 118,
        diastolicBp: 78,
        spo2: 99.0,
        temperatureC: 36.8,
        respiratoryRate: 14,
        gcsScore: 15
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await submitVitals({
        admissionId: patient.admission_id,
        heartRate: Number(formData.heartRate),
        systolicBp: Number(formData.systolicBp),
        diastolicBp: Number(formData.diastolicBp),
        spo2: Number(formData.spo2),
        temperatureC: Number(formData.temperatureC),
        respiratoryRate: Number(formData.respiratoryRate),
        gcsScore: Number(formData.gcsScore)
      });
      await loadHistory();
      onVitalsSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="#06B6D4" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F8FAFC' }}>
                Physiological Vitals Telemetry
              </h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Patient: <strong>{patient.patient_name}</strong> • Current Acuity: <strong style={{ color: '#EF4444' }}>{patient.triage_level}</strong>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Simulation Presets */}
          <div style={{
            background: 'var(--bg-primary)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={14} color="#F59E0B" /> Demo Simulation Presets:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handlePreset('CRITICAL')}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                ⚠️ Simulate Critical Shock (SpO2 &lt; 85%)
              </button>

              <button
                type="button"
                onClick={() => handlePreset('STABLE')}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                Normal Vitals
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                SpO2 Percent (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.spo2}
                onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: formData.spo2 < 90 ? '#EF4444' : '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Heart Rate (bpm)
              </label>
              <input
                type="number"
                min="20"
                max="300"
                value={formData.heartRate}
                onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Systolic BP (mmHg)
              </label>
              <input
                type="number"
                min="30"
                max="350"
                value={formData.systolicBp}
                onChange={(e) => setFormData({ ...formData, systolicBp: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Diastolic BP (mmHg)
              </label>
              <input
                type="number"
                min="20"
                max="250"
                value={formData.diastolicBp}
                onChange={(e) => setFormData({ ...formData, diastolicBp: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                min="25"
                max="45"
                value={formData.temperatureC}
                onChange={(e) => setFormData({ ...formData, temperatureC: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Glasgow Coma Scale (GCS)
              </label>
              <input
                type="number"
                min="3"
                max="15"
                value={formData.gcsScore}
                onChange={(e) => setFormData({ ...formData, gcsScore: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {error && (
              <div style={{
                gridColumn: 'span 3',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem'
                }}
              >
                Close
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#06B6D4',
                  color: '#0B0F17',
                  padding: '0.5rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Activity size={16} />
                {loading ? 'Evaluating Trigger...' : 'Record Telemetry'}
              </button>
            </div>
          </form>

          {/* Vitals History & Window Function Moving Average */}
          {history.length > 0 && (
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} color="#06B6D4" /> Telemetry Timeseries & SpO2 Moving Average (Module 3)
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  SQL: <code>AVG(spo2) OVER (ROWS BETWEEN 5 PRECEDING AND CURRENT ROW)</code>
                </span>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>Time</th>
                      <th style={{ padding: '4px 6px' }}>SpO2</th>
                      <th style={{ padding: '4px 6px' }}>5-pt Mov Avg</th>
                      <th style={{ padding: '4px 6px' }}>HR</th>
                      <th style={{ padding: '4px 6px' }}>BP</th>
                      <th style={{ padding: '4px 6px' }}>Score</th>
                      <th style={{ padding: '4px 6px' }}>Calculated Acuity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((v) => (
                      <tr key={v.vitals_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>
                          {new Date(v.recorded_at).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '4px 6px', fontWeight: 700, color: v.spo2 < 90 ? '#EF4444' : '#F8FAFC' }}>
                          {v.spo2}%
                        </td>
                        <td style={{ padding: '4px 6px', color: '#06B6D4', fontWeight: 600 }}>
                          {v.spo2_moving_avg}%
                        </td>
                        <td style={{ padding: '4px 6px' }}>{v.heart_rate} bpm</td>
                        <td style={{ padding: '4px 6px' }}>{v.systolic_bp}/{v.diastolic_bp}</td>
                        <td style={{ padding: '4px 6px', fontWeight: 700 }}>{v.computed_triage_score}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: v.auto_triage_level === 'RESUSCITATION' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: v.auto_triage_level === 'RESUSCITATION' ? '#EF4444' : '#10B981'
                          }}>
                            {v.auto_triage_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
