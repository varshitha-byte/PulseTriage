import React, { useState } from 'react';
import { Bed, UserCheck, ShieldAlert, CheckCircle2, Lock, AlertCircle } from 'lucide-react';

export function WardBedGrid({
  wards,
  beds,
  onAssignBedToPatient,
  selectedPatientForBed,
  onCancelSelection
}) {
  const [selectedWard, setSelectedWard] = useState('ALL');

  const filteredBeds = selectedWard === 'ALL'
    ? beds
    : beds.filter((b) => b.ward_id === selectedWard);

  function getStatusBadge(status) {
    switch (status) {
      case 'VACANT':
        return { label: 'VACANT', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'OCCUPIED':
        return { label: 'OCCUPIED', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'RESERVED':
        return { label: 'RESERVED', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'MAINTENANCE':
        return { label: 'MAINTENANCE', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' };
      default:
        return { label: status, color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
    }
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Target Allocation Banner (if nurse clicked "Bed" from queue) */}
      {selectedPatientForBed && (
        <div style={{
          background: 'rgba(6, 182, 212, 0.15)',
          border: '1px solid #06B6D4',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#06B6D4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0B0F17'
            }}>
              <Bed size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F8FAFC' }}>
                Select a VACANT bed for: {selectedPatientForBed.patient_name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#06B6D4' }}>
                Triage Acuity: {selectedPatientForBed.triage_level} • Executes atomic <code>SELECT ... FOR UPDATE</code>
              </div>
            </div>
          </div>

          <button
            onClick={onCancelSelection}
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Ward Filter Bar & Capacity Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedWard('ALL')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: selectedWard === 'ALL' ? '#06B6D4' : 'var(--bg-secondary)',
              color: selectedWard === 'ALL' ? '#0B0F17' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            All Wards ({beds.length} Beds)
          </button>

          {wards.map((w) => (
            <button
              key={w.ward_id}
              onClick={() => setSelectedWard(w.ward_id)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: selectedWard === w.ward_id ? '#06B6D4' : 'var(--bg-secondary)',
                color: selectedWard === w.ward_id ? '#0B0F17' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {w.ward_name} ({w.occupied_beds}/{w.total_beds})
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10B981' }} /> Vacant
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#EF4444' }} /> Occupied
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#F59E0B' }} /> Reserved
          </span>
        </div>
      </div>

      {/* Bed Grid Matrix */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: '1rem'
      }}>
        {filteredBeds.map((bed) => {
          const badge = getStatusBadge(bed.bed_status);
          const isVacant = bed.bed_status === 'VACANT';
          const isSelectedTarget = selectedPatientForBed && isVacant;

          return (
            <div
              key={bed.bed_id}
              className={`card-elevation ${isSelectedTarget ? 'pulse-resus' : ''}`}
              style={{
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                borderColor: isSelectedTarget ? '#06B6D4' : (bed.bed_status === 'OCCUPIED' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'),
                background: isSelectedTarget ? 'rgba(6, 182, 212, 0.05)' : 'var(--bg-card)'
              }}
            >
              {/* Header: Bed Number & Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: '#F8FAFC'
                }}>
                  {bed.bed_number}
                </span>

                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: badge.color,
                  background: badge.bg,
                  border: `1px solid ${badge.color}40`
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Ward Details */}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {bed.ward_name} ({bed.ward_type})
              </div>

              {/* Patient info if occupied */}
              {bed.current_patient_name ? (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  marginTop: '0.2rem'
                }}>
                  <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
                    {bed.current_patient_name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    Acuity: <strong style={{ color: '#EF4444' }}>{bed.triage_level || 'Active'}</strong>
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  padding: '0.5rem 0'
                }}>
                  Available for admission
                </div>
              )}

              {/* Action button if patient selected */}
              {selectedPatientForBed && isVacant && (
                <button
                  onClick={() => onAssignBedToPatient(selectedPatientForBed.admission_id, bed.bed_id)}
                  style={{
                    marginTop: 'auto',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    background: '#10B981',
                    color: '#0B0F17',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Lock size={14} /> Allocate with 2PL Lock
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
