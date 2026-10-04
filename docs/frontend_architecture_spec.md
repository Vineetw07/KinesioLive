# KinesioLive Frontend Architecture & Design System Specification
**Version:** 1.0.0  
**Status:** Approved Architecture Draft  
**Target Stack:** React 19, TypeScript 5.7+, Vite 6, Framer Motion v12, Tailwind CSS / Semantic Tokens  
**Reference Design:** Floating Island Bento Canvas (Flux UI) & Watermelon UI / Motion.dev Motion Specs  

---

## 1. Executive Summary & Design Philosophy

KinesioLive is a real-time biomechanical telerehabilitation platform combining camera-based pose estimation (MediaPipe) with real-time video conferencing (CometChat Calls SDK v5) and 10 Hz high-frequency telemetry (CometChat Chat SDK transient messages).

The visual architecture adapts the **Floating Island Bento Canvas** paradigm:
1. **Outer Viewport Ambient Frame:** A warm, muted chartreuse/alabaster backdrop (`--surface-app-frame: #F4F6EA`) framing the entire application.
2. **Left Anchor Navigation:** An obsidian charcoal column (`--surface-dark-sidebar: #131417`) hosting primary routes, active sliding pill indicators, and the one-click telerehab call launcher.
3. **Floating Alabaster Canvas:** A high-radii (`36px`), elevated white surface (`--surface-canvas: #FFFFFF`) hosting the main views, page headers, search, and dynamic bento grids.
4. **Bottom-Right Contrast Anchor:** An inverted dark card (`--surface-dark-card: #18191C`) preventing the canvas from feeling top-heavy and grounding the overall visual weight.

```
┌─────────────────┬────────────────────────────────────────────────────────────────────────┐
│  DARK SIDEBAR   │  FLOATING ALABASTER CANVAS (Rounded "Island" Shell: border-radius: 36px) │
│  (#131417)      ├────────────────────────────┬───────────────────────────────────────────┤
│                 │  Header: User Pill & Title │  Global Search & Date Filter Dropdown     │
│  [flux] Logo    ├────────────────────────────┴───────────────────────────────────────────┤
│                 │  BENTO GRID (Asymmetric 12-Column Responsive Layout)                   │
│  Active Pill ──>│  ┌──────────────────────┬──────────────────────┬─────────────────────┐ │
│  (Sliding BG)   │  │  Widget 1: Tall      │  Widget 2: Metric    │  Widget 4: Grid     │ │
│                 │  │  Bubble Collision    │  Joint ROM (108°)    │  Valgus Heatmap %   │ │
│  Navigation     │  │  & Progress Bars     ├──────────────────────┤  Dot Scatter Matrix │ │
│  Icon Stack     │  │  Muscle Load Kcal    │  Widget 3: Metric    │                     │ │
│                 │  │  (4,3k total load)   │  Cadence (14 reps)   │                     │ │
│  Promo Box ────>│  │                      ├──────────────────────┴─────────────────────┤ │
│  Active Session │  │                      │  Widget 5: High-Contrast Dark Anchor Card  │ │
│  One-Click Call │  │                      │  "Session Depth & Form Analysis"           │ │
│  Launcher       │  │                      │  Hatched Diagonal Bars + Dual Luminous Pill │ │
└─────────────────┴─────────────────────────┴────────────────────────────────────────────┴─┘
```

---

## 2. Design System Tokens & Chromatic Chemistry

In strict adherence to `frontend-rules.md`, all layout dimensions, radii, and color assignments must use semantic variables. Direct raw hex codes or arbitrary utility styles inside components are strictly prohibited.

### 2.1 CSS Variables Specification (`client/src/styles/tokens.css`)

