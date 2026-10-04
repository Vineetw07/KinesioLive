# Client Architecture & Route Survey Report: `/spikes` Testbed Mount

**Survey Date:** 2026-10-03  
**Target Milestone:** D2.1 – D2.5 (Spikes S1 through S4 & D2.5 Kill-Switch Decision Gate)  
**Survey Agent:** Survey Agent 1 (Client Architecture Explorer)  
**Working Directory:** `.agents/teamwork/teamwork_preview_explorer_survey_d2_1/`

---

## Executive Summary

The `@kinesio/client` workspace is an ultra-lean, modern React 19 + TypeScript + Vite 6 SPA with Framer Motion and custom CSS design tokens. Currently, **no routing library is installed**; `App.tsx` renders a single-screen session bootstrap view. Both `tsc --noEmit` and `vite build` pass with exit code 0.

To mount `/spikes` (`SpikesHarness.tsx`) without breaking the existing UI, introducing dependency bloat, or triggering React 19 peer-dependency friction, we recommend a **Native Pathname / History API router with `React.lazy` code splitting**. This fulfills the prompt requirements, satisfies the **Ladder of Necessity** (native platform primitives over unneeded packages), isolates heavy WebRTC/MediaPipe dependencies into separate chunks, and allows instant navigation between the live session view (`/`) and the interactive testbed HUD (`/spikes`).

---

## 1. Current Routing Architecture

### Direct Observation
- **Package Manifest (`client/package.json`):** `react-router-dom` is **not installed**.
- **Application Entry (`client/src/main.tsx`):**
  ```tsx
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
  ```
- **Root Component (`client/src/App.tsx`):** Renders a single-screen view containing:
  - Header: Logo title (`KinesioLive`), subtitle badge, and backend proxy health probe (`/api/health`).
  - Main grid: Two responsive cards — "Session Setup" (role buttons, session ID input, connect button) and "Session Status" (authenticated tokens & UID).
- **Routing Status:** There is currently **zero routing logic** in the codebase. All UI is hardcoded in `App.tsx`.

### Comparative Routing Analysis

| Factor | Option 1: Native Pathname Router (Recommended) | Option 2: `react-router-dom` |
|---|---|---|
| **Dependencies** | 0 new packages | Requires `react-router-dom` |
| **React 19 Compatibility** | 100% native standard API (`window.location`) | Risk of peer dependency warnings/conflicts |
| **Bundle Size Overhead** | ~0.3 KB (native hook/component) | ~150 – 200 KB |
| **Vite Dev Server Behavior** | Native SPA history fallback serves `/spikes` | Native SPA history fallback serves `/spikes` |
| **Production Build** | `tsc -b && vite build` clean; zero risk | Additional types and bundle chunking |
| **Rule Alignment** | **Complies with Ladder of Necessity** (primitives > packages) | Violates Ladder of Necessity (YAGNI for 2 routes) |

---

## 2. Recommended Mount Strategy for `/spikes`

### 2.1 Router Mechanism
In `client/src/App.tsx` (or a dedicated `client/src/router.tsx`), introduce a lightweight, reactive pathname listener:

```tsx
import React, { useState, useEffect, lazy, Suspense } from 'react';

// Lazy-load SpikesHarness to keep root bundle lightweight
const SpikesHarness = lazy(() => import('./spikes/SpikesHarness'));

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setCurrentPath(to);
  };

  const isSpikesRoute = currentPath === '/spikes' || currentPath.startsWith('/spikes') || window.location.hash === '#spikes';

  return (
    <div className="kine-container">
      {/* Top Navigation Bar */}
      <header className="kine-header">
        <div className="kine-logo-title">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            Kinesio<span style={{ color: 'var(--accent-cyan)' }}>Live</span>
          </h1>
          <span className="kine-badge">Tele-Rehabilitation Engine</span>
        </div>

        {/* Route Navigation Switcher */}
        <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`kine-button ${!isSpikesRoute ? '' : 'kine-button-secondary'}`}
            onClick={() => navigate('/')}
          >
            Live Session
          </button>
          <button
            type="button"
            className={`kine-button ${isSpikesRoute ? '' : 'kine-button-secondary'}`}
            onClick={() => navigate('/spikes')}
          >
            ⚡ Spikes Testbed (/spikes)
          </button>
        </nav>
      </header>

      {/* Route Views */}
      {isSpikesRoute ? (
        <Suspense fallback={<div className="kine-card">Loading Spikes Testbed...</div>}>
          <SpikesHarness onNavigateHome={() => navigate('/')} />
        </Suspense>
      ) : (
        <SessionSetupView ... />
      )}
    </div>
  );
};
```

