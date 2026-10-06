/**
 * client/src/utils/canvasOverlayAligner.ts
 *
 * Dedicated, Zero-Hallucination Video & Canvas Overlay Alignment Engine.
 * Ensures the MediaPipe skeleton canvas overlays with 1:1 pixel precision
 * directly on top of the patient's local video feed tile across:
 * - Single-participant full-view calls
 * - Multi-participant / grid call layouts (e.g. Patient Demo (You) + Dr. Demo)
 * - Standalone offline camera fallback
 * - CSS mirrored / unmirrored camera streams
 * - Dynamic aspect-ratio letterboxing / pillarboxing (object-fit: cover / contain)
 */

import { OneEuroFilter } from '../engine/smoothing';

export interface CanvasOverlayBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  objectFit: 'cover' | 'contain' | 'fill';
  isMirrored: boolean;
  borderRadius: string;
}

export interface VideoContentRect {
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  contentHeight: number;
  scaleX: number;
  scaleY: number;
}

export interface SkeletonLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface TransformedLandmark {
  x: number;
  y: number;
  visible: boolean;
}

export interface SkeletonColors {
  stable?: string;
  critical?: string;
  accent?: string;
}

export const VISIBILITY_THRESHOLD = 0.50;

/**
 * BlazePose keypoint indices for comprehensive skeletal alignment.
 */
export const SKELETON_CONNECTIONS: Array<[number, number]> = [
  // Upper Body & Chest
  [11, 12], // Clavicle / Shoulders
  [11, 23], // Left Torso (Shoulder -> Hip)
  [12, 24], // Right Torso (Shoulder -> Hip)
  [23, 24], // Pelvis / Hip Line

  // Upper Extremities (Arms)
  [11, 13], // Left Upper Arm
  [13, 15], // Left Forearm
  [12, 14], // Right Upper Arm
  [14, 16], // Right Forearm

  // Lower Extremities (Legs)
  [23, 25], // Left Femur
  [25, 27], // Left Tibia
  [24, 26], // Right Femur
  [26, 28], // Right Tibia
];

/**
 * Key joint indices highlighted on the canvas overlay.
 * Includes both upper body (shoulders, elbows, wrists) and lower body (hips, knees, ankles).
 */
export const SKELETON_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/**
 * Checks whether a leg landmark (ankle or knee) is reliably within camera framing.
 * Suppresses tibia connections and mechanical plumb lines when the landmark
 * is near/beyond the bottom border (y > 0.95) or has low confidence (visibility < 0.60)
 * to prevent stray/hallucinated lines.
 */
export function isLandmarkReliable(lm?: SkeletonLandmark): boolean {
  if (!lm) return false;
  const vis = lm.visibility ?? 1;
  return vis >= 0.60 && lm.y <= 0.95;
}

/**
 * Backward compatibility alias for isLandmarkReliable.
 */
export function isAnkleReliable(ankleLm?: SkeletonLandmark): boolean {
  return isLandmarkReliable(ankleLm);
}

// Module-level cache tracking the last bound patient video for stability across renders/polls
let lastBoundPatientVideo: HTMLVideoElement | null = null;

export function resetPatientVideoCache(): void {
  lastBoundPatientVideo = null;
}

/**
 * Finds the patient's local video element within the call container or fallback camera.
 * In multi-participant calls, this reliably disambiguates between the local patient tile
 * and remote clinician/participant tiles using multi-factor heuristic scoring.
 * Introduces strong -1000 penalty against clinician/doctor/remote tiles, strongly rewards
 * patient identity tokens, and ignores transform unless patient tokens match.
 */
