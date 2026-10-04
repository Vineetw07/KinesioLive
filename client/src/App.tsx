/**
 * App.tsx (Milestones D4.2, D4.3, D4.4, D4.5)
 * Floating Island Bento Canvas App Shell for KinesioLive.
 * - Outer ambient viewport frame (var(--surface-app-frame))
 * - Dark navigation sidebar (var(--surface-dark-sidebar)) with animated sliding active pill (layoutId="activeNavigationPill")
 * - Elevated central alabaster canvas (var(--surface-canvas), 36px border-radius, var(--shadow-canvas))
 * - Session Guard & Deep-Link integration with non-destructive RoleConflictModal
 * - Routes dynamically to Patient Studio, Clinician Mission Control, or Spikes Testbed
 * - Backward-compatible health probe and session connect/disconnect resilience
 * - ZERO raw hex codes - 100% semantic CSS design tokens.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  type UserRole,
  type SessionResponse,
  type SessionRequest,
  CLINICIAN_UID,
  PATIENT_UID,
} from '@kinesio/shared';
import {
  parseSessionParams,
  checkSessionGuard,
  getRoleForUid,
} from './utils/sessionGuard';
import { RoleConflictModal } from './components/RoleConflictModal';
import { springPresets } from './styles/motionPresets';

const Patient = lazy(() => import('./views/Patient'));
const Clinician = lazy(() => import('./views/Clinician'));
const Summary = lazy(() => import('./views/Summary'));
const SpikesHarness = lazy(() => import('./spikes/SpikesHarness'));

type NavTab = 'studio' | 'spikes';

interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: number;
}

export const App: React.FC = () => {
  // Navigation & Route state
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/spikes') || window.location.hash === '#spikes') {
        return 'spikes';
      }
    }
    return 'studio';
  });

  const [activeRole, setActiveRole] = useState<UserRole>('clinician');
  const [sessionIdInput, setSessionIdInput] = useState<string>('kine-studio-demo');
  const [sessionId, setSessionId] = useState<string>('kine-studio-demo');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isSummaryView, setIsSummaryView] = useState<boolean>(false);

  // Role Conflict Guard State
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [conflictActiveUid, setConflictActiveUid] = useState<string>('');
  const [conflictRequestedRole, setConflictRequestedRole] = useState<UserRole>('clinician');
  const [conflictSessionId, setConflictSessionId] = useState<string | null>(null);

  // Probe server health on load via Vite proxy (/api -> http://localhost:5000)
  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`Health check failed with HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then((data) => setHealth(data))
      .catch((err: Error) => {
        // Expected when server is offline during standalone client dev
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
          setSessionIdInput(parsed.sessionId);
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
      if (window.location.pathname.startsWith('/spikes') || window.location.hash === '#spikes') {
        setCurrentTab('spikes');
      } else {
        setCurrentTab('studio');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: NavTab) => {
    setIsSummaryView(false);
    setCurrentTab(tab);
    const targetPath = tab === 'spikes' ? '/spikes' : '/';
    window.history.pushState({}, '', targetPath);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setIsSummaryView(false);
    setActiveRole(newRole);
    const params = new URLSearchParams(window.location.search);
    params.set('role', newRole);
    if (sessionId) params.set('session', sessionId);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    const requestPayload: SessionRequest = {
      role: activeRole,
      sessionId: sessionIdInput.trim() ? sessionIdInput.trim() : undefined,
    };

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to establish session: HTTP ${res.status}`);
      }

      const data: SessionResponse = await res.json();
      setSession(data);
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setSession(null);
  };

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
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Floating Island Layout Shell: Left Dark Sidebar + Central Canvas Island */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: 'var(--space-4)',
          maxWidth: '1680px',
          width: '100%',
          margin: '0 auto',
          minHeight: 'calc(100vh - 2rem)',
        }}
      >
        {/* =========================================================================
            1. OBSIDIAN DARK NAVIGATION SIDEBAR (#131417)
            ========================================================================= */}
        <aside
          style={{
            width: '260px',
            flexShrink: 0,
            backgroundColor: 'var(--surface-dark-sidebar)',
            borderRadius: 'var(--radius-bento-card)',
            padding: 'var(--space-6) var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-bento)',
            color: 'var(--text-on-dark-primary)',
          }}
        >
          {/* Top Brand Logo & Tagline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingLeft: 'var(--space-2)' }}>
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: 'var(--radius-control)',
                  backgroundColor: 'var(--accent-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  color: 'var(--surface-dark-sidebar)',
                }}
              >
                K
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  Kinesio<span style={{ color: 'var(--accent-lime)' }}>Live</span>
                </h1>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-on-dark-muted)',
                    fontWeight: 600,
                  }}
                >
                  Tele-Rehab Studio
                </span>
              </div>
            </div>

            {/* Navigation Switcher with Animated Sliding Pill */}
            <nav
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
              aria-label="Application Navigation"
            >
              {[
                { id: 'studio' as NavTab, label: 'Live Studio', icon: '📹' },
                { id: 'spikes' as NavTab, label: 'Spikes Testbed', icon: '⚡' },
              ].map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-pill)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-on-dark-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      zIndex: 1,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavigationPill"
                        transition={springPresets.layout}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'var(--surface-canvas)',
                          borderRadius: 'var(--radius-pill)',
                          boxShadow: 'var(--shadow-bento)',
                          zIndex: -1,
                        }}
                      />
                    )}
                    <span style={{ fontSize: '1.125rem' }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Role Switcher Pill Container */}
            {currentTab === 'studio' && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--surface-dark-card)',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--surface-dark-card-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-on-dark-muted)',
                    fontWeight: 700,
                  }}
                >
                  Active Studio Role
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('clinician')}
                    style={{
                      flex: 1,
                      padding: 'var(--space-2) var(--space-1)',
                      borderRadius: 'var(--radius-pill)',
                      border: 'none',
                      backgroundColor:
                        activeRole === 'clinician' ? 'var(--accent-lime)' : 'transparent',
                      color:
                        activeRole === 'clinician'
                          ? 'var(--surface-dark-sidebar)'
                          : 'var(--text-on-dark-secondary)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Clinician
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('patient')}
                    style={{
                      flex: 1,
                      padding: 'var(--space-2) var(--space-1)',
                      borderRadius: 'var(--radius-pill)',
                      border: 'none',
                      backgroundColor:
                        activeRole === 'patient' ? 'var(--accent-lime)' : 'transparent',
                      color:
                        activeRole === 'patient'
                          ? 'var(--surface-dark-sidebar)'
                          : 'var(--text-on-dark-secondary)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Patient
                  </button>
                </div>
              </div>
            )}

            {/* Session Room Input */}
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--surface-dark-card)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--surface-dark-card-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <label
                htmlFor="session-id-input"
                style={{
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-on-dark-muted)',
                  fontWeight: 700,
                }}
              >
                Session Room ID
              </label>
              <input
                id="session-id-input"
                type="text"
                value={sessionIdInput}
                onChange={(e) => {
                  setSessionIdInput(e.target.value);
                  setSessionId(e.target.value.trim());
                }}
                placeholder="e.g. kine-studio-demo"
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--surface-dark-card-border)',
                  backgroundColor: 'var(--surface-dark-sidebar)',
                  color: 'var(--text-on-dark-primary)',
                  fontSize: '0.75rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {!session ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isLoading}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    backgroundColor: 'var(--accent-lime)',
                    color: 'var(--surface-dark-sidebar)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {isLoading ? 'Connecting...' : 'Connect Token API'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--surface-dark-card-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-on-dark-secondary)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Disconnect Token
                </button>
              )}

              {error && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--status-critical)' }}>
                  {error}
                </span>
              )}
            </div>
          </div>

          {/* Bottom Active User & Proxy Health Status */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--surface-dark-card)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--surface-dark-card-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(218, 254, 82, 0.2)',
                  color: 'var(--accent-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                {activeRole === 'clinician' ? 'DR' : 'PT'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeRole === 'clinician' ? CLINICIAN_UID : PATIENT_UID}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--status-stable)', fontWeight: 600 }}>
                  ● Active Profile
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 var(--space-2)',
                fontSize: '0.6875rem',
                color: 'var(--text-on-dark-muted)',
              }}
            >
              <span>API Proxy:</span>
              <span style={{ color: health?.status === 'ok' ? 'var(--status-stable)' : 'var(--text-on-dark-muted)', fontWeight: 600 }}>
                {health?.status === 'ok' ? 'Online' : 'Standby'}
              </span>
            </div>
          </div>
        </aside>

        {/* =========================================================================
            2. ELEVATED CENTRAL ALABASTER CANVAS (#FFFFFF, 36px RADIUS)
            ========================================================================= */}
        <main
          style={{
            flex: 1,
            backgroundColor: 'var(--surface-canvas)',
            borderRadius: 'var(--radius-outer-canvas)',
            boxShadow: 'var(--shadow-canvas)',
            border: '1px solid var(--surface-border-subtle)',
            padding: 'var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            minWidth: 0,
          }}
        >
          {currentTab === 'spikes' ? (
            <Suspense
              fallback={
                <div
                  style={{
                    padding: 'var(--space-12)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  Loading Spikes Testbed Harness...
                </div>
              }
            >
              <SpikesHarness onNavigateHome={() => handleTabChange('studio')} />
            </Suspense>
          ) : (
            <Suspense
              fallback={
                <div
                  style={{
                    padding: 'var(--space-12)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
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
                  }}
                />
              ) : (
                <Patient
                  sessionId={sessionId}
                  onLeaveSession={() => {
                    setIsSummaryView(true);
                  }}
                />
              )}
            </Suspense>
          )}
        </main>
      </div>

      {/* Non-Destructive Role Conflict Modal */}
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
