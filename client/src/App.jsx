import React, { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { TriageQueue } from './components/TriageQueue';
import { WardBedGrid } from './components/WardBedGrid';
import { VitalsModal } from './components/VitalsModal';
import { IntakeModal } from './components/IntakeModal';
import { InspectorDrawer } from './components/InspectorDrawer';
import { login, getCurrentUser, getTriageQueue, getWardsOverview, getBedGrid, assignBed, dischargePatient } from './api';

export function App() {
  const [activeView, setActiveView] = useState('queue');
  const [currentUser, setCurrentUser] = useState(null);
  const [queue, setQueue] = useState([]);
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Panels
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState(null);
  const [targetPatientForBed, setTargetPatientForBed] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorAdmissionId, setInspectorAdmissionId] = useState(null);
  const [alertNotification, setAlertNotification] = useState(null);

  useEffect(() => {
    initApp();
  }, []);

  // SSE Real-Time Listener
  useEffect(() => {
    let eventSource = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('critical_alert', (e) => {
        try {
          const data = JSON.parse(e.data);
          showAlert(`🚨 CRITICAL ALERT: Patient escalated to ${data.triage_level}! SpO2: ${data.spo2}%, HR: ${data.heart_rate}`);
          loadData();
        } catch (err) {}
      });
      eventSource.addEventListener('vitals_updated', () => loadData());
      eventSource.addEventListener('bed_allocated', () => loadData());
      eventSource.addEventListener('patient_discharged', () => loadData());
      eventSource.addEventListener('new_admission', () => loadData());
    } catch (err) {
      console.warn('SSE not connected:', err.message);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  function showAlert(msg) {
    setAlertNotification(msg);
    setTimeout(() => setAlertNotification(null), 6000);
  }

  async function initApp() {
    try {
      // Auto-login default Doctor role
      const auth = await login('doctor');
      setCurrentUser(auth.user);
      await loadData();
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      const [queueRes, wardsRes, bedsRes] = await Promise.all([
        getTriageQueue(),
        getWardsOverview(),
        getBedGrid()
      ]);
      setQueue(queueRes.queue || []);
      setWards(wardsRes.wards || []);
      setBeds(bedsRes.beds || []);
    } catch (err) {
      console.error('Failed to load clinic data:', err);
    }
  }

  async function handleSwitchRole(role) {
    try {
      const auth = await login(role);
      setCurrentUser(auth.user);
      showAlert(`Switched role to ${role.toUpperCase()} (PostgreSQL SET ROLE: ${role}_role)`);
      await loadData();
    } catch (err) {
      alert(`Role switch error: ${err.message}`);
    }
  }

  async function handleAssignBed(admissionId, bedId) {
    try {
      await assignBed(admissionId, bedId);
      setTargetPatientForBed(null);
      showAlert('Bed allocated successfully via Two-Phase Locking (SELECT ... FOR UPDATE)');
      await loadData();
    } catch (err) {
      alert(`Allocation failed: ${err.message}`);
    }
  }

  async function handleDischarge(admissionId) {
    if (!window.confirm('Are you sure you want to discharge this patient? This triggers bed auto-vacation.')) {
      return;
    }
    try {
      await dischargePatient(admissionId);
      showAlert('Patient discharged. Bed automatically vacated via PostgreSQL trigger.');
      await loadData();
    } catch (err) {
      alert(`Discharge error: ${err.message}`);
    }
  }

  // Calculate high-level stats
  const activeCount = queue.length;
  const criticalCount = queue.filter(p => p.triage_level === 'RESUSCITATION' || p.triage_level === 'EMERGENT').length;
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.bed_status === 'OCCUPIED').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Real-time Alert Toast */}
      {alertNotification && (
        <div style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
          color: '#FFFFFF',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 10px 30px rgba(239, 68, 68, 0.5)',
          zIndex: 100,
          fontWeight: 700,
          fontSize: '0.85rem'
        }} className="fade-in-entry">
          {alertNotification}
        </div>
      )}

      {/* Top Navbar */}
      <TopNav
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        onOpenIntake={() => setIsIntakeOpen(true)}
        onOpenInspector={() => {
          setIsInspectorOpen(true);
          if (queue.length > 0 && !inspectorAdmissionId) {
            setInspectorAdmissionId(queue[0].admission_id);
          }
        }}
        stats={{ activeCount, criticalCount, totalBeds, occupiedBeds, occupancyRate }}
      />

      {/* Main View Area */}
      <main style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Connecting to PulseTriage PostgreSQL engine...
          </div>
        ) : activeView === 'queue' ? (
          <TriageQueue
            queue={queue}
            onOpenVitals={(p) => setVitalsPatient(p)}
            onOpenBedAssign={(p) => {
              setTargetPatientForBed(p);
              setActiveView('beds');
            }}
            onDischarge={handleDischarge}
            onOpenAudit={(admId) => {
              setInspectorAdmissionId(admId);
              setIsInspectorOpen(true);
            }}
            currentUser={currentUser}
          />
        ) : (
          <WardBedGrid
            wards={wards}
            beds={beds}
            selectedPatientForBed={targetPatientForBed}
            onAssignBedToPatient={handleAssignBed}
            onCancelSelection={() => setTargetPatientForBed(null)}
          />
        )}
      </main>

      {/* Modals & Sliding Panels */}
      {vitalsPatient && (
        <VitalsModal
          patient={vitalsPatient}
          onClose={() => setVitalsPatient(null)}
          onVitalsSubmitted={() => {
            loadData();
          }}
        />
      )}

      {isIntakeOpen && (
        <IntakeModal
          onClose={() => setIsIntakeOpen(false)}
          onIntakeSuccess={() => {
            setIsIntakeOpen(false);
            showAlert('Patient admitted successfully! Triage level and waitlist updated.');
            loadData();
          }}
        />
      )}

      <InspectorDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedAdmissionId={inspectorAdmissionId || (queue[0]?.admission_id)}
      />
    </div>
  );
}