export function findPatientVideoElement(
  callContainer: HTMLElement | null,
  fallbackVideo: HTMLVideoElement | null,
  isFallback: boolean,
  patientUid: string = 'pt-demo',
  patientName: string = 'Patient Demo',
  boundVideo?: HTMLVideoElement | null
): HTMLVideoElement | null {
  if (isFallback) {
    lastBoundPatientVideo = fallbackVideo;
    return fallbackVideo;
  }
  if (!callContainer) return null;

  const videos = Array.from(callContainer.querySelectorAll('video'));
  if (videos.length === 0) return null;

  const uidLower = patientUid.toLowerCase();
  const nameLower = patientName.toLowerCase();
  const activeBound = boundVideo || lastBoundPatientVideo;

  // Pre-scan: Check if any candidate video tile explicitly has "(you)" or local markers.
  // This definitively identifies the local patient in multi-participant calls where
  // multiple participants share the same username (e.g. testing with two "Patient Demo" tabs).
  let anyTileHasLocalMarker = false;
  for (const v of videos) {
    const vAria = (v.getAttribute('aria-label') || '').toLowerCase();
    const vClass = (v.className || '').toLowerCase();
    if (vAria.includes('(you)') || vAria.includes('self-view') || vClass.includes('tile-local') || vClass.includes('self')) {
      anyTileHasLocalMarker = true;
      break;
    }
    let p = v.parentElement;
    let d = 0;
    while (p && p !== callContainer && d < 8) {
      // Do not leak across common containers that wrap multiple videos (e.g. grid layout)
      if (p.querySelectorAll('video').length > 1) break;
      const txt = (p.innerText || p.textContent || '').toLowerCase();
      const pAria = (p.getAttribute('aria-label') || '').toLowerCase();
      const pClass = (p.className || '').toString().toLowerCase();
      if (txt.includes('(you)') || pAria.includes('(you)') || txt.includes('self-view') || pClass.includes('tile-local')) {
        anyTileHasLocalMarker = true;
        break;
      }
      p = p.parentElement;
      d++;
    }
    if (anyTileHasLocalMarker) break;
  }

  let bestVideo: HTMLVideoElement | null = null;
  let highestScore = -Infinity;

  for (const v of videos) {
    let score = 0;
    let hasPatientIdentity = false;
    let isExplicitlyLocal = false;
    let isExplicitlyRemote = false;

    // Check video's own attributes
    const vId = (v.id || '').toLowerCase();
    const vClass = (v.className || '').toLowerCase();
    const vAria = (v.getAttribute('aria-label') || '').toLowerCase();
    const vDataUid = (v.getAttribute('data-uid') || v.getAttribute('data-participant-id') || v.getAttribute('data-user-id') || '').toLowerCase();

    // Clinician rejection: strong negative penalty (-2000 score) if video element contains strings associated with remote clinician tiles
    const isClinicianVideo =
      vDataUid.includes('dr. demo') ||
      vDataUid.includes('dr demo') ||
      vDataUid.startsWith('dr-') ||
      vDataUid.includes('doctor') ||
      vDataUid.includes('clinician') ||
      vDataUid === 'dr-demo' ||
      vId.includes('dr. demo') ||
      vId.includes('dr demo') ||
      vId.includes('dr-') ||
      vId.includes('doctor') ||
      vId.includes('clinician') ||
      vId.includes('drdemo') ||
      vAria.includes('dr. demo') ||
      vAria.includes('dr demo') ||
      vAria.includes('dr.') ||
      vAria.includes('doctor') ||
      vAria.includes('clinician') ||
      vClass.includes('remote') ||
      vClass.includes('tile-remote');

    if (isClinicianVideo) {
      score -= 2000;
      isExplicitlyRemote = true;
    }

    if (vAria.includes('(you)')) { isExplicitlyLocal = true; hasPatientIdentity = true; }
    if (vAria.includes('self-view') || vAria.includes('self view') || vAria.includes('self')) { isExplicitlyLocal = true; hasPatientIdentity = true; }
    if (vClass.includes('tile-local')) { isExplicitlyLocal = true; hasPatientIdentity = true; }
    if (vClass.includes('local') || vClass.includes('self')) { isExplicitlyLocal = true; hasPatientIdentity = true; }
    if (vAria.includes('patient demo') || vAria.includes('pt-demo')) { hasPatientIdentity = true; }
    if (vDataUid === uidLower || vDataUid === 'pt-demo') { hasPatientIdentity = true; }
    if (vId.includes(uidLower) || vId.includes('pt-demo')) { hasPatientIdentity = true; }
    if (vAria.includes(nameLower)) { hasPatientIdentity = true; }

    // Inspect unique tile ancestor chain ONLY (stopping if container wraps multiple videos)
    let parent: HTMLElement | null = v.parentElement;
    let depth = 0;
    let ancestorHasMirror = false;
    let hasAvatarPlaceholder = false;

    while (parent && parent !== callContainer && depth < 8) {
      // STOP traversal immediately if this ancestor contains more than 1 video!
      // This prevents multi-tile containers (e.g. grid, layout) from leaking text like "(you)" or identities
      // across different participants' tiles.
      if (parent.querySelectorAll('video').length > 1) {
        break;
      }

      const text = (parent.innerText || parent.textContent || '').toLowerCase();
      const pClass = (parent.className || '').toString().toLowerCase();
      const pAria = (parent.getAttribute('aria-label') || '').toLowerCase();
      const pDataUid = (parent.getAttribute('data-uid') || parent.getAttribute('data-participant-id') || parent.getAttribute('data-user-id') || '').toLowerCase();

      // Strong negative penalty (-2000 score) if ancestor container contains remote clinician strings
      const isClinicianAncestor =
        text.includes('dr. demo') ||
        text.includes('dr demo') ||
        text.includes('doctor') ||
        text.includes('clinician') ||
        pAria.includes('dr. demo') ||
        pAria.includes('dr demo') ||
        pAria.includes('doctor') ||
        pAria.includes('clinician') ||
        pDataUid.includes('dr. demo') ||
        pDataUid.includes('dr demo') ||
        pDataUid.startsWith('dr-') ||
        pDataUid.includes('doctor') ||
        pDataUid.includes('clinician') ||
        pDataUid === 'dr-demo';

      if (isClinicianAncestor) {
        score -= 2000;
        isExplicitlyRemote = true;
      }

      // Detect remote tile markers
      if (pClass.includes('tile-remote') || pClass.includes('remote')) {
        isExplicitlyRemote = true;
      }

      // Detect avatar / camera-off placeholder
      if (
        pClass.includes('avatar') ||
        pClass.includes('initials') ||
        parent.querySelector('[class*="avatar"], [class*="initials"]')
      ) {
        hasAvatarPlaceholder = true;
      }

      // Positive local patient markers on this unique tile
      if (text.includes('(you)') || pAria.includes('(you)')) {
        isExplicitlyLocal = true;
        hasPatientIdentity = true;
      }
      if (pAria.includes('self-view') || pAria.includes('self view') || pAria.includes('self')) {
        isExplicitlyLocal = true;
        hasPatientIdentity = true;
      }
      if (pClass.includes('tile-local') || pClass.includes('local') || pClass.includes('self')) {
        isExplicitlyLocal = true;
        hasPatientIdentity = true;
      }

      // Patient identity tokens on this unique tile
      if (text.includes('patient demo') || text.includes('pt-demo') || pAria.includes('patient demo') || pAria.includes('pt-demo')) {
        hasPatientIdentity = true;
      }
      if (pDataUid === uidLower || pDataUid === 'pt-demo' || text.includes(nameLower) || text.includes(uidLower)) {
        hasPatientIdentity = true;
      }

      try {
        const pStyle = window.getComputedStyle(parent);
        if (pStyle.transform && (pStyle.transform.includes('scaleX(-1)') || pStyle.transform.includes('matrix(-1'))) {
          ancestorHasMirror = true;
        }
      } catch {
        // Non-browser env
      }

      parent = parent.parentElement;
      depth++;
    }

    // Evaluate score once (not accumulated per depth level):
    // 1. Definite local markers
    if (isExplicitlyLocal) {
      score += 1000;
    } else if (anyTileHasLocalMarker) {
      // Another tile has explicit local marker '(you)', so this tile is definitively a remote participant!
      score -= 1000;
      isExplicitlyRemote = true;
    }

    if (isExplicitlyRemote) {
      score -= 1000;
    }

    if (hasPatientIdentity) {
      score += 200;
    }

    // Active video stream evaluation:
    // A video element actively playing frames is preferred over an avatar placeholder or zero-dimension video
    const hasDimensions = (v.videoWidth || 0) > 0 && (v.videoHeight || 0) > 0;
    const isReady = typeof v.readyState === 'number' ? v.readyState >= 2 : true;

    if (hasDimensions && isReady) {
      score += 500;
    } else if (!hasDimensions) {
      score -= 400;
    }

    if (hasAvatarPlaceholder) {
      score -= 300;
    }

    // Mirror transform bonus ONLY if patient identity confirmed and not remote
    let videoHasMirror = false;
    try {
      const vStyle = window.getComputedStyle(v);
      if (vStyle.transform && (vStyle.transform.includes('scaleX(-1)') || vStyle.transform.includes('matrix(-1'))) {
        videoHasMirror = true;
      }
    } catch {
      // Non-browser env
    }

    if ((videoHasMirror || ancestorHasMirror) && hasPatientIdentity && !isExplicitlyRemote) {
      score += 50;
    }

    // Stability bonus: keep current bound video if it is still attached, valid, and not remote
    if (activeBound && v === activeBound && !isExplicitlyRemote) {
      score += 150;
    }

    if (score > highestScore) {
      highestScore = score;
      bestVideo = v;
    }
  }

  // Reject candidates that scored negatively (clinician, remote tiles, or avatar-only tiles)
  if (highestScore < 0) {
    return null;
  }

  if (bestVideo) {
    lastBoundPatientVideo = bestVideo;
  }

  return bestVideo;
}

