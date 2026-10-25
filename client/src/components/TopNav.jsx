import React from 'react';
import { Activity, Shield, Database, PlusCircle, UserCheck, LayoutGrid, Users } from 'lucide-react';

export function TopNav({
  activeView,
  setActiveView,
  currentUser,
  onSwitchRole,
  onOpenIntake,
  onOpenInspector,
  stats
}) {
  const roles = [
    { key: 'doctor', label: 'Doctor', color: '#06B6D4', dbRole: 'doctor_role' },
    { key: 'nurse', label: 'Nurse', color: '#10B981', dbRole: 'nurse_role' },
    { key: 'receptionist', label: 'Receptionist', color: '#F59E0B', dbRole: 'receptionist_role' },
    { key: 'admin', label: 'Admin', color: '#A855F7', dbRole: 'admin_role' }
  ];

  return (
    <header style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand & System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
            }}>
              <Activity size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#F8FAFC' }}>
                  Pulse<span style={{ color: '#06B6D4' }}>Triage</span>
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: '#06B6D4',
                  fontWeight: 600,
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }}>
                  v2.0 ACID
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                CS302 / AD302 DBMS Flagship Project
              </span>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <nav style={{
            display: 'flex',
            background: 'var(--bg-primary)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginLeft: '1rem'
          }}>
            <button
              onClick={() => setActiveView('queue')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeView === 'queue' ? '#F8FAFC' : 'var(--text-secondary)',
                background: activeView === 'queue' ? 'var(--bg-elevated)' : 'transparent'
              }}
            >
              <Users size={16} />
              Triage Queue
              {stats.activeCount > 0 && (
                <span style={{
                  background: '#06B6D4',
                  color: '#0B0F17',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  {stats.activeCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveView('beds')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: activeView === 'beds' ? '#F8FAFC' : 'var(--text-secondary)',
                background: activeView === 'beds' ? 'var(--bg-elevated)' : 'transparent'
              }}
            >
              <LayoutGrid size={16} />
              Ward Beds
              <span style={{
                background: stats.occupancyRate > 80 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                color: stats.occupancyRate > 80 ? '#EF4444' : '#10B981',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {stats.occupiedBeds}/{stats.totalBeds}
              </span>
            </button>
          </nav>
        </div>

        {/* Live Metrics Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Critical Resuscitation Counter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: stats.criticalCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: stats.criticalCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: stats.criticalCount > 0 ? '#EF4444' : '#10B981',
              display: 'inline-block'
            }} className={stats.criticalCount > 0 ? 'pulse-resus' : ''} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Critical Acuity:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: stats.criticalCount > 0 ? '#EF4444' : '#F8FAFC' }}>
              {stats.criticalCount}
            </span>
          </div>

          {/* Quick RBAC Role Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-primary)',
            padding: '2px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              padding: '0 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Shield size={12} /> RBAC:
            </span>
            {roles.map((r) => {
              const isActive = currentUser?.role === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => onSwitchRole(r.key)}
                  title={`Switch to ${r.label} (Executes: SET ROLE ${r.dbRole})`}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isActive ? '#0B0F17' : 'var(--text-secondary)',
                    background: isActive ? r.color : 'transparent',
                    boxShadow: isActive ? `0 0 10px ${r.color}55` : 'none'
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <button
            onClick={onOpenIntake}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
              color: '#0B0F17',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.35)'
            }}
          >
            <PlusCircle size={16} />
            Patient Intake
          </button>

          <button
            onClick={onOpenInspector}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: '#F59E0B',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.15)'
            }}
          >
            <Database size={16} />
            DBMS Inspector
          </button>
        </div>
      </div>
    </header>
  );
}