```css
:root {
  /* =========================================================================
     1. Surface & Canvas Tokens
     ========================================================================= */
  --surface-app-frame: #F4F6EA;        /* Soft ambient backdrop outside canvas */
  --surface-canvas: #FFFFFF;           /* Primary floating island canvas */
  --surface-canvas-subtle: #F9FAFB;    /* Secondary card background */
  --surface-border-subtle: #F0F1F5;    /* 1px structural dividing lines */
  --surface-border-strong: #E5E7EB;    /* Form controls & search borders */
  
  --surface-dark-sidebar: #131417;     /* High-contrast left navigation bar */
  --surface-dark-card: #18191C;        /* Inverted bottom-right anchor bento tile */
  --surface-dark-card-border: #26282E; /* Border on dark surfaces */
  --surface-dark-card-hover: #222429;  /* Elevated state for dark components */

  /* =========================================================================
     2. Typography & Contrast Tokens (WCAG 2.1 AA Guaranteed)
     ========================================================================= */
  --text-primary: #111827;             /* Heading & primary metric text (14:1) */
  --text-secondary: #4B5563;           /* Captions & secondary metrics (5.4:1) */
  --text-muted: #6B7280;               /* Helper text, timestamps (4.6:1) */
  --text-disabled: #9CA3AF;            /* Disabled state text only */
  
  --text-on-dark-primary: #F9FAFB;     /* High-contrast text on dark surfaces */
  --text-on-dark-secondary: #94A3B8;   /* Muted labels on dark surfaces */
  --text-on-dark-muted: #64748B;       /* Secondary captions on dark surfaces */

  /* =========================================================================
     3. Biomechanical Brand & Accent Tokens
     ========================================================================= */
  --accent-lime: #DAFE52;              /* Electric chartreuse - Active state & target */
  --accent-lime-hover: #C5EA3F;        /* Interactive press/hover state */
  --accent-lime-tint: rgba(218, 254, 82, 0.18); /* Soft glow & badge fills */
  
  --accent-lavender: #C8B6FF;          /* Secondary metric volume / Gluteal load */
  --accent-lavender-tint: rgba(200, 182, 255, 0.22);
  
  --accent-slate: #2D2F36;             /* Tertiary grouping / Posterior load */
  --accent-slate-tint: rgba(45, 47, 54, 0.12);

  /* =========================================================================
     4. Biomechanical Health State Tokens
     ========================================================================= */
  --status-stable: #10B981;            /* Normal joint alignment (<8% valgus) */
  --status-warning: #F59E0B;           /* Mild deviation (8-12% valgus) */
  --status-critical: #EF4444;          /* Form breakdown alert (>12% valgus) */
  --status-lost: #6B7280;              /* Landmark visibility < 0.65 */

  /* =========================================================================
     5. Spatial Scale (Strict 8pt Rhythm)
     ========================================================================= */
  --space-0-5: 0.125rem; /* 2px */
  --space-1:   0.25rem;  /* 4px */
  --space-2:   0.5rem;   /* 8px */
  --space-3:   0.75rem;  /* 12px */
  --space-4:   1.0rem;   /* 16px */
  --space-5:   1.25rem;  /* 20px */
  --space-6:   1.5rem;   /* 24px */
  --space-8:   2.0rem;   /* 32px */
  --space-10:  2.5rem;   /* 40px */
  --space-12:  3.0rem;   /* 48px */

  /* =========================================================================
     6. Curvature & Elevation Hierarchy
     ========================================================================= */
  --radius-outer-canvas: 2.25rem;  /* 36px - Floating main application container */
  --radius-bento-card: 1.5rem;     /* 24px - Inner Bento widgets */
  --radius-control: 1.0rem;        /* 16px - Inputs, search, small cards */
  --radius-pill: 9999px;           /* Full pill badges, primary CTA buttons */

  --shadow-canvas: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 0 1px 1px rgba(0, 0, 0, 0.03);
  --shadow-bento: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
  --shadow-glow-lime: 0 0 16px -2px rgba(218, 254, 82, 0.45);
}
```

---

## 3. UI/UX Critique & WCAG 2.1 AA Remediation

| Inspection Area | Original Reference Finding | UX / Usability Impact | KinesioLive Engineering Remediation |
| :--- | :--- | :--- | :--- |
| **Secondary Captions** | `#A1A1AA` on `#FFFFFF` (Contrast ~2.8:1) | Fails WCAG AA for normal body text. Unreadable in clinical lighting or on low-contrast monitors. | Promoted to `--text-secondary: #4B5563` (`5.4:1` contrast ratio). |
| **Bubble Area Comparison** | Overlapping circles with area encoding | Stevens' Power Law: Humans misjudge non-aligned circular areas by 15–25%. | Accompanied by linear percentage progress bars beneath the bubble chart, plus interactive hover value pills. |
| **Textured Bar Aliasing** | Diagonal striped fills in dark cards | Prone to moiré effect on standard 1x DPI displays. | Implemented via scalable SVG `<pattern>` vectors with fixed 1.5px stroke width and subpixel antialiasing. |
| **Live Telemetry Cognitive Load** | Static layout not built for 10Hz updates | Unbuffered DOM updates cause visual flicker and UI lag. | Framer Motion `useSpring` dampers interpolate 10 Hz telemetry into smooth 60 fps transitions. |
| **Keyboard & Screen Reader Access** | Implicit `div` click handlers | Inaccessible via keyboard navigation; lacks ARIA live regions for form corrections. | Native `<button>` tags with `aria-label`, visible `:focus-visible` rings, and `aria-live="polite"` feedback alerts. |

