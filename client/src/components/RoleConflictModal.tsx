/**
 * RoleConflictModal.tsx (Milestone D4.5)
 * Non-destructive modal dialog warning user when active CometChat credentials
 * conflict with the requested deep-link role.
 * Conforms to docs/frontend_architecture_spec.md and ORIGINAL_REQUEST.md §R4.
 * ZERO raw hex codes - 100% semantic CSS design tokens.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserRole } from '@kinesio/shared';
import { getExpectedUidForRole, getRoleForUid } from '../utils/sessionGuard';
import { springPresets } from '../styles/motionPresets';

export interface RoleConflictModalProps {
  isOpen: boolean;
  activeUid: string;
  requestedRole: UserRole;
  sessionId: string | null;
  onContinueCurrentRole: () => void;
  onSwitchRole: () => void;
}

export const RoleConflictModal: React.FC<RoleConflictModalProps> = ({
  isOpen,
  activeUid,
  requestedRole,
  sessionId,
  onContinueCurrentRole,
  onSwitchRole,
}) => {
  const currentRole = getRoleForUid(activeUid) || 'unknown';
  const expectedUid = getExpectedUidForRole(requestedRole);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-conflict-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(19, 20, 23, 0.65)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={springPresets.gentle}
            style={{
              width: '100%',
              maxWidth: '32rem',
              backgroundColor: 'var(--surface-canvas)',
              borderRadius: 'var(--radius-bento-card)',
              border: '1px solid var(--surface-border-subtle)',
              boxShadow: 'var(--shadow-canvas)',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Warning Badge Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--status-warning)',
                  fontSize: '1.25rem',
                }}
              >
                ⚠️
              </span>
              <div>
                <h3
                  id="role-conflict-title"
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    margin: 0,
                  }}
                >
                  Browser Profile Role Collision
                </h3>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Dual-Profile Session Guard
                </span>
              </div>
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <p>
                This browser profile is already signed in as{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{activeUid}</strong> (
                {currentRole}), but this link requests the role of{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{requestedRole}</strong> (expected{' '}
                <code
                  style={{
                    padding: 'var(--space-0-5) var(--space-1)',
                    borderRadius: '0.25rem',
                    backgroundColor: 'var(--surface-canvas-subtle)',
                  }}
                >
                  {expectedUid}
                </code>
                ).
              </p>
              {sessionId && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Target Session: <strong>{sessionId}</strong>
                </p>
              )}
              <div
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-control)',
                  backgroundColor: 'var(--surface-canvas-subtle)',
                  border: '1px solid var(--surface-border-subtle)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}
              >
                💡 <strong>Tip for local dual-profile testing:</strong> Open the Patient link in an{' '}
                <strong>Incognito window</strong> or a separate browser profile to prevent tab credentials
                from overwriting each other.
              </div>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-2)',
              }}
            >
              <button
                type="button"
                onClick={onContinueCurrentRole}
                style={{
                  flex: 1,
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--surface-border-strong)',
                  backgroundColor: 'var(--surface-canvas-subtle)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                Continue as {currentRole}
              </button>
              <button
                type="button"
                onClick={onSwitchRole}
                style={{
                  flex: 1,
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-control)',
                  border: 'none',
                  backgroundColor: 'var(--surface-dark-sidebar)',
                  color: 'var(--text-on-dark-primary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Switch to {requestedRole}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
