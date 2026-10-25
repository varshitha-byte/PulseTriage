import React from 'react';
import { Clock, Heart, Activity, AlertTriangle, Bed, CheckCircle2, History, ChevronRight } from 'lucide-react';

export function TriageQueue({
  queue,
  onOpenVitals,
  onOpenBedAssign,
  onDischarge,
  onOpenAudit,
  currentUser
}) {
  const columns = [
    {
      level: 'RESUSCITATION',
      title: 'Level 1: Resuscitation',
      color: 'var(--triage-resuscitation)',
      bgHeader: 'rgba(239, 68, 68, 0.15)',
      description: 'Immediate life-saving intervention needed',
      waitTime: '0 min'
    },
    {
      level: 'EMERGENT',
      title: 'Level 2: Emergent',
      color: 'var(--triage-emergent)',
      bgHeader: 'rgba(249, 115, 22, 0.15)',
      description: 'High risk, severe pain, lethargic',
      waitTime: '< 10 min'
    },
    {
      level: 'URGENT',
      title: 'Level 3: Urgent',
      color: 'var(--triage-urgent)',
      bgHeader: 'rgba(245, 158, 11, 0.15)',
      description: 'Stable vitals, multiple diagnostic resources',
      waitTime: '< 30 min'
    },
    {
      level: 'LESS_URGENT',
      title: 'Level 4: Less Urgent',
      color: 'var(--triage-less-urgent)',
      bgHeader: 'rgba(16, 185, 129, 0.15)',
      description: 'Requires one diagnostic resource',
      waitTime: '< 60 min'
    },
    {
      level: 'NON_URGENT',
      title: 'Level 5: Non-Urgent',
      color: 'var(--triage-non-urgent)',
      bgHeader: 'rgba(59, 130, 246, 0.15)',
      description: 'Routine, minor or chronic complaints',
      waitTime: '< 120 min'
    }
  ];

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getWaitMinutes(admittedAt) {
    if (!admittedAt) return 0;
    const diffMs = Date.now() - new Date(admittedAt).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60)));
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
      gap: '1rem',
      padding: '1.5rem',
      maxWidth: '1800px',
      margin: '0 auto',
      alignItems: 'start'
    }}>
      {columns.map((col) => {
        const patients = queue.filter((p) => p.triage_level === col.level);
        const isResus = col.level === 'RESUSCITATION';

        return (
          <div
            key={col.level}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: isResus ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: isResus ? '0 0 25px rgba(239, 68, 68, 0.15)' : 'none'
            }}
          >
            {/* Column Header */}
            <div style={{
              background: col.bgHeader,
              padding: '0.85rem 1rem',
              borderBottom: `2px solid ${col.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: col.color,
                    display: 'inline-block'
                  }} className={isResus && patients.length > 0 ? 'pulse-resus' : ''} />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC' }}>
                    {col.title}
                  </h3>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Target Wait: {col.waitTime}
                </div>
              </div>
              <span style={{
                background: col.color,
                color: '#0B0F17',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {patients.length}
              </span>
            </div>

            {/* Column Cards Container */}
            <div style={{
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              minHeight: '400px',
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto'
            }}>
              {patients.length === 0 ? (
                <div style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  No active patients in this category
                </div>
              ) : (
                patients.map((p) => {
                  const waitMins = getWaitMinutes(p.admitted_at);
                  const hasBed = Boolean(p.assigned_bed_id);

                  return (
                    <div
                      key={p.admission_id}
                      className={`card-elevation fade-in-entry ${isResus ? 'pulse-resus' : ''}`}
                      style={{
                        padding: '0.9rem',
                        borderLeft: `4px solid ${col.color}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      {/* Patient Demographic & Wait time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F8FAFC' }}>
                            {p.patient_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {p.age} yrs • {p.gender} • {p.blood_group}
                          </div>
                        </div>

                        {/* Bed Badge */}
                        {hasBed ? (
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)'
                          }}>
                            <Bed size={12} /> {p.bed_number}
                          </span>
                        ) : (
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#F59E0B',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600
                          }}>
                            <Clock size={12} /> Awaiting Bed
                          </span>
                        )}
                      </div>

                      {/* Chief Complaint */}
                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        lineHeight: 1.35
                      }}>
                        "{p.chief_complaint}"
                      </div>

                      {/* Vitals Telemetry Pills */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.35rem',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        <div style={{
                          background: 'var(--bg-primary)',
                          padding: '3px 5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <span style={{ color: 'var(--text-muted)' }}>SpO2: </span>
                          <strong style={{
                            color: p.spo2 < 90 ? '#EF4444' : p.spo2 < 95 ? '#F59E0B' : '#10B981'
                          }}>
                            {p.spo2 !== null && p.spo2 !== undefined ? `${p.spo2}%` : '--'}
                          </strong>
                        </div>

                        <div style={{
                          background: 'var(--bg-primary)',
                          padding: '3px 5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <span style={{ color: 'var(--text-muted)' }}>HR: </span>
                          <strong style={{
                            color: p.heart_rate > 130 || p.heart_rate < 50 ? '#EF4444' : '#F8FAFC'
                          }}>
                            {p.heart_rate || '--'}
                          </strong>
                        </div>

                        <div style={{
                          background: 'var(--bg-primary)',
                          padding: '3px 5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <span style={{ color: 'var(--text-muted)' }}>BP: </span>
                          <strong style={{ color: '#F8FAFC' }}>
                            {p.systolic_bp && p.diastolic_bp ? `${p.systolic_bp}/${p.diastolic_bp}` : '--'}
                          </strong>
                        </div>
                      </div>

                      {/* Footer: Wait Time & Quick Actions */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.2rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--border-subtle)'
                      }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Wait: <strong style={{ color: '#F8FAFC' }}>{waitMins}m</strong> (arr {formatTime(p.admitted_at)})
                        </span>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => onOpenVitals(p)}
                            title="Record or inspect vitals telemetry"
                            style={{
                              background: 'var(--bg-elevated)',
                              color: '#06B6D4',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}
                          >
                            + Vitals
                          </button>

                          {!hasBed ? (
                            <button
                              onClick={() => onOpenBedAssign(p)}
                              title="Allocate bed using Two-Phase Locking"
                              style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                padding: '3px 7px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}
                            >
                              Bed
                            </button>
                          ) : (
                            <button
                              onClick={() => onDischarge(p.admission_id)}
                              title="Discharge patient (auto-vacates bed via trigger)"
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#EF4444',
                                padding: '3px 7px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 600
                              }}
                            >
                              Discharge
                            </button>
                          )}

                          <button
                            onClick={() => onOpenAudit(p.admission_id)}
                            title="Inspect temporal audit trail for this patient"
                            style={{
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              padding: '3px 5px',
                              borderRadius: '4px',
                              fontSize: '0.72rem'
                            }}
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
