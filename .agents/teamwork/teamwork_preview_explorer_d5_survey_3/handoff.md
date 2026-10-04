# Milestone D5.4: Post-Workout Summary Bento View & Routing Architecture Survey

## Executive Summary
This survey provides the authoritative ground-truth analysis and implementation blueprint for Milestone D5.4 of KinesioLive: the **Post-Workout Summary Bento View** (`client/src/views/Summary.tsx`) and the session-end routing orchestration in `client/src/App.tsx` and `client/src/views/Clinician.tsx`.

---

## 1. Observation

### 1.1 Current View Rendering & Routing in `App.tsx`
- **File**: `client/src/App.tsx` (Lines 44–60, 119–131, 619–635)
- **Current Tab & Role State**:
  ```typescript
  type NavTab = 'studio' | 'spikes';
  const [currentTab, setCurrentTab] = useState<NavTab>(...);
  const [activeRole, setActiveRole] = useState<UserRole>('clinician');
  const [sessionId, setSessionId] = useState<string>('kine-studio-demo');
  ```
- **Current Main Canvas Render Gate** (Lines 619–635):
  ```typescript
  {activeRole === 'clinician' ? (
    <Clinician
      sessionId={sessionId}
      onEndSession={() => {
        // Return to clean state
      }}
    />
  ) : (
    <Patient
      sessionId={sessionId}
      onLeaveSession={() => {
        // Return to clean state
      }}
    />
  )}
  ```
- **Verbatim Observation**:
  Line 622 has an empty callback placeholder: `onEndSession={() => { // Return to clean state }}`. There is currently no state or branch that mounts a summary view.

### 1.2 Session Termination in `Clinician.tsx`
- **File**: `client/src/views/Clinician.tsx` (Lines 33–36, 286–314, 398–413)
- **Props Definition** (Lines 33–36):
  ```typescript
  export interface ClinicianViewProps {
    sessionId?: string;
    onEndSession?: () => void;
  }
  ```
- **`handleEndSession` Implementation** (Lines 286–314):
  ```typescript
  const handleEndSession = async () => {
    if (!activeSessionId) return;

    try {
      const markerPayload: KineSessionMarkerPayload = {
        v: SCHEMA_VERSION,
        sid: activeSessionId,
        t: Date.now(),
        type: 'kine.session',
        action: 'end',
        clinicianUid: CLINICIAN_UID,
        patientUid: PATIENT_UID,
      };

      const markerMsg = new CometChat.CustomMessage(
        activeSessionId,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.session',
        markerPayload as unknown as Record<string, unknown>
      );
      markerMsg.shouldUpdateConversation(false);
      await CometChat.sendCustomMessage(markerMsg);
    } catch {
      // Continue with teardown
    }

    setCallStatus('ended');
    if (onEndSession) onEndSession();
  };
  ```
- **Verbatim Observation**:
  `Clinician.tsx` already constructs and sends a `kine.session` marker (`action: 'end'`) and fires `if (onEndSession) onEndSession()` when the user clicks the "End Session" button (lines 398–412).

### 1.3 Patient View Session Boundaries in `Patient.tsx`
- **File**: `client/src/views/Patient.tsx` (Lines 66–69, 185–203, 673–690)
- **Props Definition**:
  ```typescript
  export interface PatientViewProps {
    sessionId?: string;
    onLeaveSession?: () => void;
  }
  ```
- **Custom Message Listener** (Lines 185–203):
  Currently listens for `type === 'kine.cue'` only. If clinician sends `kine.session` action `end`, `Patient.tsx` does not currently hook `onLeaveSession` to `kine.session` action `end`.

### 1.4 CometChat Group GUID & MessagesRequestBuilder Invariant
- **Files**:
  - `server/src/cometchatRest.ts` (Lines 174–177, 291–306)
  - `client/src/spikes/s4-custom/persistenceRunner.ts` (Lines 143–150)
  - `COMETCHAT_INTEGRATION.md` (Row 19)