/**
 * Checks whether a video element is horizontally mirrored.
 * Only returns true if videoEl or its container hierarchy actually has a computed CSS transform
 * containing matrix(-1, scaleX(-1), scale(-1, or rotateY(180deg).
 * Zero guesswork from arbitrary text like "(you)" or blind local patient defaults!
 */
export function isVideoMirrored(videoEl: HTMLVideoElement | null, explicitMirror?: boolean): boolean {
  if (explicitMirror !== undefined) return explicitMirror;
  if (!videoEl) return false;

  const hasMirrorTransform = (transform: string | null | undefined): boolean => {
    if (!transform || transform === 'none') return false;
    return (
      transform.includes('matrix(-1') ||
      transform.includes('scaleX(-1)') ||
      transform.includes('scale(-1') ||
      transform.includes('rotateY(180deg)')
    );
  };

  // Check the video element's own computed style
  try {
    const style = window.getComputedStyle(videoEl);
    if (hasMirrorTransform(style.transform)) {
      return true;
    }
  } catch {
    // Non-browser env
  }

  // Check parent and ancestor elements up to container boundary
  let el = videoEl.parentElement;
  let depth = 0;
  while (el && el !== document.body && depth < 8) {
    try {
      const s = window.getComputedStyle(el);
      if (hasMirrorTransform(s.transform)) {
        return true;
      }
    } catch {
      // Ignore
    }
    el = el.parentElement;
    depth++;
  }

  return false;
}

