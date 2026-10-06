# Research Report: Pose Skeleton Dislocation & Inverted Layout RCA

**Target Document:** Root Cause Analysis (RCA) on Pose Skeleton Dislocation & Inversion  
**Date:** 2026-10-06  
**Status:** Complete Investigation (Awaiting User Alignment)  
**Primary Sources Examined:**
- Uploaded User Artifacts: [media_1791269117216.jpg](file:///C:/Users/ASUS/.gemini/antigravity/brain/0dd9f189-cbc4-4753-aa37-e974a930a506/.user_uploaded/media_1791269117216.jpg), [media_1791269117298.jpg](file:///C:/Users/ASUS/.gemini/antigravity/brain/0dd9f189-cbc4-4753-aa37-e974a930a506/.user_uploaded/media_1791269117298.jpg), [media_1791269117557.jpg](file:///C:/Users/ASUS/.gemini/antigravity/brain/0dd9f189-cbc4-4753-aa37-e974a930a506/.user_uploaded/media_1791269117557.jpg)
- Client Codebase: [`client/src/views/Patient.tsx`](file:///d:/TP/Hackathon/Cometchat/client/src/views/Patient.tsx), [`client/src/utils/canvasOverlayAligner.ts`](file:///d:/TP/Hackathon/Cometchat/client/src/utils/canvasOverlayAligner.ts)
- Test Suite: [`tests/canvasOverlayAligner.test.ts`](file:///d:/TP/Hackathon/Cometchat/tests/canvasOverlayAligner.test.ts)

---

## 1. Executive Summary & Visual Evidence Analysis

In the live camera feed photos provided from your screen:
1. **The Grid Layout:**
   - **Left Tile:** Shows the patient's camera feed (`Patient Demo (You)`), standing holding a smartphone.
   - **Right Tile:** Shows `Dr. Demo` (clinician participant with camera off or avatar placeholder).
2. **The Anomaly:**
   - The yellow biomechanical skeleton overlay, along with the degree arcs (`165°`, `167°`, `174°`, `7% DEV`), is rendered **over the right panel (`Dr. Demo`)** instead of on top of the patient's video feed.
   - Furthermore, the skeleton connects strangely (e.g. one leg points to the left audio button or the lower controls), and the skeleton is upside down / horizontally inverted or drawn relative to coordinates outside the patient's tile.
   - When stepping close, the banner *"Step back to frame full body for squat tracking"* appears, yet the skeleton continues rendering phantom joints.

---

## 2. Root Cause Analysis (Deep Dive)

### Cause A: Video Element Selection Scoring Inversion (`findPatientVideoElement`)
In [`client/src/views/Patient.tsx#L216`](file:///d:/TP/Hackathon/Cometchat/client/src/views/Patient.tsx#L216), `syncCanvasToVideo` does:
```typescript
videoEl.style.transform = isMirrorMode ? 'scaleX(-1)' : 'none';
```
When `findPatientVideoElement` runs:
```typescript
for (const v of videos) {
  let score = 0;
  // ...
  if (vStyle.transform && (vStyle.transform.includes('scaleX(-1)') || vStyle.transform.includes('matrix(-1'))) {
    score += 45;
  }
}
```
If `syncCanvasToVideo` ran previously on the incorrect video (or during initialization when tile ordering was still shifting), `videoEl.style.transform = 'scaleX(-1)'` was directly stamped onto the wrong video element (`video2` / `Dr. Demo`), giving that wrong video an extra +45 points perpetually.

More critically, in CometChat Calls SDK v5:
- Remote participant containers also contain `<video>` elements (or audio/video media wrappers) whose ancestor container or text hierarchy can match or default to index `0` or `1` depending on WebRTC track negotiation order.
- In `findPatientVideoElement`:
  ```typescript
  // Ancestor loop
  if (pAria.includes('(you)') || pAria.includes('self-view')) score += 100;
  ```
  If `Dr. Demo`'s tile or placeholder contains text like `"Dr. Demo"` and `Patient Demo (You)` is in the first tile, why did `Dr. Demo` get selected?
  In CometChat Calls v5:
  When Dr. Demo has no active camera or has an audio track, Calls SDK creates a `<video>` or `<audio>` placeholder, but if Dr. Demo's video stream is created, the grid arranges `[Dr. Demo, Patient Demo]`.
  When Dr. Demo's tile is inspected, if neither tile has `data-uid` on the `<video>` element itself, but Dr. Demo has `id` or attributes, or if `v.muted` was true for both, the score tied or selected `Dr. Demo`.
  Once `Dr. Demo`'s `<video>` element was selected, `computeCanvasOverlayBounds` measured:
  ```typescript
  const left = Math.round(vRect.left - cRect.left);
  ```
  Since `Dr. Demo` is on the **right side** of the split screen, `vRect.left` placed the `<canvas>` at `left: ~50%` (right half of the screen)!
  MediaPipe PoseLandmarker, however, was ingesting frames from that same `videoEl`. If `videoEl` was Dr. Demo (black screen / avatar / static), why was a skeleton detected at all?
  **Notice:** The skeleton is in fact tracking your body (standing, legs, angle 165°)!
  This means MediaPipe was ingesting the **left video** (or fallback video), BUT the canvas bounds were computed from the **right video** (or vice versa)!

### Cause B: De-synchronization Between Ingestion Video & Overlay Video
In [`client/src/views/Patient.tsx#L524-L545`](file:///d:/TP/Hackathon/Cometchat/client/src/views/Patient.tsx#L524-L545):
```typescript
const checkForVideoElement = () => {
  const videoEl = findPatientVideoElement(...);
  // ...
  startVideoPosePipeline(videoEl, ..., (result, latencyMs) => {
    handlePoseFrame(result, latencyMs, videoEl!);
  });
};
```
However, in `handleResize` and in the periodic 1-second interval:
```typescript
const handleResize = () => {
  const activeVideo = findPatientVideoElement(...);
  if (activeVideo) {
    activeVideoRef.current = activeVideo;
    syncCanvasToVideo(activeVideo);
  }
};
```
If `handleResize` or the 1-second sync interval picks Video B (`Dr. Demo`) while `startVideoPosePipeline` was started with Video A (`Patient`), then:
1. MediaPipe is tracking your body from Video A (Patient).
2. `syncCanvasToVideo` moves the `<canvas>` element's CSS `left` and `top` to match Video B (`Dr. Demo`)!
3. The skeleton drawn on the canvas is your body's landmarks, but the canvas itself is anchored over Dr. Demo's tile!

### Cause C: Glitching & Stray Connection Lines
Look closely at [media_1791269117216.jpg](file:///C:/Users/ASUS/.gemini/antigravity/brain/0dd9f189-cbc4-4753-aa37-e974a930a506/.user_uploaded/media_1791269117216.jpg) and [media_1791269117298.jpg](file:///C:/Users/ASUS/.gemini/antigravity/brain/0dd9f189-cbc4-4753-aa37-e974a930a506/.user_uploaded/media_1791269117298.jpg):
1. **Partial Body Occlusion:**
   The camera only sees from mid-thigh/hips up to the chest. The ankles and lower shins are completely off-screen below the laptop bezel.
2. In BlazePose / MediaPipe PoseLandmarker:
   When knees or ankles are cut off at the bottom of the camera frame, MediaPipe's regression head *hallucinates* coordinate estimates (often pinning them to coordinates `y ≈ 0.95 - 1.2` or snapping to arbitrary corners).
3. In `drawSkeletonOnCanvas`:
   - Connections `[25, 27]` (Left Knee -> Left Ankle) and `[26, 28]` (Right Knee -> Right Ankle) still draw if `p1.visible && p2.visible`.
   - In `mapLandmarkToCanvas`, `isWithinFrame` allows landmarks up to `y <= 1.05`.
   - When ankles are estimated outside or right at the border, the lines shoot down to the bottom controls (mic/camera buttons).
4. `drawMechanicalAxisPlumbLine`:
   The dashed plumb line connects hip to ankle, which extends down past the video into the bottom controls bar.

---

## 3. Options for Discussion & Alignment

We have three distinct ways to solve this cleanly:

### Option 1: Direct Video Parent Binding & Single Reference Anchor (Recommended)
- **Mechanism:**
  1. Instead of positioning `<canvas>` as an absolute child of the outer `cameraContainerRef` and guessing offsets (`vRect.left - cRect.left`), **mount or anchor the canvas directly over the patient's video tile**. Or, strictly bind `activeVideoRef` once at pipeline start so `syncCanvasToVideo` and `startVideoPosePipeline` ALWAYS reference the exact same DOM element.
  2. In `findPatientVideoElement`:
     - Explicitly blacklist any tile containing `"Dr. Demo"` or `clinician` text.
     - Positively identify the local patient tile via `pt-demo` or `(You)` badge.
     - Never mutate `videoEl.style.transform` inside `syncCanvasToVideo` before selection is guaranteed (to avoid giving false `scaleX(-1)` scores to the wrong tile).
  3. **Strict Lower-Body Visibility Clamping:**
     When ankles or knees have low visibility or are cut off below the frame edge, clamp or omit lower extremity bones instead of shooting stray lines down to the bottom navigation bar.

### Option 2: Fallback to Offline Camera View Inside Studio When In Call
- **Mechanism:**
  Dedicate a fixed, isolated local preview container for the patient's own camera + skeleton overlay, and keep CometChat Calls video tiles side-by-side without canvas overlays across the WebRTC grid.

### Option 3: Overlay Directly Inside Canvas Video Pipeline (Virtual Background / Composited Stream)
- **Mechanism:**
  Render the skeleton directly onto a canvas that composites the video feed itself, completely avoiding CSS overlay alignment issues.

---

## 4. Next Step
Before editing code, please review the analysis and let me know your preferred alignment approach or specific adjustments.
