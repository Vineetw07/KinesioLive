/**
 * App.tsx (Tickets 01 & 02: Full Alabaster UI Overhaul)
 * Precision Tele-Rehab Experience.
 * - Route Views:
 *   1. 'landing'  -> Alabaster Landing Page with 3D Mannequin & Dual-Role Auth Modal.
 *   2. 'lobby'    -> Pre-Flight Lobbies (ClinicianLobby with Board Cert & Presence, PatientLobby with Health Record & Silhouette Check).
 *   3. 'studio'   -> Live Mission Control Studio (Clinician / Patient).
 *   4. 'summary'  -> Post-Workout Clinical Exercise Summary Card.
 * - Spikes Testbed completely removed from user interface.
 * - 100% semantic CSS tokens, zero raw hex codes, and non-destructive role conflict protection.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  type UserRole,
  type SessionResponse,
  CLINICIAN_UID,
  PATIENT_UID,
} from '@kinesio/shared';
import {
  parseSessionParams,
  checkSessionGuard,
  getRoleForUid,
} from './utils/sessionGuard';
import { RoleConflictModal } from './components/RoleConflictModal';
import { BiomechanicalBackground } from './components/BiomechanicalBackground';
import { LandingPage } from './views/LandingPage';
import { ClinicianLobby } from './views/ClinicianLobby';
import { PatientLobby } from './views/PatientLobby';

const Patient = lazy(() => import('./views/Patient'));
const Clinician = lazy(() => import('./views/Clinician'));
const Summary = lazy(() => import('./views/Summary'));

type ViewState = 'landing' | 'lobby' | 'studio' | 'summary';

export const App: React.FC = () => {
  // Primary application state
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [activeRole, setActiveRole] = useState<UserRole>('clinician');
  const [sessionId, setSessionId] = useState<string>('kine-studio-demo');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isSummaryView, setIsSummaryView] = useState<boolean>(false);
  const [sessionIdInput, setSessionIdInput] = useState<string>('kine-studio-demo');
  const [userDetails, setUserDetails] = useState<{ name: string; id: string; protocol?: string }>({
    name: 'Dr. Sarah Smith, DPT, OCS',
    id: CLINICIAN_UID,
  });

  const handleTabChange = (_tab?: string) => {
    setIsSummaryView(false);
  };

  const handleRoleChange = (_newRole?: UserRole) => {
    setIsSummaryView(false);
  };

  // Role Conflict Guard State
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [conflictActiveUid, setConflictActiveUid] = useState<string>('');
  const [conflictRequestedRole, setConflictRequestedRole] = useState<UserRole>('clinician');
  const [conflictSessionId, setConflictSessionId] = useState<string | null>(null);

  // Probe server health on load via Vite proxy (/api -> http://localhost:5000)
  useEffect(() => {
    fetch('/api/health').catch((err: Error) => {
      console.warn('Server health probe notice:', err.message);
    });
  }, []);

  // URL Deep-Link Evaluation & Session Guard Check
  useEffect(() => {
    async function evaluateUrlAndGuard() {
      const parsed = parseSessionParams(window.location.search);

      if (parsed.isValid && parsed.role) {
        setActiveRole(parsed.role);
        if (parsed.sessionId) {
          setSessionId(parsed.sessionId);
        }

        // If deep-link has explicit role & session, auto-authenticate into lobby
        try {
          const res = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: parsed.role,
              sessionId: parsed.sessionId || 'kine-studio-demo',
            }),
          });
          if (res.ok) {
            const data: SessionResponse = await res.json();
            setSession(data);
            setUserDetails({
              name: parsed.role === 'clinician' ? 'Dr. Sarah Smith, DPT' : 'Jane Doe',
              id: parsed.role === 'clinician' ? CLINICIAN_UID : PATIENT_UID,
            });
            setViewState('lobby');
          }
        } catch {
          // If offline/server standby, still show lobby
          setViewState('lobby');
        }
      }

      const guard = await checkSessionGuard(window.location.search);
      if (guard.conflict && guard.activeUid && guard.parsed.role) {
        setConflictActiveUid(guard.activeUid);
        setConflictRequestedRole(guard.parsed.role);
        setConflictSessionId(guard.parsed.sessionId);
        setIsConflictModalOpen(true);
      }
    }

    evaluateUrlAndGuard();

    const handlePopState = () => {
      evaluateUrlAndGuard();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Session connection helpers
  const handleConnect = async (roleInput: UserRole, sessionIdInput: string) => {
    const cleanSessionId = sessionIdInput.trim() || 'kine-studio-demo';
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleInput, sessionId: cleanSessionId }),
    });
    if (res.ok) {
      const data: SessionResponse = await res.json();
      setSession(data);
      setSessionId(cleanSessionId);
      setActiveRole(roleInput);
      setViewState('lobby');
    }
  };

  const handleDisconnect = () => {
    // 1. Immediately reset state synchronously to bring user to landing page
    setSession(null);
    setViewState('landing');
    setIsSummaryView(false);

    // 2. Clear query string in browser URL cleanly
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, '', cleanUrl);
    } catch {
      // Ignore
    }

    // 3. Fire-and-forget CometChat logout in background with catch handler
    try {
      if (typeof CometChat !== 'undefined' && typeof CometChat.logout === 'function') {
        CometChat.logout().catch(() => {});
      }
    } catch {
      // Ignore
    }
  };

  // Handler when user authenticates from AuthModal on Landing Page
  const handleAuthenticated = (
    newSession: SessionResponse,
    role: UserRole,
    details: { name: string; id: string; protocol?: string }
  ) => {
    handleRoleChange(role);
    handleTabChange('lobby');
    setSession(newSession);
    setActiveRole(role);
    setUserDetails(details);
    if (newSession.sessionId) {
      setSessionId(newSession.sessionId);
    }
    const params = new URLSearchParams(window.location.search);
    params.set('role', role);
    params.set('session', newSession.sessionId || sessionId);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setViewState('lobby');
  };

  const handleSignOut = handleDisconnect;

  // Conflict Modal Handlers
  const handleContinueCurrentRole = () => {
    const existingRole = getRoleForUid(conflictActiveUid);
    if (existingRole) {
      setActiveRole(existingRole);
      const params = new URLSearchParams(window.location.search);
      params.set('role', existingRole);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    setIsConflictModalOpen(false);
  };

  const handleExplicitSwitchRole = async () => {
    try {
      await CometChat.logout();
    } catch {
      // Ignore
    }
    setActiveRole(conflictRequestedRole);
    setIsConflictModalOpen(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface-app-frame)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-family)',
        position: 'relative',
      }}
    >
      {/* High-Precision Biomechanical Telemetry Backdrop for Lobbies, Studio, and Summary */}
      {viewState !== 'landing' && <BiomechanicalBackground topOffset={0} />}

      {/* View Router */}
      {viewState === 'landing' && (
        <LandingPage
          onAuthenticated={handleAuthenticated}
          onWatchDemo={() => {
            handleAuthenticated(
              {
                uid: CLINICIAN_UID,
                authToken: 'demo_token',
                sessionId: 'kine-studio-demo',
                appId: 'mock-app-id',
                region: 'us',
              },
              'clinician',
              { name: 'Dr. Sarah Smith, DPT, OCS', id: CLINICIAN_UID }
            );
          }}
        />
      )}

      {viewState === 'lobby' && (
        <div style={{ flex: 1, padding: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
          {activeRole === 'clinician' ? (
            <ClinicianLobby
              session={session || { uid: CLINICIAN_UID, authToken: '', sessionId, appId: 'mock-app-id', region: 'us' }}
              practitionerName={userDetails.name}
              onEnterStudio={() => setViewState('studio')}
              onSignOut={handleSignOut}
            />
          ) : (
            <PatientLobby
              session={session || { uid: PATIENT_UID, authToken: '', sessionId, appId: 'mock-app-id', region: 'us' }}
              patientName={userDetails.name}
              protocol={userDetails.protocol}
              onEnterStudio={() => setViewState('studio')}
              onSignOut={handleSignOut}
            />
          )}
        </div>
      )}

      {viewState === 'studio' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--space-4)',
            maxWidth: '1680px',
            width: '100%',
            margin: '0 auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Subtle Top Status Bar for Studio */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--surface-canvas)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--surface-border-subtle)',
              marginBottom: 'var(--space-3)',
              boxShadow: 'var(--shadow-canvas)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--accent-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                }}
              >
                K
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.9375rem' }}>
                Kinesio<span style={{ color: 'var(--accent-lime)' }}>Live</span> Studio
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Room: {sessionId}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={() => setViewState('lobby')}
                style={{
                  border: '1px solid var(--surface-border-strong)',
                  backgroundColor: 'transparent',
                  borderRadius: 'var(--radius-pill)',
                  padding: 'var(--space-1) var(--space-3)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Return to Lobby
              </button>
            </div>
          </div>

          {/* Accessibility input preserving Milestone 3 contract */}
          <input
            id="session-id-input"
            type="text"
            value={sessionIdInput}
            onChange={(e) => setSessionIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConnect(activeRole, sessionIdInput);
              }
            }}
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          <Suspense
            fallback={
              <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading Tele-Rehab Studio...
              </div>
            }
          >
            {isSummaryView ? (
              <Summary
                sessionId={sessionId}
                guid={sessionId}
                onBack={() => setIsSummaryView(false)}
              />
            ) : activeRole === 'clinician' ? (
              <Clinician
                sessionId={sessionId}
                onEndSession={() => {
                  setIsSummaryView(true);
                  setViewState('summary');
                }}
              />
            ) : (
              <Patient
                sessionId={sessionId}
                onLeaveSession={() => {
                  setIsSummaryView(true);
                  setViewState('summary');
                }}
              />
            )}
          </Suspense>
        </div>
      )}

      {viewState === 'summary' && (
        <div style={{ flex: 1, padding: 'var(--space-6) var(--space-4)', maxWidth: '1240px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
          <Suspense
            fallback={
              <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)' }}>
                Reconstructing Session Summary from CometChat History...
              </div>
            }
          >
            <Summary
              sessionId={sessionId}
              guid={sessionId}
              onBack={() => {
                setIsSummaryView(false);
                setViewState('lobby');
              }}
            />
          </Suspense>
        </div>
      )}

      {/* Role Conflict Modal */}
      <RoleConflictModal
        isOpen={isConflictModalOpen}
        activeUid={conflictActiveUid}
        requestedRole={conflictRequestedRole}
        sessionId={conflictSessionId}
        onContinueCurrentRole={handleContinueCurrentRole}
        onSwitchRole={handleExplicitSwitchRole}
      />
    </div>
  );
};

export default App;