/**
 * Computes exact 1:1 pixel alignment bounds for placing the canvas overlay
 * directly on top of the targeted video element, relative to their shared container.
 */
export function computeCanvasOverlayBounds(
  videoEl: HTMLVideoElement | null,
  containerEl: HTMLElement | null,
  explicitMirror?: boolean
): CanvasOverlayBounds {
  const defaultBounds: CanvasOverlayBounds = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    objectFit: 'cover',
    isMirrored: false,
    borderRadius: '0px',
  };

  if (!videoEl || !containerEl) return defaultBounds;

  const vRect = videoEl.getBoundingClientRect();
  const cRect = containerEl.getBoundingClientRect();

  if (vRect.width <= 0 || vRect.height <= 0 || cRect.width <= 0 || cRect.height <= 0) {
    return defaultBounds;
  }

  const left = Math.round(vRect.left - cRect.left);
  const top = Math.round(vRect.top - cRect.top);
  const width = Math.round(vRect.width);
  const height = Math.round(vRect.height);

  let computedFit: 'cover' | 'contain' | 'fill' = 'cover';
  let borderRadius = '0px';

  try {
    const vStyle = window.getComputedStyle(videoEl);
    const fit = vStyle.objectFit;
    if (fit === 'contain' || fit === 'cover' || fit === 'fill') {
      computedFit = fit;
    } else {
      const pStyle = videoEl.parentElement ? window.getComputedStyle(videoEl.parentElement) : null;
      if (pStyle?.objectFit === 'contain' || pStyle?.objectFit === 'cover' || pStyle?.objectFit === 'fill') {
        computedFit = pStyle.objectFit as 'contain' | 'cover' | 'fill';
      }
    }
    borderRadius = vStyle.borderRadius || '0px';
    if (!borderRadius || borderRadius === '0px') {
      const pStyle = videoEl.parentElement ? window.getComputedStyle(videoEl.parentElement) : null;
      borderRadius = pStyle?.borderRadius || '0px';
    }
  } catch {
    // Fallback in test environment
  }

  const isMirrored = isVideoMirrored(videoEl, explicitMirror);

  return {
    left,
    top,
    width,
    height,
    objectFit: computedFit,
    isMirrored,
    borderRadius,
  };
}

/**
 * Calculates letterbox / pillarbox content rect for video scaling (contain vs cover vs fill).
 * Accounts for inner video dimensions and aspect ratio differences.
 */
export function computeLetterboxOffsets(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  objectFit: 'cover' | 'contain' | 'fill'
): VideoContentRect {
  if (videoWidth <= 0 || videoHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    return {
      contentLeft: 0,
      contentTop: 0,
      contentWidth: displayWidth,
      contentHeight: displayHeight,
      scaleX: 1,
      scaleY: 1,
    };
  }

  if (objectFit === 'fill') {
    return {
      contentLeft: 0,
      contentTop: 0,
      contentWidth: displayWidth,
      contentHeight: displayHeight,
      scaleX: displayWidth / videoWidth,
      scaleY: displayHeight / videoHeight,
    };
  }

  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;

  if (objectFit === 'contain') {
    if (displayAspect > videoAspect) {
      // Pillarboxed (black bars left and right)
      const contentHeight = displayHeight;
      const contentWidth = displayHeight * videoAspect;
      const contentLeft = (displayWidth - contentWidth) / 2;
      return {
        contentLeft,
        contentTop: 0,
        contentWidth,
        contentHeight,
        scaleX: contentWidth / videoWidth,
        scaleY: contentHeight / videoHeight,
      };
    } else {
      // Letterboxed (black bars top and bottom)
      const contentWidth = displayWidth;
      const contentHeight = displayWidth / videoAspect;
      const contentTop = (displayHeight - contentHeight) / 2;
      return {
        contentLeft: 0,
        contentTop,
        contentWidth,
        contentHeight,
        scaleX: contentWidth / videoWidth,
        scaleY: contentHeight / videoHeight,
      };
    }
  } else {
    // 'cover'
    if (displayAspect > videoAspect) {
      // Cropped top and bottom (video is taller than display)
      const contentWidth = displayWidth;
      const contentHeight = displayWidth / videoAspect;
      const contentTop = (displayHeight - contentHeight) / 2;
      return {
        contentLeft: 0,
        contentTop,
        contentWidth,
        contentHeight,
        scaleX: contentWidth / videoWidth,
        scaleY: contentHeight / videoHeight,
      };
    } else {
      // Cropped left and right (video is wider than display)
      const contentHeight = displayHeight;
      const contentWidth = displayHeight * videoAspect;
      const contentLeft = (displayWidth - contentWidth) / 2;
      return {
        contentLeft,
        contentTop: 0,
        contentWidth,
        contentHeight,
        scaleX: contentWidth / videoWidth,
        scaleY: contentHeight / videoHeight,
      };
    }
  }
}