### 2.2 Why `React.lazy` Code Splitting is Critical
1. **Isolation of Heavy Assets:** `SpikesHarness` imports `@mediapipe/tasks-vision` (WebAssembly loader) and `@cometchat/calls-sdk-javascript`. Lazy loading ensures these large libraries are only fetched when navigating to `/spikes`.
2. **Crash Resilience:** If a WebAssembly binary or camera device permission error occurs within the spikes subsystem, it cannot crash the main application entry point.
3. **Sub-second Initial Load:** Keeps the initial production bundle at ~359 KB instead of inflating to >1 MB.

### 2.3 Server & Dev Environment Compatibility
- **Vite Dev Server:** Vite's default dev server mode (`appType: 'spa'`) serves `index.html` on any unrecognized path, including `/spikes`. Direct navigation to `http://localhost:5173/spikes` loads `index.html` -> `main.tsx` -> renders `<SpikesHarness />` seamlessly.
- **Express Single-Origin Server:** When the Express backend serves `client/dist/`, an SPA wildcard handler (`app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')))` guarantees direct URL bookmarking of `/spikes` in production.

---

## 3. Styling & UI Framework Audit

### Direct Observation
1. **No Tailwind / PostCSS:** Neither `tailwindcss` nor `postcss` is configured or installed.
2. **CSS Token System (`client/src/index.css`):**
   - Pure vanilla CSS using standard `:root` design tokens:
     - **Surfaces:** `--bg-primary` (`#0b0f19`), `--bg-surface` (`#111827`), `--bg-elevated` (`#1f2937`)
     - **Typography:** `--text-primary` (`#f9fafb`), `--text-secondary` (`#9ca3af`), `--text-muted` (`#6b7280`)
     - **Accents:** `--accent-cyan` (`#06b6d4`), `--accent-blue` (`#3b82f6`), `--accent-emerald` (`#10b981`), `--accent-amber` (`#f59e0b`), `--accent-rose` (`#f43f5e`)
     - **Borders:** `--border-subtle` (`#374151`)
   - **Class Namespace:** All classes use `.kine-*` prefix (e.g., `.kine-container`, `.kine-header`, `.kine-card`, `.kine-button`, `.kine-badge`, `.kine-input`, `.kine-stat`, `.kine-status-online`).
3. **Motion Engine:**
   - `framer-motion` (`^12.0.0`) is the canonical motion library.
   - Used for animated cards (`motion.div`), initial layout transitions (`opacity`, `y`, `scale`), and exit animations (`<AnimatePresence mode="wait">`).

### Styling Recommendations for `SpikesHarness`
- Adhere strictly to the existing `.kine-*` design tokens to maintain seamless visual harmony.
- Create `client/src/spikes/spikes.css` extending `index.css` with specific HUD layout classes:
  - `.kine-tab-bar`, `.kine-tab-btn`, `.kine-tab-btn.active`
  - `.kine-chip-pass` (emerald), `.kine-chip-fail` (rose), `.kine-chip-running` (amber)
  - `.kine-metric-gauge`, `.kine-hud-metric-value`
  - `.kine-log-stream` (monospace telemetry output)
- Use `framer-motion` for tab transitions and live status badge pulsing.

---

## 4. Dependencies & Script Inventory

### Packages (`client/package.json`)
```json
{
  "dependencies": {
    "@cometchat/calls-sdk-javascript": "^5.0.5",
    "@cometchat/chat-sdk-javascript": "^4.1.13",
    "@kinesio/shared": "workspace:*",
    "@mediapipe/tasks-vision": "^0.10.14",
    "framer-motion": "^12.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

### Script Execution Verification
| Command | Result | Verification Output |
|---|---|---|
| `pnpm --filter @kinesio/client typecheck` | **PASS (0)** | `tsc --noEmit` exited with 0 |
| `pnpm --filter @kinesio/client build` | **PASS (0)** | `tsc -b && vite build` produced `dist/` in 2.35s |
| `pnpm --filter @kinesio/client exec vitest run --root .. tests/e2e/health.test.ts` | **PASS (0)** | 10 passed tests in 125ms |

---

## 5. Recommended Directory Structure for `client/src/spikes/`

To cleanly modularize Spikes S1 through S4 and the S5/D2.5 Kill-Switch Decision Gate, the following component architecture is recommended:

```
client/src/spikes/
├── SpikesHarness.tsx               # Root harness orchestrator (split-tabs, 'Run All', Kill-Switch Gate)
├── spikes.css                      # HUD styling, status badges, telemetry tables, dark theme
├── types.ts                        # BenchmarkMetrics, SpikeResult, SpikeStatus interfaces
│
├── components/                     # Reusable HUD elements
│   ├── SpikeStatusChip.tsx         # PASS / FAIL / RUNNING / IDLE badge
│   ├── BenchmarkMetricCard.tsx     # Large metric readout (FPS, p95 latency, loss %, retrieval)
│   ├── KillSwitchGateTable.tsx     # D2.5 formal sign-off checklist and summary card
│   └── TelemetryLogConsole.tsx     # Scrollable real-time event & error log viewer
│
├── hooks/                          # Reusable benchmark timing & rate limiting hooks
│   ├── useBenchmarkTimer.ts        # High-res stopwatch & percentile calculator (p50, p95)
│   └── useTokenBucket.ts           # 10 Hz token bucket rate-limiter
│
├── s1-pose/                        # Spike S1: MediaPipe Pose Inference
│   ├── SpikePoseInference.tsx      # Video canvas, live FPS meter, keypoint counter
│   └── poseRunner.ts               # PoseLandmarker loader, detectForVideo loop, FPS tracker
│
├── s2-telemetry/                   # Spike S2: 10 Hz Transient Message Telemetry
│   ├── SpikeTelemetryThroughput.tsx# 600-msg burst sender, loss % graph, p95 latency readout
│   └── telemetryRunner.ts          # CometChat.sendTransientMessage sender & receiver
│
├── s3-calls/                       # Spike S3: Dual-Profile Calls v5 Join
│   ├── SpikeCallsJoin.tsx          # Patient/Clinician launcher, video container, connect latency
│   └── callsRunner.ts              # Sequential Calls v5 init, loginWithAuthToken, joinSession
│
├── s4-persistence/                 # Spike S4: Custom Message Persistence & History
│   ├── SpikePersistenceFetch.tsx  # 25 custom messages burst trigger & chronological validator
│   └── persistenceRunner.ts        # CometChat.sendCustomMessage & MessagesRequestBuilder query
│
└── utils/                          # Shared test harness utilities
    ├── tokenService.ts             # Client wrapper around POST /api/session
    ├── stats.ts                    # Percentile math (p50, p95, standard deviation)
    └── cometchatClient.ts          # Reusable Chat SDK v4 & Calls SDK v5 bootstrap helper
```

### Module Responsibilities & Verification Mapping
1. **`SpikesHarness.tsx`**:
   - Manages top-level tabs: `[ Overview / Gate | S1: Pose | S2: Telemetry | S3: Calls v5 | S4: Persistence ]`.
   - Houses the master "Run All Spikes" runner for Milestone D2.5 sign-off.
   - Passes live status state into `<KillSwitchGateTable />`.
2. **`s1-pose/poseRunner.ts`**:
   - Initializes `FilesetResolver.forVisionTasks` and `PoseLandmarker.createFromOptions`.
   - Feeds video frames into `detectForVideo()` and measures sustained inference FPS ($\ge 15$ FPS threshold).
3. **`s2-telemetry/telemetryRunner.ts`**:
   - Transmits 600 `kine.pose` messages at 10 Hz via `CometChat.sendTransientMessage`.
   - Measures packet loss ($< 2.0\%$) and p95 latency ($< 400$ ms).
4. **`s3-calls/callsRunner.ts`**:
   - Calls `/api/session` to obtain server-minted auth token.
   - Performs strict sequential login into Chat SDK and Calls SDK v5, measures connection latency ($< 3.0$ s), and mounts clinician with `startAudioMuted: true`.
5. **`s4-persistence/persistenceRunner.ts`**:
   - Sends 25 custom messages (`kine.rep`, `kine.alert`, `kine.cue`).
   - Queries `MessagesRequestBuilder` and asserts 100% chronological sequence retrieval.

---

## 6. Actionable Implementation Directives for Implementer Agent

1. **Do not install `react-router-dom`**: Implement the native pathname hook with `React.lazy` code-splitting directly in `App.tsx`.
2. **Preserve existing session functionality**: Refactor the existing setup card into a sub-component (e.g. `SessionSetupView`) so navigating back to `/` maintains identical functionality.
3. **Follow the design token system**: Use `var(--accent-cyan)`, `var(--bg-surface)`, and `.kine-*` classes; use `framer-motion` for animated tab switching.
4. **Isolate SDK singletons**: Ensure CometChat listeners in S2 and Calls SDK event handlers in S3 include React cleanup functions (`removeMessageListener`, `unsubscribe`) to prevent memory leaks during rapid tab switching.
