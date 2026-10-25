import React, { useState } from 'react';
import { X, UserPlus, Zap } from 'lucide-react';
import { submitPatientIntake } from '../api';

export function IntakeModal({ onClose, onIntakeSuccess }) {
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    bloodGroup: 'O+',
    phone: '',
    emergencyContact: '',
    chiefComplaint: '',
    initialTriageLevel: 'LESS_URGENT'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function loadPreset(type) {
    if (type === 'CHEST_PAIN') {
      setFormData({
        fullName: 'Rajesh Mehra',
        dateOfBirth: '1968-07-22',
        gender: 'M',
        bloodGroup: 'B+',
        phone: '9870011223',
        emergencyContact: '9870011224',
        chiefComplaint: 'Crushing sub-sternal chest pain radiating to left shoulder, diaphoresis',
        initialTriageLevel: 'EMERGENT'
      });
    } else if (type === 'TRAUMA') {
      setFormData({
        fullName: 'Vikram Singh',
        dateOfBirth: '1995-11-04',
        gender: 'M',
        bloodGroup: 'O-',
        phone: '9812233445',
        emergencyContact: '9812233446',
        chiefComplaint: 'High-speed motor vehicle collision, thoracic trauma, suspected pneumothorax',
        initialTriageLevel: 'RESUSCITATION'
      });
    } else {
      setFormData({
        fullName: 'Suman Rao',
        dateOfBirth: '2001-03-19',
        gender: 'F',
        bloodGroup: 'A+',
        phone: '9899988877',
        emergencyContact: '9899988878',
        chiefComplaint: 'Mild allergic rash and localized urticaria on forearms',
        initialTriageLevel: 'LESS_URGENT'
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await submitPatientIntake(formData);
      onIntakeSuccess();
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
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} color="#06B6D4" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F8FAFC' }}>
              Emergency Patient Intake & Triage
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Presets */}
          <div style={{
            background: 'var(--bg-primary)',
            padding: '0.65rem 0.9rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={13} color="#F59E0B" /> Quick Clinical Cases:
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => loadPreset('TRAUMA')}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#EF4444',
                  padding: '3px 7px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}
              >
                Trauma / Resus
              </button>
              <button
                type="button"
                onClick={() => loadPreset('CHEST_PAIN')}
                style={{
                  background: 'rgba(249, 115, 22, 0.2)',
                  color: '#F97316',
                  padding: '3px 7px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}
              >
                Cardiac / Emergent
              </button>
              <button
                type="button"
                onClick={() => loadPreset('MINOR')}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10B981',
                  padding: '3px 7px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600
                }}
              >
                Stable Walk-in
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Patient Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Blood Group
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem'
                  }}
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Emergency Contact
                </label>
                <input
                  type="tel"
                  placeholder="Relative phone"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#F8FAFC',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Chief Complaint & Presentation Notes
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe presenting symptoms, onset duration, and clinical observations..."
                value={formData.chiefComplaint}
                onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontSize: '0.85rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Initial Triage Acuity Assessment (ESI Level)
              </label>
              <select
                value={formData.initialTriageLevel}
                onChange={(e) => setFormData({ ...formData, initialTriageLevel: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: '#F8FAFC',
                  fontSize: '0.85rem'
                }}
              >
                <option value="RESUSCITATION">Level 1: Resuscitation (Immediate)</option>
                <option value="EMERGENT">Level 2: Emergent (&lt; 10 mins)</option>
                <option value="URGENT">Level 3: Urgent (&lt; 30 mins)</option>
                <option value="LESS_URGENT">Level 4: Less Urgent (&lt; 60 mins)</option>
                <option value="NON_URGENT">Level 5: Non-Urgent (&lt; 120 mins)</option>
              </select>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
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
                Cancel
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
                  fontWeight: 700
                }}
              >
                {loading ? 'Admitting Patient...' : 'Complete Intake'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