- **Verbatim Pattern from S4**:
  ```typescript
  const messagesRequest = new CometChat.MessagesRequestBuilder()
    .setGUID(targetGuid)
    .setCategories(['custom'])
    .setLimit(100)
    .build();

  const fetchedMessages = await messagesRequest.fetchPrevious();
  ```
- In this architecture, the CometChat group GUID for any session is equal to the `sessionId`. Therefore `guid === sessionId`.

### 1.5 Design System Tokens in `tokens.css`
- **File**: `client/src/styles/tokens.css` (Lines 1–78)
- **Available Tokens**:
  - Surfaces: `--surface-app-frame: #F4F6EA`, `--surface-canvas: #FFFFFF`, `--surface-canvas-subtle: #F9FAFB`, `--surface-border-subtle: #F0F1F5`, `--surface-dark-sidebar: #131417`, `--surface-dark-card: #18191C`, `--surface-dark-card-border: #26282E`.
  - Typography: `--text-primary: #111827`, `--text-secondary: #4B5563`, `--text-muted: #6B7280`, `--text-on-dark-primary: #F9FAFB`, `--text-on-dark-secondary: #94A3B8`, `--text-on-dark-muted: #64748B`.
  - Status/Accents: `--status-stable: #10B981`, `--status-warning: #F59E0B`, `--status-critical: #EF4444`, `--accent-lime: #DAFE52`, `--accent-lavender: #C8B6FF`.
  - D5.2 tokens (being added by Explorer 1): `--accent-cyan: #06B6D4`, `--accent-cyan-tint: rgba(6, 182, 212, 0.18)`, `--shadow-glow-cyan: 0 0 16px -2px rgba(6, 182, 212, 0.45)`.
  - Surface texture: No `--surface-hatched` token exists in `tokens.css`. As specified in `ORIGINAL_REQUEST.md` line 485, the diagonal hatched pattern must be implemented as an inline SVG `background-image` data URI on the dark card.
- **Motion Presets**:
  - `client/src/styles/motionPresets.ts` exports `springPresets.layout`, `springPresets.snappy`, `springPresets.gentle`, `springPresets.telemetry`.

---

## 2. Logic Chain

1. **Routing Logic Chain**:
   - `Clinician.tsx` already triggers `onEndSession()` when the clinician finishes a workout.
   - `App.tsx` is the parent component hosting both `Clinician` and `Patient`.
   - By introducing state `const [isSummaryView, setIsSummaryView] = useState<boolean>(false);` in `App.tsx`, we can pass `onEndSession={() => setIsSummaryView(true)}` to `Clinician` and `onLeaveSession={() => setIsSummaryView(true)}` to `Patient`.
   - When `isSummaryView` is true, `App.tsx` renders `<Summary sessionId={sessionId} guid={sessionId} onBack={() => setIsSummaryView(false)} />`.
   - When switching tabs (`currentTab`) or roles (`activeRole`), `setIsSummaryView(false)` safely resets navigation.

2. **Data Ingestion Logic Chain**:
   - `Summary.tsx` receives `sessionId: string` and `guid: string`.
   - On mount, it calls `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(['custom']).setLimit(100).build().fetchPrevious()`.
   - The returned `CometChat.BaseMessage[]` array is passed to `buildSummary(sessionId, messages)`.
   - If `fetchPrevious()` returns an empty array or encounters an offline network state, `buildSummary(sessionId, [])` returns safe zero values without division by zero, and `Summary.tsx` renders an informative empty state.

3. **Visual & Bento Layout Logic Chain**:
   - The container uses `motion.div` with `initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`, and `transition={springPresets.layout}`.
   - Row 1 features 4 Stat Cards in a row: Total Reps, Peak Depth, Form Alerts, and Coaching Cues using light surface cards (`--surface-canvas-subtle`) with staggered `springPresets.snappy` animation (`delay: index * 0.05`).
   - Row 2 features a two-column split Bento Grid:
     - Left: Scrollable **Timeline** rendering `summary.timeline` with `--status-stable` pills for rep events, `--status-critical` for alerts, and `--accent-cyan` for cues.
     - Right: **Anchor Dark Card** using `--surface-dark-card: #18191C`, `color: var(--text-on-dark-primary)`, and inline SVG hatched diagonal pattern data URI, displaying `maxValgusDevPct`, bilateral L vs R luminous pills using `--status-critical`, depth distribution bars, and tempo distribution.

