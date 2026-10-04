# DISPATCH: Worker M4 (D5.4 Post-Workout Summary Bento View & Session Wiring)

## Working Directory
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m4/`

## Role & Type
`teamwork_preview_worker`

## Authoritative Inputs
- Read `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (lines 471–500 § R4, and lines 548–553 § Acceptance Criteria D5.4).
- Read Survey Explorer 3 handoff:
  `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_3/handoff.md`

## Files You Own Exclusively
- `client/src/views/Summary.tsx` (create)
- `client/src/App.tsx` (wire navigation and lazy render)

You MUST NOT edit any other files.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Implement

### 1. `client/src/views/Summary.tsx`
Create this component from scratch.
- Interface:
  ```typescript
  export interface SummaryProps {
    sessionId: string;
    guid: string;
    onBack?: () => void;
  }
  ```
- Data fetching:
  - On mount, query CometChat custom messages via:
    ```typescript
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setGUID(guid)
      .setCategories(['custom'])
      .setLimit(100)
      .build();
    const fetched = await messagesRequest.fetchPrevious();
    ```
  - Compute summary: `const summary = useMemo(() => buildSummary(sessionId, messages), [sessionId, messages]);`
  - Handle loading and empty states cleanly.
- Visual system & layout (ALL tokens from `tokens.css`):
  - Section 1: Row of 4 Stat Cards (Total Reps, Peak Depth, Form Alerts, Coaching Cues) using `--surface-canvas-subtle`, `--surface-border-subtle`, `--radius-bento-card`.
  - Section 2: Split Bento Grid:
    - Left: Scrollable Timeline (`maxHeight: '480px'`, `overflowY: 'auto'`) with events sorted by timestamp ascending, styled with `--status-stable` (reps), `--status-critical` (alerts), and `--accent-cyan` (cues).
    - Right: Anchor Dark Card using `--surface-dark-card: #18191C`, `color: var(--text-on-dark-primary)`, with inline SVG hatched background texture data URI:
      `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 24L24 0M-6 6L6 -6M18 30L30 18' stroke='rgba(255,255,255,0.045)' stroke-width='1.5'/%3E%3C/svg%3E")`
      Displays `maxValgusDevPct`, bilateral L vs R luminous pills using `--status-critical` and box-shadow glow, depth distribution bars, and tempo distribution pills.
- Animations (using existing `springPresets` from `../styles/motionPresets`):
  - Main container: `motion.div` with `initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={springPresets.layout}`.
  - Stat cards: staggered entry with `transition={{ ...springPresets.snappy, delay: index * 0.05 }}`.
- ZERO raw hex codes in `Summary.tsx` — all colors and surfaces must use CSS custom properties (`var(--...)`) or the specified inline SVG stroke.

### 2. `client/src/App.tsx`
- Lazy load `Summary`: `const Summary = lazy(() => import('./views/Summary'));`
- Add state: `const [isSummaryView, setIsSummaryView] = useState<boolean>(false);`
- In `handleTabChange` and `handleRoleChange`, call `setIsSummaryView(false)`.
- In the main studio canvas (lines 619–635):
  - When `isSummaryView` is true, render:
    `<Summary sessionId={sessionId} guid={sessionId} onBack={() => setIsSummaryView(false)} />`
  - Pass `onEndSession={() => setIsSummaryView(true)}` to `<Clinician>`
  - Pass `onLeaveSession={() => setIsSummaryView(true)}` to `<Patient>`

## Verification Required
Worker must run:
1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run`
Ensure exit code 0 across the entire monorepo.

## Output
Write report to:
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m4/handoff.md`
Send completion message to parent.


## 2026-10-04T08:23:26Z
You are Worker M4 for Phase 4 (Milestone D5.4) of KinesioLive.
Your identity: Worker M4 (teamwork_preview_worker).
Your working directory is:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m4/

Read the authoritative requirements first:
d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md
(Pay special attention to lines 471–500 § R4 and lines 548–553 § Acceptance Criteria D5.4).

Read Survey Explorer 3 handoff for full architecture and code designs:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_3/handoff.md

Read your full dispatch instructions:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m4/DISPATCH.md

Files you own exclusively:
- client/src/views/Summary.tsx (create)
- client/src/App.tsx (wire navigation and lazy render)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the tasks in DISPATCH.md:
1. Create client/src/views/Summary.tsx according to the visual design, token specifications (zero raw hex codes, inline SVG hatched texture, luminous pills, scrollable timeline, springPresets).
2. Wire App.tsx with isSummaryView state, lazy-loaded Summary component, onEndSession from Clinician, and onLeaveSession from Patient.
3. Verify:
   pnpm exec tsc --noEmit
   pnpm vitest run

Write your report to:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m4/handoff.md
Send a completion message back to parent.
