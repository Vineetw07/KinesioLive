/**
 * RoleConflictModal.tsx (Milestone D4.5)
 * Non-destructive modal dialog warning user when active CometChat credentials
 * conflict with the requested deep-link role.
 * Conforms to docs/frontend_architecture_spec.md and ORIGINAL_REQUEST.md §R4.
 * ZERO raw hex codes - 100% semantic CSS design tokens.
 */
import React from 'react';
import type { UserRole } from '@kinesio/shared';
export interface RoleConflictModalProps {
    isOpen: boolean;
    activeUid: string;
    requestedRole: UserRole;
    sessionId: string | null;
    onContinueCurrentRole: () => void;
    onSwitchRole: () => void;
}
export declare const RoleConflictModal: React.FC<RoleConflictModalProps>;
//# sourceMappingURL=RoleConflictModal.d.ts.map