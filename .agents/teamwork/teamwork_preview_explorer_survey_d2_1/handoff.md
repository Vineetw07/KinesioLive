# Handoff Report — Client Architecture & Route Survey for `/spikes`

**Agent:** Survey Agent 1 (Client Architecture Explorer)  
**Task:** Survey client setup, routing, UI structure, App.tsx, Vite config, dependencies, and recommend `/spikes` mount strategy.  
**Destination Folder:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_1/`

---

## 1. Observation

1. **Routing State in `client/package.json` (lines 13–21):**
   ```json
   "dependencies": {
     "@cometchat/calls-sdk-javascript": "^5.0.5",
     "@cometchat/chat-sdk-javascript": "^4.1.13",
     "@kinesio/shared": "workspace:*",
     "@mediapipe/tasks-vision": "^0.10.14",
     "framer-motion": "^12.0.0",
     "react": "^19.0.0",
     "react-dom": "^19.0.0"
   }
   ```
   No routing library (`react-router-dom` or similar) is installed.

2. **Root Render in `client/src/main.tsx` (lines 6–13):**
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
   Directly mounts `<App />` with no router provider.

3. **Current UI in `client/src/App.tsx` (lines 17–295):**
   `App` is a monolithic single-screen component managing `role`, `sessionIdInput`, and `session` state. It fetches `/api/health` on load and executes `POST /api/session` when the user clicks "Initialize Live Session". It has no view switching or route handling.

4. **Vite Configuration in `client/vite.config.ts` (lines 5–19):**
   ```typescript
   export default defineConfig({
     plugins: [react()],
     define: {
       global: 'window',
     },
     server: {
       port: 5173,
       proxy: {
         '/api': {
           target: 'http://localhost:5000',
           changeOrigin: true,
         },
       },
     },
   });
   ```
   Proxies `/api` to port 5000; defaults to standard Vite SPA history fallback (`appType: 'spa'`), meaning any route like `/spikes` returns `index.html`.

5. **Styling in `client/src/index.css` (lines 1–187):**
   Uses vanilla CSS custom properties (`--bg-primary`, `--bg-surface`, `--accent-cyan`, `--accent-blue`, etc.) and classes namespaced with `.kine-*` (`.kine-container`, `.kine-header`, `.kine-card`, `.kine-button`, `.kine-stat`). Coupled with `framer-motion` (`motion.div`, `AnimatePresence`) in `App.tsx`. Tailwind is not present.

6. **Build & Test Verification Commands:**
   - Command: `pnpm --filter @kinesio/client typecheck` -> Exited 0 (`tsc --noEmit`).
   - Command: `pnpm --filter @kinesio/client build` -> Exited 0 (`tsc -b && vite build` completed in 2.35s).
   - Command: `pnpm --filter @kinesio/client exec vitest run --root .. tests/e2e/health.test.ts` -> Exited 0 (10 tests passed).

---

## 2. Logic Chain

1. **Step 1 (Zero-dependency routing preference):**
   Observation 1 shows `react-router-dom` is not installed, while React 19 is installed (`"react": "^19.0.0"`). Installing `react-router-dom` would add ~150-200 KB overhead, introduce potential React 19 peer-dependency warnings in `pnpm`, and violate the **Ladder of Necessity** (Rule 8: "Standard library first. Native platform primitives over packages. Fewest files and lines possible").

2. **Step 2 (Vite SPA Fallback enables Native Pathname Routing):**
   Observation 4 shows `vite.config.ts` runs standard Vite SPA fallback. Any navigation or direct URL entry to `http://localhost:5173/spikes` serves `index.html`, which invokes `main.tsx`. Therefore, a simple React hook listening to `window.location.pathname` and `popstate` events can switch routes deterministically with 0 dependencies.

3. **Step 3 (Bundle protection via `React.lazy`):**
   Observation 1 shows heavy packages (`@mediapipe/tasks-vision`, `@cometchat/calls-sdk-javascript`). If `SpikesHarness` is statically imported into `App.tsx`, these heavy modules will bloat the main root chunk. Lazy-loading `SpikesHarness = React.lazy(() => import('./spikes/SpikesHarness'))` isolates the testbed into a separate chunk loaded only when visiting `/spikes`.

4. **Step 4 (Zero disruption to existing UI):**
   Observation 3 shows the existing session setup UI in `App.tsx`. By conditioning the view render on `currentPath === '/spikes'`, the existing session setup logic remains completely intact on `/`, while `/spikes` renders `SpikesHarness`. A header switcher allows toggling between both routes with 1 click.

---

## 3. Caveats

1. **Production Static Hosting:** While Vite dev server automatically provides SPA history fallback, the Express server in `server/src/index.ts` currently only exposes `/api/health` and `/api/session`. When Express is configured to serve static files from `client/dist/` in Day 6, an Express wildcard handler (`app.get('*', ...)`) must serve `index.html` so direct navigation to `/spikes` works in production without 404ing.
2. **Webcam Permissions in Browser:** Spike S1 requires access to the camera via `getUserMedia`. If camera permissions are denied or running in a headless test environment, Spike S1 will require a fallback synthetic canvas/video source or test fixture to avoid unhandled rejections.

---

## 4. Conclusion

1. **Routing:** Do **not** install `react-router-dom`. Use a native pathname listener (`window.location.pathname` + `popstate`) paired with `React.lazy` inside `client/src/App.tsx`.
2. **Styling:** Adhere to the existing `.kine-*` CSS variable tokens in `client/src/index.css` and use `framer-motion` for transitions. Add `client/src/spikes/spikes.css` for harness-specific HUD components.
3. **Directory Structure:** Create `client/src/spikes/` with subdirectories: `s1-pose/`, `s2-telemetry/`, `s3-calls/`, `s4-persistence/`, `components/`, `hooks/`, and `utils/`, orchestrated by `SpikesHarness.tsx` as the D2.5 Kill-Switch Evaluation Gate.

---

## 5. Verification Method

To independently verify all findings:
1. **Verify no router package:**
   Inspect `client/package.json` and run:
   ```powershell
   Select-String -Path "client/package.json" -Pattern "react-router"
   ```
   (Must return 0 hits).
2. **Verify client typecheck:**
   ```powershell
   pnpm --filter @kinesio/client typecheck
   ```
   (Must exit with code 0).
3. **Verify client production build:**
   ```powershell
   pnpm --filter @kinesio/client build
   ```
   (Must exit with code 0).
4. **Inspect full survey findings:**
   Read `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_1/report.md`.