/**
 * Maps a single normalized MediaPipe landmark (0.0 to 1.0) into exact 1:1 display pixel coordinates.
 * Seamlessly incorporates:
 * - Aspect ratio scaling
 * - Letterboxing / pillarboxing / cropping offsets
 * - Horizontal mirroring (1 - x)
 * - Visibility gating & partial-body framing guard
 */
export function mapLandmarkToCanvas(
  landmark: SkeletonLandmark,
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  objectFit: 'cover' | 'contain' | 'fill' = 'cover',
  isMirrored: boolean = false,
  minVisibility: number = VISIBILITY_THRESHOLD
): TransformedLandmark {
  const isConfidenceValid = (landmark.visibility ?? 1) >= minVisibility;
  // Guard against off-screen partial-body framing (e.g. user sitting close up with hips/knees out of frame)
  const isWithinFrame =
    landmark.x >= -0.05 &&
    landmark.x <= 1.05 &&
    landmark.y >= -0.05 &&
    landmark.y <= 1.05;
  const isVisible = isConfidenceValid && isWithinFrame;

  if (videoWidth <= 0 || videoHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    const rawX = isMirrored ? 1.0 - landmark.x : landmark.x;
    return {
      x: rawX * displayWidth,
      y: landmark.y * displayHeight,
      visible: isVisible,
    };
  }

  const rect = computeLetterboxOffsets(
    videoWidth,
    videoHeight,
    displayWidth,
    displayHeight,
    objectFit
  );

  const normX = isMirrored ? 1.0 - landmark.x : landmark.x;
  const x = rect.contentLeft + normX * rect.contentWidth;
  const y = rect.contentTop + landmark.y * rect.contentHeight;

  return {
    x,
    y,
    visible: isVisible,
  };
}

/**
 * Draws the complete skeletal overlay onto a 2D canvas context.
 * Performs coordinate transformation, clipping, bone lines, spinal midline, and joint markers.
 */