---

## 3. Answers to Key Dispatch Questions

### Q1: How does `App.tsx` currently render views? How does it handle role/view selection?
- `App.tsx` maintains state `currentTab: 'studio' | 'spikes'` and `activeRole: 'clinician' | 'patient'`.
- When `currentTab === 'studio'`, it conditionally renders `<Clinician>` or `<Patient>` wrapped in React `Suspense`.
- The URL query parameters are parsed by `parseSessionParams` from `client/src/utils/sessionGuard.ts`, allowing deep-linking via `?role=clinician|patient&session=<sessionId>`.
- The `onEndSession` prop on `Clinician` and `onLeaveSession` on `Patient` are currently empty no-op functions (`() => {}`).

### Q2: How should `onEndSession` callback be plumbed from `Clinician.tsx` to `App.tsx`?
- In `client/src/App.tsx`:
  1. Add lazy import: `const Summary = lazy(() => import('./views/Summary'));`.
  2. Add state: `const [isSummaryView, setIsSummaryView] = useState<boolean>(false);`.
  3. In `handleTabChange` and `handleRoleChange`, call `setIsSummaryView(false)` to ensure clean tab/role transitions.
  4. In the main canvas render block (lines 619–635):
     ```tsx
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
     ```
  5. In `Clinician.tsx`, `handleEndSession` (line 313) already executes `if (onEndSession) onEndSession();`. No internal signature change is needed in `Clinician.tsx`.

### Q3: What props does `Summary.tsx` take? How does it fetch messages using `CometChat.MessagesRequestBuilder`?
- **Props Contract**:
  ```typescript
  export interface SummaryProps {
    sessionId: string;
    guid: string;
    onBack?: () => void;
  }
  ```
- **Fetch Query**:
  ```typescript
  const messagesRequest = new CometChat.MessagesRequestBuilder()
    .setGUID(guid)
    .setCategories(['custom'])
    .setLimit(100)
    .build();
  const fetched = await messagesRequest.fetchPrevious();
  ```
- **Engine Processing**:
  `const summary = useMemo(() => buildSummary(sessionId, messages), [sessionId, messages]);`

### Q4: What is the layout and component structure of `Summary.tsx`?
- **Outer Container**:
  `motion.div` with `springPresets.layout` transition, `minWidth: 0`, and flexible 100% width.
- **Top Header**:
  Displays session title, session room badge, duration pill, and "Return to Live Studio" CTA button (`onBack`).
- **Section 1: 4 Stat Cards in a Row**:
  - Total Reps: `summary.totalReps` (`${summary.validReps} valid (${percentage}%)`)
  - Peak Depth: `summary.peakDepthDeg > 0 ? `${summary.peakDepthDeg}°` : '0°'` (`Avg: ${summary.averageMinKneeDeg}°`)
  - Form Alerts: `summary.alertCount` (`Max Valgus: +${summary.maxValgusDevPct.toFixed(1)}%`)
  - Coaching Cues: `summary.cuesCount` (`Delivered by clinician`)
  - Styling: Light cards (`--surface-canvas-subtle`, `--surface-border-subtle`, `--radius-bento-card`).
  - Staggered animation: `transition={{ ...springPresets.snappy, delay: index * 0.05 }}`.
