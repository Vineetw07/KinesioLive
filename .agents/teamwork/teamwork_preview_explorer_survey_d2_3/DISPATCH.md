# Task Assignment: MediaPipe Pose Landmarker & Video Element Pipeline Survey (Survey Agent 3)

## Role & Archetype
- TypeName: teamwork_preview_explorer
- Role: MediaPipe Biomechanics Explorer
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/

## Context & Inputs
- User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- System TRD & Specs: `docs/trd.md` (specifically Section 1, Section 3, and camera contention defense) & `docs/audit.md`
- Client workspace dependencies: `@mediapipe/tasks-vision` in `client/package.json`

## Mission & Questions to Investigate
1. How is `@mediapipe/tasks-vision` PoseLandmarker initialized in browser with Vite?
   - What WASM files are required, and what CDN or local asset URLs should be passed to `FilesetResolver.forVisionTasks`?
   - How to configure `runningMode: "VIDEO"`?
2. Camera Contention Defense:
   - When a video element plays a webcam stream (or simulated video track for testing), how does MediaPipe extract frames without locking the MediaStream or colliding with WebRTC video tracks?
   - Investigate TRD Section 1 note: "DOM video tapping via `requestVideoFrameCallback`" or canvas drawing.
3. Live FPS Benchmark:
   - How to measure and report sustained pose inference FPS in the browser while video is actively rendering, verifying $\ge 15$ FPS?
4. Verification & Synthetic/Live Fallback:
   - In environments where a physical webcam may not be present (e.g. headless or automated testing), how can a test video feed or synthetic canvas video stream be provided so the spike testbed can deterministically run and validate 33 keypoints?

## Output
Write your findings to `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/report.md` and deliver `handoff.md`. Send a completion message when done.


## 2026-10-03T19:43:51Z
You are Survey Agent 3 (MediaPipe Biomechanics Explorer).
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/
Read your task assignment in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/DISPATCH.md and ORIGINAL_REQUEST.md.
Investigate @mediapipe/tasks-vision PoseLandmarker initialization, WASM loading, camera track contention defense (requestVideoFrameCallback), 33 landmarks verification, live FPS measurement, and synthetic video fallback for automated environments.
Write your findings to report.md and handoff.md in your working directory. Send a completion message back with send_message to recipient 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