export function drawSkeletonOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: SkeletonLandmark[],
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  objectFit: 'cover' | 'contain' | 'fill' = 'cover',
  isMirrored: boolean = false,
  valgusDevL: number | null = null,
  valgusDevR: number | null = null,
  valgusThresholdPct: number = 8.0,
  colors: SkeletonColors = {},
  kneeAngles?: { L?: number | null; R?: number | null }
): void {
  if (!ctx || !landmarks || landmarks.length < 25) return;
  if (displayWidth <= 0 || displayHeight <= 0) return;

  const colorStable = colors.stable || '#10b981';
  const colorCritical = colors.critical || '#ef4444';
  const colorAccent = colors.accent || '#dafe52';

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Boundary clip to prevent lines from spilling onto adjacent tiles
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, displayWidth, displayHeight);
  ctx.clip();

  // Transform all landmarks
  const transformed = landmarks.map((lm) =>
    mapLandmarkToCanvas(
      lm,
      videoWidth,
      videoHeight,
      displayWidth,
      displayHeight,
      objectFit,
      isMirrored
    )
  );

  // 1. Draw Skeletal Connections (Clavicle, Torso, Arms, Legs)
  // Clamping & Stray Line Prevention:
  // Do NOT draw bones [25, 27] or [26, 28] (tibias) if either the ankle or knee has visibility < 0.60 or landmark.y > 0.95 (off bottom edge).
  const isHipLValid = isLandmarkReliable(landmarks[23]);
  const isHipRValid = isLandmarkReliable(landmarks[24]);
  const isKneeLValid = isLandmarkReliable(landmarks[25]);
  const isKneeRValid = isLandmarkReliable(landmarks[26]);
  const isLeftAnkleValid = isLandmarkReliable(landmarks[27]);
  const isRightAnkleValid = isLandmarkReliable(landmarks[28]);

  const isLeftTibiaValid = isKneeLValid && isLeftAnkleValid;
  const isRightTibiaValid = isKneeRValid && isRightAnkleValid;

  ctx.lineWidth = 4;
  ctx.strokeStyle = colorAccent;

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    if (startIdx === 25 && endIdx === 27 && !isLeftTibiaValid) continue;
    if (startIdx === 26 && endIdx === 28 && !isRightTibiaValid) continue;

    const p1 = transformed[startIdx];
    const p2 = transformed[endIdx];
    if (p1 && p2 && p1.visible && p2.visible) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // 2. Prominent Chest / Spinal Alignment Midline (Mid-Shoulder to Mid-Hip)
  const p11 = transformed[11];
  const p12 = transformed[12];
  const p23 = transformed[23];
  const p24 = transformed[24];
  if (p11 && p12 && p23 && p24 && p11.visible && p12.visible && p23.visible && p24.visible) {
    ctx.beginPath();
    ctx.moveTo((p11.x + p12.x) / 2, (p11.y + p12.y) / 2);
    ctx.lineTo((p23.x + p24.x) / 2, (p23.y + p24.y) / 2);
    ctx.stroke();
  }

  // 3. Joint Highlights & Valgus Visual Feedback
  for (const jIdx of SKELETON_JOINTS) {
    if (jIdx === 25 && !isKneeLValid) continue;
    if (jIdx === 26 && !isKneeRValid) continue;
    if (jIdx === 27 && !isLeftAnkleValid) continue;
    if (jIdx === 28 && !isRightAnkleValid) continue;

    const pt = transformed[jIdx];
    if (!pt || !pt.visible) continue;

    let jointColor = colorStable;
    if (jIdx === 25 && valgusDevL !== null && valgusDevL > valgusThresholdPct) {
      jointColor = colorCritical;
    } else if (jIdx === 26 && valgusDevR !== null && valgusDevR > valgusThresholdPct) {
      jointColor = colorCritical;
    }

    ctx.fillStyle = jointColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, [25, 26].includes(jIdx) ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = colorAccent;
    ctx.stroke();
  }

  // 4. Mechanical Axis Plumb Lines & Dynamic Knee Angle Arcs
  // In drawMechanicalAxisPlumbLine, only draw the plumb line if both hip, knee, AND ankle are valid and well within frame (y <= 0.95 and visibility >= 0.60).
  // Left Leg: Hip 23, Knee 25, Ankle 27
  const hipL = transformed[23];
  const kneeL = transformed[25];
  const ankleL = transformed[27];
  if (
    hipL && kneeL && ankleL &&
    hipL.visible && kneeL.visible && ankleL.visible &&
    isHipLValid && isKneeLValid && isLeftAnkleValid
  ) {
    drawMechanicalAxisPlumbLine(ctx, hipL, kneeL, ankleL, valgusDevL, colorCritical, 'rgba(255, 255, 255, 0.45)');
    if (kneeAngles?.L !== undefined && kneeAngles.L !== null) {
      drawKneeAngleArc(ctx, hipL, kneeL, ankleL, kneeAngles.L, colorAccent);
    }
  }

  // Right Leg: Hip 24, Knee 26, Ankle 28
  const hipR = transformed[24];
  const kneeR = transformed[26];
  const ankleR = transformed[28];
  if (
    hipR && kneeR && ankleR &&
    hipR.visible && kneeR.visible && ankleR.visible &&
    isHipRValid && isKneeRValid && isRightAnkleValid
  ) {
    drawMechanicalAxisPlumbLine(ctx, hipR, kneeR, ankleR, valgusDevR, colorCritical, 'rgba(255, 255, 255, 0.45)');
    if (kneeAngles?.R !== undefined && kneeAngles.R !== null) {
      drawKneeAngleArc(ctx, hipR, kneeR, ankleR, kneeAngles.R, colorAccent);
    }
  }

  ctx.restore();
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface RetinaDimensions {
  bufferWidth: number;
  bufferHeight: number;
  styleWidth: string;
  styleHeight: string;
  dpr: number;
}

/**
 * Computes exact high-DPI Retina buffer dimensions for a target CSS display bounding box.
 * Guarantees crisp 1:1 pixel rendering on 2x/3x Retina & 4K displays.
 */