- **Section 2: Split Bento Grid (`minmax(0, 1.3fr) minmax(340px, 1fr)`)**:
  - **Left Column: Scrollable Timeline**:
    - `maxHeight: '480px'`, `overflowY: 'auto'`.
    - Event items sorted ascending by timestamp.
    - Badges/Pills:
      - Rep event: `var(--status-stable)` (`#10B981`)
      - Alert event: `var(--status-critical)` (`#EF4444`)
      - Cue event: `var(--accent-cyan)` (`#06B6D4`)
      - Session marker: `var(--accent-lavender)` (`#C8B6FF`)
  - **Right Column: Anchor Dark Card**:
    - Background: `var(--surface-dark-card)` (`#18191C`).
    - Diagonal Hatched Texture: inline SVG data URI:
      `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 24L24 0M-6 6L6 -6M18 30L30 18' stroke='rgba(255,255,255,0.045)' stroke-width='1.5'/%3E%3C/svg%3E")`
    - Text color: `var(--text-on-dark-primary)`.
    - Peak Valgus: `+${summary.maxValgusDevPct.toFixed(1)}%` with reference to `8.0% threshold`.
    - L vs R Bilateral Breakdown: two luminous pills with `var(--status-critical)`, `border: 1px solid var(--status-critical)`, and `boxShadow: 0 0 10px rgba(239, 68, 68, 0.35)`.
    - Depth Distribution: horizontal bars for Shallow (`var(--status-warning)`), Good (`var(--accent-lime)`), and Deep (`var(--status-stable)`).
    - Tempo Cadence Distribution: Fast, Controlled, and Slow pills.

### Q5: How does `Summary.tsx` handle empty messages or loading state while fetching?
- **Loading State**: Displays a clean Bento loading card with token-compliant spinner and text: `"Compiling Biomechanical Session Data from CometChat..."`.
- **Error State**: If `fetchPrevious()` rejects, catches the error, sets `error` message state, and offers a `"Retry Fetch"` button without crashing.
- **Empty State**: If 0 messages are returned, `buildSummary(sessionId, [])` returns safe zero values (no division by zero). All stat cards display `"0"`, `"0°"`, etc., and the timeline renders a clean empty card: `"No workout events were logged for this session"`.

### Q6: Are there any missing dependencies or types?
- **Dependencies**: All required packages are already installed (`@cometchat/chat-sdk-javascript@4.1.13`, `framer-motion@12.0.0`, `react@19.0.0`).
- **Tokens**: Milestone D5.2 adds `--accent-cyan`, `--accent-cyan-tint`, `--shadow-glow-cyan` to `tokens.css`.
- **Engine**: Milestone D5.3 creates `client/src/engine/buildSummary.ts` and exports `buildSummary` and `SessionSummary` via `client/src/engine/index.ts`.
- **Typecheck**: Full monorepo passes `pnpm -r run typecheck` with exit code 0.

---

## 4. Concrete Code Implementation Proposal

### 4.1 `client/src/views/Summary.tsx` (Complete Proposed Implementation)