---

## 4. Multi-Page System Architecture for KinesioLive

```
                                  APPLICATION ROUTE TREE
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             / (Clinician Shell)                          /pt (Patient Shell)
                       │                                           │
       ┌───────────────┼───────────────┐           ┌───────────────┼───────────────┐
       ▼               ▼               ▼           ▼               ▼               ▼
   Overview         Studio          Reports     Overview        Studio          History
  (Bento HUD)     (Live Call)     (Analytics)  (Bento HUD)    (Live Pose)     (Past Reps)
```

### Page 1: Health & Rehab Overview (`/overview`)
* **Primary Role:** High-level biomechanical status and session launcher for patients and clinicians.
* **Layout Structure:**
  * **Header:** Patient profile dropdown (`Lucas Bennett / pt-demo`), global search, notification center, session date selector.
  * **Widget 1 (Left Column, Tall):** *Biomechanical Load & Muscle Distribution.* Bubble collision packing chart (Quads, Glutes, Hamstrings) with linear distribution bars.
  * **Widget 2 (Middle-Top):** *Real-Time Range of Motion.* Peak knee flexion angle (`108°` current vs `90°` target).
  * **Widget 3 (Middle-Bottom):** *Session Cadence & Rep Volume.* Total valid reps completed with average rep duration.
  * **Widget 4 (Right-Top):** *Valgus Symmetry Heatmap.* Dot matrix displaying left vs right knee stability across sets.
  * **Widget 5 (Right-Bottom, Dark Card):** *Session Depth & Fatigue Progression.* Monthly/weekly breakdown showing depth distribution (`shallow`, `good`, `deep`) with active session comparison.
  * **Sidebar Launcher:** One-click telerehab launcher connecting to Dr. Demo (`CLINICIAN_UID`) via CometChat Calls SDK v5.

### Page 2: Telerehab Live Studio & Pose HUD (`/studio`)
* **Primary Role:** Active rehabilitation session combining two-way video calling with real-time pose tracking.
* **Layout Structure:**
  * **Left Pane (Video & Skeletal Canvas):** Low-latency WebRTC video stream tapped via `requestVideoFrameCallback`, rendering 33-point MediaPipe landmarks with green/red joint alignment vectors.
  * **Right Pane (Telemetry HUD):** Floating dark instrument panel displaying instantaneous knee flexion, valgus deviation percentage, squat phase badge, and active rep counter.
  * **Bottom Bar (Clinician Cue Bar):** Quick-action coaching buttons (`"Knees Out"`, `"Chest Up"`, `"Slower Tempo"`) that transmit low-latency `KineCuePayload` messages over CometChat.

### Page 3: Biomechanical Analytics & Reports (`/reports`)
* **Primary Role:** Clinical review and kinematic analysis.
* **Layout Structure:**
  * Kinematic curve charts showing knee angle versus time for every squat rep.
  * Depth compliance breakdown with automated form alerts logged during the session.
  * PDF and CSV export utilities for medical records and insurance reimbursement documentation.

### Page 4: Patient Roster & Async Communication (`/messages`)
* **Primary Role:** Patient directory and asynchronous clinician-patient communication.
* **Layout Structure:**
  * Patient roster with CometChat real-time presence indicators (online/offline).
  * 1:1 direct messaging thread for post-workout feedback, exercise prescription updates, and video notes.

---

## 5. Animation Architecture: Watermelon UI & Motion.dev

In alignment with **Watermelon UI** and **Motion.dev**, all animations adhere to these rules:
1. **Physics Springs Over Linear Timing:** Spring-driven motion ensures natural velocity and settling without abrupt stops.
2. **Shared Layout Morphing (`layoutId`):** Active navigation indicators glide across tabs without redraw flickers.
3. **Staggered Hierarchical Entrances:** Grid elements cascade in with an 80ms interval.
4. **Hardware Acceleration:** Only `transform` (`x`, `y`, `scale`) and `opacity` are animated to prevent browser reflows.

### 5.1 Reusable Spring Presets (`client/src/styles/motionPresets.ts`)

```typescript
import { Transition } from "framer-motion";

export const springPresets = {
  /** Snappy micro-interactions (buttons, pills, toggle switches) */
  snappy: {
    type: "spring",
    stiffness: 420,
    damping: 30,
  } as Transition,

  /** Fluid layout animations (cards, bento tiles, navigation sliders) */
  layout: {
    type: "spring",
    stiffness: 300,
    damping: 28,
  } as Transition,

  /** Gentle entry transitions (modals, dropdown popovers, tooltips) */
  gentle: {
    type: "spring",
    stiffness: 200,
    damping: 24,
  } as Transition,

  /** 10Hz Telemetry Value Damper (smoothing raw coordinates into 60fps movement) */
  telemetry: {
    type: "spring",
    stiffness: 140,
    damping: 18,
  } as Transition,
};
```