export function computeRetinaDimensions(
  displayWidth: number,
  displayHeight: number,
  maxDpr: number = 2
): RetinaDimensions {
  const dpr = typeof window !== 'undefined'
    ? Math.min(window.devicePixelRatio || 1, maxDpr)
    : 1;
  const bufferWidth = Math.round(displayWidth * dpr);
  const bufferHeight = Math.round(displayHeight * dpr);
  return {
    bufferWidth,
    bufferHeight,
    styleWidth: `${displayWidth}px`,
    styleHeight: `${displayHeight}px`,
    dpr,
  };
}

/**
 * Draws a curved sector/wedge between femur (knee -> hip) and tibia (knee -> ankle)
 * vectors showing the knee flexion angle visually with an arc and clear degree label.
 */
export function drawKneeAngleArc(
  ctx: CanvasRenderingContext2D,
  hipPt: ScreenPoint,
  kneePt: ScreenPoint,
  anklePt: ScreenPoint,
  angleDeg: number,
  color: string = '#00f5ff'
): void {
  // Femur vector (knee -> hip)
  const v1x = hipPt.x - kneePt.x;
  const v1y = hipPt.y - kneePt.y;
  // Tibia vector (knee -> ankle)
  const v2x = anklePt.x - kneePt.x;
  const v2y = anklePt.y - kneePt.y;

  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 < 5 || len2 < 5) return;

  const theta1 = Math.atan2(v1y, v1x);
  const theta2 = Math.atan2(v2y, v2x);

  // Interior angle difference
  let diff = theta2 - theta1;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  const counterclockwise = diff < 0;

  const radius = Math.min(36, Math.max(22, Math.min(len1, len2) * 0.28));

  ctx.save();

  // 1. Semi-transparent wedge sector fill
  ctx.beginPath();
  ctx.moveTo(kneePt.x, kneePt.y);
  ctx.arc(kneePt.x, kneePt.y, radius, theta1, theta2, counterclockwise);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.22;
  ctx.fill();

  // 2. Arc stroke
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(kneePt.x, kneePt.y, radius, theta1, theta2, counterclockwise);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 3. Degree label along bisector
  const midAngle = theta1 + diff / 2;
  const labelDist = radius + 14;
  const labelX = kneePt.x + labelDist * Math.cos(midAngle);
  const labelY = kneePt.y + labelDist * Math.sin(midAngle);

  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Label backing pill
  const text = `${Math.round(angleDeg)}°`;
  const textWidth = ctx.measureText ? (ctx.measureText(text).width || 24) : 24;
  ctx.fillStyle = 'rgba(19, 20, 23, 0.85)';
  ctx.fillRect(labelX - textWidth / 2 - 4, labelY - 7, textWidth + 8, 14);

  ctx.fillStyle = color;
  ctx.fillText(text, labelX, labelY);

  ctx.restore();
}

/**
 * Draws a dashed mechanical reference line from hip to ankle (mechanical axis),
 * and if medial valgus deviation is detected, draws a visible displacement vector
 * from the mechanical line to the knee joint with warning coloration.
 */
