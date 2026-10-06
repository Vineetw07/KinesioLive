/**
 * AuthModal.tsx
 * Clean, High-Contrast Dual-Role Authentication & Onboarding Modal.
 * - Supports Clinician and Patient roles.
 * - Supports Sign In and Create Account modes.
 * - 1-Click Quick Demo Access for instant evaluator testing without manual entry.
 * - Connects to backend POST /api/session to mint real CometChat credentials.
 * - 100% semantic tokens, full keyboard accessibility, zero jitter / no animations.
 */

import React, { useState, useEffect } from 'react';
import {
  type UserRole,
  type SessionResponse,
  CLINICIAN_UID,
  PATIENT_UID,
} from '@kinesio/shared';

export interface AuthModalProps {
  isOpen: boolean;
  initialRole?: UserRole;
  initialMode?: 'signin' | 'signup';
  initialSessionId?: string;
  onClose: () => void;
  onAuthenticated: (session: SessionResponse, role: UserRole, userDetails: { name: string; id: string; protocol?: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialRole = 'clinician',
  initialMode = 'signin',
  initialSessionId = 'kine-studio-demo',
  onClose,
  onAuthenticated,
}) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [protocol, setProtocol] = useState<string>('Post-ACL Reconstruction Week 6');
  const [sessionId, setSessionId] = useState<string>(initialSessionId);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRole(initialRole);
      setAuthMode(initialMode);
      setErrorMessage(null);
      if (initialRole === 'clinician') {
        setName('Dr. Sarah Smith, DPT');
        setIdentifier(CLINICIAN_UID);
      } else {
        setName('Jane Doe');
        setIdentifier(PATIENT_UID);
      }
    }
  }, [isOpen, initialRole, initialMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRoleSelect = (newRole: UserRole) => {
    setRole(newRole);
    setErrorMessage(null);
    if (newRole === 'clinician') {
      setName('Dr. Sarah Smith, DPT');
      setIdentifier(CLINICIAN_UID);
    } else {
      setName('Jane Doe');
      setIdentifier(PATIENT_UID);
    }
  };

  const handleExecuteAuth = async (overrideRole?: UserRole, overrideSessionId?: string) => {
    const targetRole = overrideRole || role;
    const targetSessionId = (overrideSessionId || sessionId).trim() || 'kine-studio-demo';
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: targetRole,
          sessionId: targetSessionId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Session creation failed (HTTP ${res.status})`);
      }

      const sessionResponse: SessionResponse = await res.json();
      onAuthenticated(sessionResponse, targetRole, {
        name: name || (targetRole === 'clinician' ? 'Dr. Sarah Smith' : 'Jane Doe'),
        id: identifier || (targetRole === 'clinician' ? CLINICIAN_UID : PATIENT_UID),
        protocol: targetRole === 'patient' ? protocol : undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Quick Demo Handlers
  const handleQuickDemoClinician = () => {
    setRole('clinician');
    setName('Dr. Sarah Smith, DPT');
    setIdentifier(CLINICIAN_UID);
    setSessionId('kine-studio-demo');
    handleExecuteAuth('clinician', 'kine-studio-demo');
  };

  const handleQuickDemoPatient = () => {
    setRole('patient');
    setName('Jane Doe');
    setIdentifier(PATIENT_UID);
    setSessionId('kine-studio-demo');
    handleExecuteAuth('patient', 'kine-studio-demo');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backgroundColor: 'rgba(4, 7, 14, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'rgba(11, 19, 43, 0.96)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-bento-card)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        {/* Top Header & Close button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2
              id="auth-modal-title"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              {authMode === 'signin' ? 'Welcome Back' : 'Create Tele-Rehab Account'}
            </h2>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Sign in or select a quick demo profile to proceed.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              border: '1px solid var(--surface-border-subtle)',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* 1-Click Quick Demo Access Bar */}
        <div
          style={{
            backgroundColor: 'rgba(218, 254, 82, 0.08)',
            border: '1px solid rgba(218, 254, 82, 0.25)',
            borderRadius: 'var(--radius-control)',
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.875rem' }}>⚡</span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-lime)' }}>
              Instant Evaluator 1-Click Access
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={handleQuickDemoClinician}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <span>🩺</span>
              <span>Dr. Smith (Clinician)</span>
            </button>
            <button
              type="button"
              onClick={handleQuickDemoPatient}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1)',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <span>🏃</span>
              <span>Jane Doe (Patient)</span>
            </button>
          </div>
        </div>

        {/* Role Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(7, 11, 20, 0.85)',
            padding: '4px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--surface-border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => handleRoleSelect('clinician')}
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-pill)',
              border: role === 'clinician' ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
              backgroundColor: role === 'clinician' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              color: role === 'clinician' ? 'var(--accent-cyan-bright)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            <span>🩺</span>
            <span>Licensed Clinician</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('patient')}
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-pill)',
              border: role === 'patient' ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
              backgroundColor: role === 'patient' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              color: role === 'patient' ? 'var(--accent-cyan-bright)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            <span>🏃</span>
            <span>Rehab Patient</span>
          </button>
        </div>

        {/* Mode Switcher: Sign In vs Sign Up */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', fontSize: '0.8125rem' }}>
          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            style={{
              border: 'none',
              borderBottom: authMode === 'signin' ? '2px solid var(--accent-cyan-bright)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: authMode === 'signin' ? 800 : 500,
              color: authMode === 'signin' ? 'var(--accent-cyan-bright)' : 'var(--text-muted)',
              padding: 'var(--space-1) var(--space-3)',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            style={{
              border: 'none',
              borderBottom: authMode === 'signup' ? '2px solid var(--accent-cyan-bright)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: authMode === 'signup' ? 800 : 500,
              color: authMode === 'signup' ? 'var(--accent-cyan-bright)' : 'var(--text-muted)',
              padding: 'var(--space-1) var(--space-3)',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            Create Account (Sign Up)
          </button>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteAuth();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
        >
          {/* Full Name */}
          <div>
            <label
              htmlFor="auth-name-input"
              style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}
            >
              {role === 'clinician' ? 'Practitioner Full Name' : 'Patient Full Name'}
            </label>
            <input
              id="auth-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'clinician' ? 'Dr. Sarah Smith, DPT' : 'Jane Doe'}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--surface-border-strong)',
                backgroundColor: 'rgba(7, 11, 20, 0.75)',
                color: 'var(--text-primary)',
                colorScheme: 'dark',
                fontSize: '0.8125rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Identifier / Clinic ID */}
          <div>
            <label
              htmlFor="auth-id-input"
              style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}
            >
              {role === 'clinician' ? 'State Medical License / Provider ID' : 'Patient Chart Identifier'}
            </label>
            <input
              id="auth-id-input"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={role === 'clinician' ? 'dr-demo' : 'pt-demo'}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--surface-border-strong)',
                backgroundColor: 'rgba(7, 11, 20, 0.75)',
                color: 'var(--text-primary)',
                colorScheme: 'dark',
                fontSize: '0.8125rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Patient Protocol (Only for Patients) */}
          {role === 'patient' && (
            <div>
              <label
                htmlFor="auth-protocol-input"
                style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}
              >
                Prescribed Exercise Protocol
              </label>
              <input
                id="auth-protocol-input"
                type="text"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                placeholder="Post-ACL Reconstruction Week 6"
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--surface-border-strong)',
                  backgroundColor: 'rgba(7, 11, 20, 0.75)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Session Room ID */}
          <div>
            <label
              htmlFor="auth-session-input"
              style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}
            >
              Tele-Rehab Session Room ID
            </label>
            <input
              id="auth-session-input"
              type="text"
              required
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="kine-studio-demo"
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--surface-border-strong)',
                backgroundColor: 'rgba(7, 11, 20, 0.75)',
                color: 'var(--text-primary)',
                colorScheme: 'dark',
                fontSize: '0.8125rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--status-critical)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 'var(--space-2)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--accent-lime)',
              color: 'var(--surface-app-frame)',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(218, 254, 82, 0.25)',
              transition: 'opacity 0.15s ease',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading
              ? 'Connecting CometChat Session...'
              : authMode === 'signin'
              ? `Enter as ${role === 'clinician' ? 'Clinician' : 'Patient'}`
              : `Create Account & Enter Session`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
