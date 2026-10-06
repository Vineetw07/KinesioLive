# Product Requirements Document (PRD) — KinesioLive

> **Event:** CometChat "Zero to Chat" Build Challenge (#ZeroToChat)  
> **Status:** APPROVED & ACTIVE  
> **Master Roadmap:** [implementation_plan.md](./implementation_plan.md)  
> **Technical Spec:** [trd.md](./trd.md)

---

## 1. Executive Summary & One-Liner
**KinesioLive** is a real-time tele-rehabilitation web platform where a clinician coaches a patient over a live video call while an in-browser computer vision pose model analyzes bodyweight squat form, streams 10 Hz joint telemetry into the clinician's HUD, flags knee valgus form alerts with measured deviation values, and preserves the entire workout as a structured exercise log inside the persistent chat history.

---

## 2. Target Users & User Stories

### Persona 1: The Patient (Post-Op / Physical Therapy Rehab)
- **Story 1.1:** As a patient, I want to join my therapy session via a simple link so that I don't have to install native desktop software.
- **Story 1.2:** As a patient, I want to see my own camera feed with a real-time skeleton overlay and rep counter so that I know my movement is being tracked correctly.
- **Story 1.3:** As a patient, I want immediate coaching cues (e.g., "Knees Out", "Slow Down") displayed prominently on my screen so that I can correct my posture in real time.

### Persona 2: The Physical Therapist / Clinician
- **Story 2.1:** As a clinician, I want to know when my patient has joined the room via an instant presence indicator.
- **Story 2.2:** As a clinician, I want to observe the patient over live WebRTC video while reviewing a real-time HUD showing joint angles and squat depth.
- **Story 2.3:** As a clinician, I want an automatic form alert whenever the patient exhibits knee valgus (inward knee collapse) with the exact measured deviation percentage.
- **Story 2.4:** As a clinician, I want one-click coaching cue buttons to guide the patient without talking over them.
- **Story 2.5:** As a clinician, I want an end-of-session summary showing total completed reps, average depth, and alert frequency automatically generated from the session chat history.

---

## 3. Product Scope & Boundaries

### ✅ In-Scope (MVP)
1. **Single Exercise Specialization:** Bodyweight squat.
2. **Landing Page & Role Selection:** Immersive dark hero portal (`LandingPage.tsx`) featuring 3D anatomical backdrop (`AnatomicalSkeletonBackdrop3D.tsx`), live session code entry, and role modal (`AuthModal.tsx`).
3. **Pre-Session Lobbies:**
   - **Clinician Lobby (`ClinicianLobby.tsx`):** Session GUID generator, invite link cloner, microphone/camera health preview, and instant studio entry.
   - **Patient Lobby (`PatientLobby.tsx`):** Real-time MediaPipe camera preflight, interactive kinematic mannequin (`KinematicMannequin3D.tsx`), standing posture baseline checklist.
4. **Patient Studio (`Patient.tsx`):** Live CometChat video call, subpixel canvas skeleton overlay (`canvasOverlayAligner.ts`), rep counter, 1-Euro adaptive jitter filter, and animated coaching cue toasts.
5. **Clinician Studio (`Clinician.tsx`):** Patient video feed, live biomechanics telemetry HUD (angles, depth), automated knee valgus alert badges, quick-cue trigger buttons, presence badge, and audio moderation mute.
6. **CometChat Core Integration:**
   - Calls SDK v5 (JavaScript WebRTC video).
   - Transient messages (10 Hz unpersisted telemetry stream with dual-transport BroadcastChannel sync).
   - Custom messages (persisted milestone events: reps with form score & rating, alerts, cues, session markers).
   - Group per session (`kine-<sessionId>`).
   - Server-minted auth tokens via REST API.
7. **Rep Form Scoring Engine:** Evaluates depth ratio, peak knee valgus deviation, and movement tempo into a composite score (0–100) and qualitative tier ("excellent" | "good" | "needs_work").
8. **Post-Session Analytics:** Comprehensive workout summary reconstructed from the CometChat group message history (`Summary.tsx`).
9. **Public HTTPS Deployment:** Single Render container with verified camera permissions.


### ❌ Out-of-Scope (Strict Non-Goals)
- User registration, billing, scheduling calendars, multiple exercise categories.
- Medical diagnostic claims (the platform issues *biomechanical form alerts*, never medical diagnoses).
- Native mobile applications (optimized for desktop Chromium browsers).
- Push notifications or SMS alerts.

---

## 4. Key Performance Indicators (Judging Criteria Alignment)
1. **It Runs:** Zero-lag WebRTC call connection ($< 3.0$ s join time) with $\ge 15$ FPS pose inference.
2. **It's Interesting:** Transforms a routine video call into an active biomechanical feedback loop using chat messages as the telemetry bus.
3. **Uses the MCP:** Every CometChat SDK call and bundle is derived from and traceable to live MCP tools in `COMETCHAT_INTEGRATION.md`.
4. **Form Reliability:** False-positive valgus alert rate $< 5\%$ across calibrated normal squat stances (neutral axis drift $< 2.0\% L_{\text{standing}}$).

---

## 🔄 Dynamic Update Trigger Matrix
- If scope expands or features are cut, update Section 3 here and reflect in [implementation_plan.md](./implementation_plan.md) and [task.md](../task.md).
- If field names or payloads change, update [trd.md](./trd.md).