export function drawMechanicalAxisPlumbLine(
  ctx: CanvasRenderingContext2D,
  hipPt: ScreenPoint,
  kneePt: ScreenPoint,
  anklePt: ScreenPoint,
  valgusDevPct: number | null,
  warningColor: string = '#ff4336',
  stableColor: string = 'rgba(255, 255, 255, 0.45)'
): void {
  // Vector from Hip to Ankle (Mechanical Axis)
  const ux = anklePt.x - hipPt.x;
  const uy = anklePt.y - hipPt.y;
  const lenSq = ux * ux + uy * uy;
  if (lenSq < 25) return;

  ctx.save();

  // 1. Dashed mechanical reference line from hip to ankle
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.moveTo(hipPt.x, hipPt.y);
  ctx.lineTo(anklePt.x, anklePt.y);
  ctx.strokeStyle = stableColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // 2. Orthogonal projection of knee onto mechanical axis
  const t = ((kneePt.x - hipPt.x) * ux + (kneePt.y - hipPt.y) * uy) / lenSq;
  const projX = hipPt.x + t * ux;
  const projY = hipPt.y + t * uy;

  // 3. Medial displacement vector if valgus deviation is active
  const isValgusAlert = valgusDevPct !== null && valgusDevPct > 8.0;
  const isValgusActive = valgusDevPct !== null && valgusDevPct > 0;

  if (isValgusActive) {
    const devColor = isValgusAlert ? warningColor : '#ffb703';

    // Perpendicular vector from mechanical axis line to knee
    ctx.beginPath();
    ctx.moveTo(projX, projY);
    ctx.lineTo(kneePt.x, kneePt.y);
    ctx.strokeStyle = devColor;
    ctx.lineWidth = isValgusAlert ? 2.5 : 1.5;
    ctx.stroke();

    // Small anchor node at the reference line projection
    ctx.beginPath();
    ctx.arc(projX, projY, 3, 0, Math.PI * 2);
    ctx.fillStyle = devColor;
    ctx.fill();

    // If critical alert (> 8%), render deviation pill badge
    if (isValgusAlert) {
      const badgeX = (projX + kneePt.x) / 2;
      const badgeY = (projY + kneePt.y) / 2;
      const badgeText = `+${Math.round(valgusDevPct * 10) / 10}% DEV`;

      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText ? (ctx.measureText(badgeText).width || 40) : 40;

      ctx.fillStyle = 'rgba(255, 67, 54, 0.9)';
      ctx.fillRect(badgeX - textWidth / 2 - 4, badgeY - 7, textWidth + 8, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(badgeText, badgeX, badgeY);
    }
  }

  ctx.restore();
}

export interface LandmarkSmootherOptions {
  minCutoff?: number;
  beta?: number;
  dCutoff?: number;
}

/**
 * High-performance 2D landmark coordinate smoother.
 * Applies adaptive 1€ filtering to each of the 33 normalized landmarks (x, y)
 * to completely eliminate high-frequency jitter ("moving a lot here and there automatically")
 * while dynamically scaling cutoff frequency during rapid movement for zero phase lag.
 */
export class LandmarkSmoother2D {
  private filtersX: Map<number, OneEuroFilter> = new Map();
  private filtersY: Map<number, OneEuroFilter> = new Map();
  public minCutoff: number;
  public beta: number;
  public dCutoff: number;

  constructor(options?: LandmarkSmootherOptions | number, beta: number = 8.0, dCutoff: number = 1.0) {
    if (typeof options === 'object' && options !== null) {
      this.minCutoff = options.minCutoff ?? 1.2;
      this.beta = options.beta ?? 8.0;
      this.dCutoff = options.dCutoff ?? 1.0;
    } else {
      this.minCutoff = typeof options === 'number' ? options : 1.2;
      this.beta = beta;
      this.dCutoff = dCutoff;
    }
  }

  /**
   * Filters 2D landmark coordinates across consecutive video frames.
   */
  public smooth(landmarks: SkeletonLandmark[], timestamp?: number): SkeletonLandmark[] {
    if (!landmarks || landmarks.length === 0) return [];

    return landmarks.map((lm, idx) => {
      // If landmark is occluded or confidence is low, reset filter for this landmark
      if (lm.visibility !== undefined && lm.visibility < 0.20) {
        this.filtersX.delete(idx);
        this.filtersY.delete(idx);
        return { ...lm };
      }

      let fx = this.filtersX.get(idx);
      if (!fx) {
        fx = new OneEuroFilter(this.minCutoff, this.beta, this.dCutoff);
        this.filtersX.set(idx, fx);
      }

      let fy = this.filtersY.get(idx);
      if (!fy) {
        fy = new OneEuroFilter(this.minCutoff, this.beta, this.dCutoff);
        this.filtersY.set(idx, fy);
      }

      const smoothedX = fx.filter(lm.x, timestamp) ?? lm.x;
      const smoothedY = fy.filter(lm.y, timestamp) ?? lm.y;

      return {
        ...lm,
        x: smoothedX,
        y: smoothedY,
      };
    });
  }

  public reset(): void {
    this.filtersX.clear();
    this.filtersY.clear();
  }
}

/**
 * Biomechanical framing guard: checks whether hips and knees are sufficiently
 * visible and within frame bounds for reliable squat posture analysis.
 */
export function isLowerBodyVisible(
  landmarks?: SkeletonLandmark[] | null,
  minVisibility: number = VISIBILITY_THRESHOLD
): boolean {
  if (!landmarks || landmarks.length < 27) return false;
  const hipL = landmarks[23];
  const hipR = landmarks[24];
  const kneeL = landmarks[25];
  const kneeR = landmarks[26];

  if (!hipL || !hipR || !kneeL || !kneeR) return false;

  const visHipL = hipL.visibility ?? 1;
  const visHipR = hipR.visibility ?? 1;
  const visKneeL = kneeL.visibility ?? 1;
  const visKneeR = kneeR.visibility ?? 1;

  if (
    visHipL < minVisibility ||
    visHipR < minVisibility ||
    visKneeL < minVisibility ||
    visKneeR < minVisibility
  ) {
    return false;
  }

  // Check normalized vertical bounds (user sitting close-up has knees/hips below bottom edge)
  const inBounds =
    hipL.y >= 0 && hipL.y <= 1.05 &&
    hipR.y >= 0 && hipR.y <= 1.05 &&
    kneeL.y >= 0 && kneeL.y <= 1.05 &&
    kneeR.y >= 0 && kneeR.y <= 1.05;

  return inBounds;
}