### 5.2 Animated Sidebar Navigation (`SidebarNav.tsx`)

```tsx
import React from "react";
import { motion } from "framer-motion";
import { springPresets } from "../../styles/motionPresets";

export interface NavRoute {
  id: string;
  label: string;
  badge?: number;
  icon: React.ReactNode;
}

interface SidebarNavProps {
  routes: NavRoute[];
  activeRouteId: string;
  onRouteChange: (id: string) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  routes,
  activeRouteId,
  onRouteChange,
}) => {
  return (
    <nav className="flex flex-col gap-1.5 p-3 w-full" aria-label="Main Navigation">
      {routes.map((route) => {
        const isActive = activeRouteId === route.id;
        return (
          <button
            key={route.id}
            onClick={() => onRouteChange(route.id)}
            className={`relative flex items-center justify-between w-full px-4 py-3.5 rounded-full text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
              isActive ? "text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeNavigationPill"
                className="absolute inset-0 bg-white rounded-full shadow-sm"
                transition={springPresets.layout}
              />
            )}
            
            <div className="relative z-10 flex items-center gap-3.5">
              <span className="w-5 h-5 flex items-center justify-center">{route.icon}</span>
              <span className="tracking-tight">{route.label}</span>
            </div>

            {route.badge !== undefined && (
              <span
                className={`relative z-10 px-2 py-0.5 text-xs font-bold rounded-full ${
                  isActive
                    ? "bg-[#DAFE52] text-slate-950"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {route.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
```

### 5.3 Bento Grid Entrance Animation (`BentoGrid.tsx`)

```tsx
import React from "react";
import { motion, Variants } from "framer-motion";

const gridContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const bentoItemVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
    },
  },
};

export const BentoGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      variants={gridContainerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-12 gap-6 p-8 w-full max-w-[1440px] mx-auto"
    >
      {children}
    </motion.div>
  );
};
```

### 5.4 Joint Load Bubble Collision Chart (`BiomechanicalBubbleChart.tsx`)

```tsx
import React from "react";
import { motion } from "framer-motion";
import { springPresets } from "../../styles/motionPresets";

interface MuscleLoadItem {
  id: string;
  name: string;
  kcal: number;
  percentage: number;
  sizePx: number;
  bgColor: string;
  textColor: string;
}

interface BiomechanicalBubbleChartProps {
  totalLoadKcal: string;
  groups: MuscleLoadItem[];
}

export const BiomechanicalBubbleChart: React.FC<BiomechanicalBubbleChartProps> = ({
  totalLoadKcal,
  groups,
}) => {
  return (
    <div className="flex flex-col h-full justify-between">
      {/* Header Metric */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold tracking-wide text-slate-900 flex items-center gap-2">
            <span className="text-amber-500">⚡</span> Energy Used
          </span>
          <button className="text-slate-400 hover:text-slate-600 p-1" aria-label="Widget options">
            •••
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-tight text-slate-950">
            {totalLoadKcal}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#DAFE52] text-slate-950">
            +5%
          </span>
        </div>
        <span className="text-xs text-slate-500 font-medium">kcal today</span>
      </div>

      {/* Bubble Collision Cluster */}
      <div className="relative h-60 w-full flex items-center justify-center my-4">
        {groups.map((group, idx) => (
          <motion.div
            key={group.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              ...springPresets.layout,
              delay: idx * 0.1,
            }}
            whileHover={{
              scale: 1.08,
              transition: springPresets.snappy,
            }}
            whileTap={{ scale: 0.95 }}
            style={{
              width: `${group.sizePx}px`,
              height: `${group.sizePx}px`,
              backgroundColor: group.bgColor,
              color: group.textColor,
            }}
            className="rounded-full flex flex-col items-center justify-center cursor-pointer shadow-sm mx-[-12px] z-10 hover:z-20 select-none transition-shadow hover:shadow-md"
          >
            <span className="text-xl font-bold tracking-tight">{group.kcal}</span>
            <span className="text-xs opacity-80 font-medium">kcal</span>
          </motion.div>
        ))}
      </div>

      {/* Linear Percentage Bars */}
      <div className="space-y-3 pt-2">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: group.bgColor }}
                />
                {group.name}
              </span>
              <span>{group.percentage}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${group.percentage}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ backgroundColor: group.bgColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 6. High-Frequency Telemetry & Presentation Separation

To maintain 60 fps rendering during 10 Hz CometChat pose data streams (`TELEMETRY_RATE_HZ = 10`), business logic and WebSocket subscriptions are isolated from the visual presentation layer.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TELEMETRY LAYER SEPARATION                           │
├────────────────────────────────────────────────────────────────────────┤
│  [CometChat Chat SDK] Transient Messages @ 10 Hz                       │
│                         │                                              │
│                         ▼                                              │
│  [Container Hook] useTelemetryStream(sessionId)                        │
│  • Token bucket rate limiter (100ms interval)                          │
│  • Landmark visibility validation (vis >= 0.65)                        │
│  • State buffer updates without triggering full-tree re-renders        │
│                         │                                              │
│                         ▼                                              │
│  [Motion Value Interpolator] useSpring(targetValue, springPresets)     │
│  • Smooths 10 Hz discrete coordinate jumps into 60 fps transitions     │
│                         │                                              │
│                         ▼                                              │
│  [Presenter Component] MetricTile / SkeletalHUD                        │
│  • Pure UI rendering; strictly consumes typed props                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Container Hook Implementation (`useTelemetryStream.ts`)

```typescript
import { useState, useEffect, useRef } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { KinePosePayload } from "@kinesio/shared";

interface UseTelemetryStreamResult {
  currentPose: KinePosePayload | null;
  isConnected: boolean;
  error: Error | null;
}

export function useTelemetryStream(sessionId: string): UseTelemetryStreamResult {
  const [currentPose, setCurrentPose] = useState<KinePosePayload | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const listenerId = `kine-telemetry-${sessionId}`;

    try {
      CometChat.addMessageListener(
        listenerId,
        new CometChat.MessageListener({
          onTransientMessageReceived: (message: CometChat.TransientMessage) => {
            const now = performance.now();
            // 10 Hz rate limit (100ms throttle bucket)
            if (now - lastUpdateRef.current < 90) return;
            lastUpdateRef.current = now;

            try {
              const payload = JSON.parse(message.getData()?.data || "{}") as KinePosePayload;
              if (payload.type === "kine.pose") {
                setCurrentPose(payload);
              }
            } catch {
              // Ignore malformed packets to preserve render loop stability
            }
          },
        })
      );
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to attach listener"));
    }

    return () => {
      CometChat.removeMessageListener(listenerId);
      setIsConnected(false);
    };
  }, [sessionId]);

  return { currentPose, isConnected, error };
}
```

---

## 7. The 4 UI States Matrix

Every component must explicitly handle all four lifecycle states before rendering core data:

| State | Visual Behavior | Component Treatment |
| :--- | :--- | :--- |
| **1. Loading** | Subtle pulsing skeleton with matching border-radius (`rounded-[24px]`). | Shimmer effect with `--surface-border-subtle` background; no layout shifts. |
| **2. Empty** | Informative illustration, neutral prompt, and primary action button. | Clear guidance (e.g., *"No active session. Click 'Start Assessment' to begin"*). |
| **3. Error** | Non-blocking inline card with an error icon, error message, and a Retry button. | High-visibility warning badge (`--status-warning`) without unmounting parent wrappers. |
| **4. Success** | Full interactive bento card with active spring-based data animations. | Complete visual presentation with hover and tap interactions enabled. |

---

## 8. Frontend Quality & Verification Checklist

Before submitting frontend modifications, verify adherence to the following criteria:

- [ ] **Zero Raw Hex Codes:** All colors utilize semantic CSS tokens from `tokens.css`.
- [ ] **Strict 8pt Spatial Rhythm:** All margins, paddings, and gaps use standard grid increments.
- [ ] **Encapsulated Visual States:** Component consumers pass semantic props (`variant`, `size`) without overriding internal states via ad-hoc utility classes.
- [ ] **Separation of Concerns:** Telemetry streams and API fetches reside in custom hooks; presentation components remain pure.
- [ ] **Strict TypeScript & JSDoc:** Interfaces are fully typed and documented; no `any` types.
- [ ] **Four States Handled:** Components account for Loading, Empty, Error, and Success states.
- [ ] **WCAG 2.1 AA Compliance:** Minimum 4.5:1 text contrast ratio; keyboard tab stops and `:focus-visible` rings enabled.
- [ ] **Responsive Overflow Containment:** Flex containers include `min-w-0` and text truncation to prevent horizontal overflow on smaller viewports.
- [ ] **Physics-Based Springs:** Interactive animations use spring dynamics; linear transitions are avoided.
- [ ] **Camera Contention Safeguard:** Pose estimation reads from the active DOM `<video>` stream via `requestVideoFrameCallback` without re-requesting `getUserMedia`.