```tsx
/**
 * client/src/views/Summary.tsx (Milestone D5.4)
 * Post-Workout Biomechanical Summary Bento View.
 * - Queries CometChat.MessagesRequestBuilder for persisted custom session messages.
 * - Aggregates data deterministically via buildSummary engine.
 * - 4 Stat Cards in a row (Total Reps, Peak Depth, Form Alerts, Coaching Cues).
 * - Anchor Dark Card with hatched diagonal texture, luminous critical pills, depth & tempo distribution.
 * - Scrollable Event Timeline with semantic status pills (stable, critical, cyan).
 * - Fluid Framer Motion transitions (springPresets.layout & springPresets.snappy).
 * - 100% semantic CSS design tokens - ZERO raw hex codes in style definitions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { VALGUS_THRESHOLD_PCT } from '@kinesio/shared';
import { buildSummary, type SessionSummary } from '../engine';
import { springPresets } from '../styles/motionPresets';

export interface SummaryProps {
  sessionId: string;
  guid: string;
  onBack?: () => void;
}

const HATCHED_TEXTURE_DATA_URI =
  'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 24L24 0M-6 6L6 -6M18 30L30 18\' stroke=\'rgba(255,255,255,0.045)\' stroke-width=\'1.5\'/%3E%3C/svg%3E")';

export const Summary: React.FC<SummaryProps> = ({ sessionId, guid, onBack }) => {
  const [messages, setMessages] = useState<CometChat.BaseMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const targetGuid = guid || sessionId;
      const request = new CometChat.MessagesRequestBuilder()
        .setGUID(targetGuid)
        .setCategories(['custom'])
        .setLimit(100)
        .build();

      const fetched = await request.fetchPrevious();
      setMessages(fetched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve session message history';
      console.warn('[Summary] Fetch notice:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionHistory();
  }, [sessionId, guid]);

  // Pure deterministic aggregation
  const summary: SessionSummary = useMemo(() => {
    return buildSummary(sessionId, messages);
  }, [sessionId, messages]);

  const durationSec = Math.round(summary.durationMs / 1000);
  const validPct = summary.totalReps > 0 ? Math.round((summary.validReps / summary.totalReps) * 100) : 0;

  const statCards = [
    {
      id: 'reps',
      label: 'Total Reps',
      value: summary.totalReps,
      detail: `${summary.validReps} valid (${validPct}%)`,
      icon: '🏋️',
    },
    {
      id: 'depth',
      label: 'Peak Depth',
      value: summary.peakDepthDeg > 0 ? `${summary.peakDepthDeg}°` : '0°',
      detail: summary.averageMinKneeDeg > 0 ? `Avg: ${Math.round(summary.averageMinKneeDeg)}° knee flexion` : 'No reps recorded',
      icon: '🎯',
    },
    {
      id: 'alerts',
      label: 'Form Alerts',
      value: summary.alertCount,
      detail: summary.maxValgusDevPct > 0 ? `Max dev: +${summary.maxValgusDevPct.toFixed(1)}%` : 'Zero valgus breaches',
      icon: '⚠️',
    },
    {
      id: 'cues',
      label: 'Coaching Cues',
      value: summary.cuesCount,
      detail: `${summary.cuesDelivered.length} cues delivered by clinician`,
      icon: '📢',
    },
  ];

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 'var(--space-4)',
          backgroundColor: 'var(--surface-canvas-subtle)',
          borderRadius: 'var(--radius-bento-card)',
          padding: 'var(--space-8)',
          border: '1px solid var(--surface-border-subtle)',
        }}
      >
        <div style={{ fontSize: '2rem' }}>⚡</div>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Compiling Biomechanical Session Data...
        </h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Retrieving persisted telemetry from CometChat session: <strong>{sessionId}</strong>
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springPresets.layout}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        width: '100%',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header & Return Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          borderBottom: '1px solid var(--surface-border-subtle)',
          paddingBottom: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h2
              style={{
                fontSize: '1.375rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Post-Workout Biomechanical Summary
            </h2>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: 'var(--space-0-5) var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--status-stable)',
                border: '1px solid var(--status-stable)',
              }}
            >
              Session Complete
            </span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Session ID: <strong>{sessionId}</strong> • Duration:{' '}
            <strong>{durationSec > 0 ? `${durationSec}s` : 'Active Session'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {error && (
            <button
              type="button"
              onClick={fetchSessionHistory}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--status-warning)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: 'var(--status-warning)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry Fetch
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: 'var(--accent-lime)',
                color: 'var(--surface-dark-sidebar)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              ← Return to Live Studio
            </button>
          )}
        </div>
      </div>

      {/* Row 1: 4 Stat Cards in a Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {statCards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springPresets.snappy, delay: index * 0.05 }}
            style={{
              backgroundColor: 'var(--surface-canvas-subtle)',
              border: '1px solid var(--surface-border-subtle)',
              borderRadius: 'var(--radius-bento-card)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-bento)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.label}
              </span>
              <span style={{ fontSize: '1.25rem' }}>{card.icon}</span>
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              {card.value}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {card.detail}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Split Bento Grid (Timeline Left, Anchor Dark Card Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(340px, 1fr)',
          gap: 'var(--space-6)',
          alignItems: 'stretch',
        }}
      >
        {/* Left Bento: Scrollable Timeline */}
        <div
          style={{
            backgroundColor: 'var(--surface-canvas-subtle)',
            border: '1px solid var(--surface-border-subtle)',
            borderRadius: 'var(--radius-bento-card)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-bento)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            minHeight: '440px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Workout Event Timeline
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {summary.timeline.length} Events Logged
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              maxHeight: '420px',
              overflowY: 'auto',
              paddingRight: 'var(--space-2)',
            }}
          >
            {summary.timeline.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-10) var(--space-4)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                No workout events were recorded during this session.
              </div>
            ) : (
              summary.timeline.map((event) => {
                let badgeBg = 'rgba(16, 185, 129, 0.12)';
                let badgeBorder = 'var(--status-stable)';
                let badgeColor = 'var(--status-stable)';

                if (event.type === 'alert') {
                  badgeBg = 'rgba(239, 68, 68, 0.12)';
                  badgeBorder = 'var(--status-critical)';
                  badgeColor = 'var(--status-critical)';
                } else if (event.type === 'cue') {
                  badgeBg = 'var(--accent-cyan-tint)';
                  badgeBorder = 'var(--accent-cyan)';
                  badgeColor = 'var(--accent-cyan)';
                } else if (event.type === 'session') {
                  badgeBg = 'var(--accent-lavender-tint)';
                  badgeBorder = 'var(--accent-lavender)';
                  badgeColor = 'var(--text-primary)';
                }

                return (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-control)',
                      backgroundColor: 'var(--surface-canvas)',
                      border: '1px solid var(--surface-border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        padding: 'var(--space-0-5) var(--space-2)',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: badgeBg,
                        border: `1px solid ${badgeBorder}`,
                        color: badgeColor,
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}
                    >
                      {event.type}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {event.title}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {event.detail}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Bento: Anchor Dark Card */}
        <div
          style={{
            backgroundColor: 'var(--surface-dark-card)',
            backgroundImage: HATCHED_TEXTURE_DATA_URI,
            backgroundRepeat: 'repeat',
            color: 'var(--text-on-dark-primary)',
            borderRadius: 'var(--radius-bento-card)',
            border: '1px solid var(--surface-dark-card-border)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-5)',
            boxShadow: 'var(--shadow-bento)',
          }}
        >
          {/* Top Label */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-on-dark-muted)',
                  fontWeight: 700,
                }}
              >
                Biomechanical Kinematics
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--accent-lime)',
                  fontWeight: 600,
                }}
              >
                Threshold: {VALGUS_THRESHOLD_PCT}%
              </span>
            </div>
            <h3 style={{ margin: 'var(--space-1) 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
              Form Quality & Valgus Analysis
            </h3>
          </div>

          {/* Valgus Peak & Luminous Breakdown Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark-secondary)' }}>
                Max Valgus Deviation:
              </span>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color:
                    summary.maxValgusDevPct > VALGUS_THRESHOLD_PCT
                      ? 'var(--status-critical)'
                      : 'var(--status-stable)',
                }}
              >
                +{summary.maxValgusDevPct.toFixed(1)}%
              </span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {/* Luminous Pill Left */}
              <div
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(239, 68, 68, 0.16)',
                  border: '1px solid var(--status-critical)',
                  boxShadow: '0 0 12px rgba(239, 68, 68, 0.35)',
                  color: 'var(--text-on-dark-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <span>Left Knee</span>
                <span style={{ color: 'var(--status-critical)' }}>{summary.alertBreakdown.L} alerts</span>
              </div>

              {/* Luminous Pill Right */}
              <div
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(239, 68, 68, 0.16)',
                  border: '1px solid var(--status-critical)',
                  boxShadow: '0 0 12px rgba(239, 68, 68, 0.35)',
                  color: 'var(--text-on-dark-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <span>Right Knee</span>
                <span style={{ color: 'var(--status-critical)' }}>{summary.alertBreakdown.R} alerts</span>
              </div>
            </div>
          </div>

          {/* Depth Distribution Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-on-dark-muted)',
                fontWeight: 700,
              }}
            >
              Squat Depth Distribution
            </span>

            {[
              { label: 'Deep (<80°)', count: summary.depthDistribution.deep, color: 'var(--status-stable)' },
              { label: 'Good (80-100°)', count: summary.depthDistribution.good, color: 'var(--accent-lime)' },
              { label: 'Shallow (>100°)', count: summary.depthDistribution.shallow, color: 'var(--status-warning)' },
            ].map((d) => {
              const pct = summary.totalReps > 0 ? (d.count / summary.totalReps) * 100 : 0;
              return (
                <div key={d.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem' }}>
                    <span style={{ color: 'var(--text-on-dark-secondary)' }}>{d.label}</span>
                    <span style={{ color: 'var(--text-on-dark-primary)', fontWeight: 600 }}>
                      {d.count} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: d.color,
                        borderRadius: 'var(--radius-pill)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tempo Distribution Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-on-dark-muted)',
                fontWeight: 700,
              }}
            >
              Tempo Cadence
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {[
                { label: 'Fast (<1.2s)', count: summary.tempoDistribution.fast },
                { label: 'Controlled (1.2-3.5s)', count: summary.tempoDistribution.controlled },
                { label: 'Slow (>3.5s)', count: summary.tempoDistribution.slow },
              ].map((tempo) => (
                <div
                  key={tempo.label}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-control)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--surface-dark-card-border)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent-lime)' }}>
                    {tempo.count}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-on-dark-muted)', marginTop: '2px' }}>
                    {tempo.label.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Summary;
```

---

### 4.2 `client/src/App.tsx` Routing Modifications

In `client/src/App.tsx`:
1. **Lazy Import `Summary`**:
   ```typescript
   const Patient = lazy(() => import('./views/Patient'));
   const Clinician = lazy(() => import('./views/Clinician'));
   const Summary = lazy(() => import('./views/Summary'));
   const SpikesHarness = lazy(() => import('./spikes/SpikesHarness'));
   ```
2. **Add View State**:
   ```typescript
   const [isSummaryView, setIsSummaryView] = useState<boolean>(false);
   ```
3. **Reset State on Tab or Role Changes**:
   ```typescript
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
   ```
4. **Conditional Canvas Rendering**:
   ```tsx
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
   ```

---

## 5. Caveats
1. `Summary.tsx` depends on `buildSummary` and `SessionSummary` exported from `client/src/engine`. Milestone D5.3 must export them before `Summary.tsx` can compile in the build.
2. `tokens.css` must include `--accent-cyan` and `--accent-cyan-tint` (from Milestone D5.2) for the timeline cue badges and toast styling to render with semantic tokens.
3. If `CometChat.MessagesRequestBuilder` is called while the client is logged out or offline, the error handler ensures graceful fallback to an empty summary without crashing or unhandled promise rejection.

---

## 6. Conclusion
The path for Milestone D5.4 is clean, deterministic, and fully grounded in existing code patterns:
- `Clinician.tsx` already fires `onEndSession()` on line 313.
- Plumbing `onEndSession={() => setIsSummaryView(true)}` in `App.tsx` enables effortless transition to `<Summary>`.
- `Summary.tsx` cleanly encapsulates the required 3 Bento sections (4 light stat cards, bottom-right dark anchor card with hatched SVG pattern and luminous pills, and scrollable timeline).
- All visual elements use semantic CSS tokens with zero raw hex codes, and fluid Framer Motion transitions use `springPresets.layout` and `springPresets.snappy`.

---

## 7. Verification Method
1. **Compilation & Typecheck**:
   ```powershell
   pnpm -r run typecheck
   ```
   Must exit with code 0 across all workspaces.
2. **Vitest Test Suite**:
   ```powershell
   pnpm vitest run tests/summary.test.ts
   ```
   Must pass all 7 deterministic engine tests (Milestone D5.3).
3. **Manual / Interaction Smoke Test**:
   - Start dev server: `pnpm --filter @kinesio/client dev`
   - Open Clinician Mission Control (`?role=clinician`).
   - Click "End Session" in the top header control bar.
   - Verify that `<Summary>` mounts smoothly with `springPresets.layout` entry animation.
   - Verify that all 4 stat cards render with staggered `springPresets.snappy` transitions.
   - Verify that the dark anchor card displays the hatched background pattern and luminous red pills.
   - Click "← Return to Live Studio" and verify that it returns to the live session.
