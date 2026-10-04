/**
 * client/src/engine/geometry.ts
 *
 * Decoupled, zero-DOM Mathematical Geometry Engine for KinesioLive.
 * Computes 3D sagittal knee flexion angle, standing baseline calibration,
 * frontal knee valgus deviation percentage, and normalized pelvic depth ratio.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R1
 * - docs/trd.md § Section-3
 * - docs/testing.md § Section-2
 * - PROJECT.md § Architecture & Interface Contracts
 */
/**
 * BlazePose 33-landmark bilateral keypoint indices.
 */
export const BLAZEPOSE_KEYPOINTS = {
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
};
export function compute3DKneeFlexion(hip, knee, ankle) {
    if (!hip || !knee || !ankle)
        return null;
    if (typeof hip !== 'object' || typeof knee !== 'object' || typeof ankle !== 'object')
        return null;
    // Visibility threshold guard (< 0.65)
    if (hip.visibility !== undefined && (typeof hip.visibility !== 'number' || !Number.isFinite(hip.visibility) || hip.visibility < 0.65))
        return null;
    if (knee.visibility !== undefined && (typeof knee.visibility !== 'number' || !Number.isFinite(knee.visibility) || knee.visibility < 0.65))
        return null;
    if (ankle.visibility !== undefined && (typeof ankle.visibility !== 'number' || !Number.isFinite(ankle.visibility) || ankle.visibility < 0.65))
        return null;
    // Finite coordinate validation
    if (typeof hip.x !== 'number' || !Number.isFinite(hip.x) ||
        typeof hip.y !== 'number' || !Number.isFinite(hip.y) ||
        typeof hip.z !== 'number' || !Number.isFinite(hip.z) ||
        typeof knee.x !== 'number' || !Number.isFinite(knee.x) ||
        typeof knee.y !== 'number' || !Number.isFinite(knee.y) ||
        typeof knee.z !== 'number' || !Number.isFinite(knee.z) ||
        typeof ankle.x !== 'number' || !Number.isFinite(ankle.x) ||
        typeof ankle.y !== 'number' || !Number.isFinite(ankle.y) ||
        typeof ankle.z !== 'number' || !Number.isFinite(ankle.z)) {
        return null;
    }
    // Vectors from knee vertex
    const v1x = hip.x - knee.x;
    const v1y = hip.y - knee.y;
    const v1z = hip.z - knee.z;
    const v2x = ankle.x - knee.x;
    const v2y = ankle.y - knee.y;
    const v2z = ankle.z - knee.z;
    // Degenerate vector length check (magnitude <= 1e-6)
    const mag1Sq = v1x * v1x + v1y * v1y + v1z * v1z;
    const mag2Sq = v2x * v2x + v2y * v2y + v2z * v2z;
    if (!Number.isFinite(mag1Sq) || !Number.isFinite(mag2Sq))
        return null;
    if (mag1Sq <= 1e-12 || mag2Sq <= 1e-12)
        return null; // sqrt(1e-12) = 1e-6
    const mag1 = Math.sqrt(mag1Sq);
    const mag2 = Math.sqrt(mag2Sq);
    if (mag1 <= 1e-6 || mag2 <= 1e-6)
        return null;
    const denominator = mag1 * mag2;
    if (denominator <= 1e-12 || !Number.isFinite(denominator))
        return null;
    // Dot product and clamping to avoid IEEE 754 precision overshoot beyond [-1, 1]
    const dot = v1x * v2x + v1y * v2y + v1z * v2z;
    const cosTheta = dot / denominator;
    const clampedCos = Math.max(-1.0, Math.min(1.0, cosTheta));
    if (!Number.isFinite(clampedCos))
        return null;
    const angleRad = Math.acos(clampedCos);
    const angleDeg = (angleRad * 180.0) / Math.PI;
    return Number.isFinite(angleDeg) ? angleDeg : null;
}
export function calibrateStandingBaseline(landmarks, imageWidth, imageHeight, timestamp) {
    if (!landmarks || !Array.isArray(landmarks))
        return null;
    if (!Number.isFinite(imageWidth) || imageWidth <= 0)
        return null;
    if (!Number.isFinite(imageHeight) || imageHeight <= 0)
        return null;
    // Must have at least index 28 available
    if (landmarks.length < 29)
        return null;
    // Validate the 6 bilateral keypoints
    const requiredIndices = [23, 24, 25, 26, 27, 28];
    for (const idx of requiredIndices) {
        const lm = landmarks[idx];
        if (!lm || typeof lm !== 'object')
            return null;
        if (lm.visibility !== undefined && (typeof lm.visibility !== 'number' || !Number.isFinite(lm.visibility) || lm.visibility < 0.65)) {
            return null;
        }
        if (typeof lm.x !== 'number' || !Number.isFinite(lm.x) || typeof lm.y !== 'number' || !Number.isFinite(lm.y)) {
            return null;
        }
    }
    // Convert normalized [0, 1] coordinates to unmirrored camera pixel space
    const lm23 = landmarks[23];
    const lm24 = landmarks[24];
    const lm25 = landmarks[25];
    const lm26 = landmarks[26];
    const lm27 = landmarks[27];
    const lm28 = landmarks[28];
    const hL = { x: lm23.x * imageWidth, y: lm23.y * imageHeight };
    const hR = { x: lm24.x * imageWidth, y: lm24.y * imageHeight };
    const kL = { x: lm25.x * imageWidth, y: lm25.y * imageHeight };
    const kR = { x: lm26.x * imageWidth, y: lm26.y * imageHeight };
    const aL = { x: lm27.x * imageWidth, y: lm27.y * imageHeight };
    const aR = { x: lm28.x * imageWidth, y: lm28.y * imageHeight };
    // Anatomical Orientation Invariant:
    // In camera pixel space, Y=0 is top of image and Y increases downwards towards floor.
    // Upright standing requires Y_ankle > Y_knee > Y_hip for both sides.
    if (!(aL.y > kL.y && kL.y > hL.y))
        return null;
    if (!(aR.y > kR.y && kR.y > hR.y))
        return null;
    // Bilateral standing leg lengths
    const lenL = Math.sqrt((aL.x - hL.x) ** 2 + (aL.y - hL.y) ** 2);
    const lenR = Math.sqrt((aR.x - hR.x) ** 2 + (aR.y - hR.y) ** 2);
    if (!Number.isFinite(lenL) || !Number.isFinite(lenR) || lenL <= 1e-4 || lenR <= 1e-4) {
        return null;
    }
    // Standing heights & vertical spans
    const hipMid = (hL.y + hR.y) / 2.0;
    const kneeMid = (kL.y + kR.y) / 2.0;
    const ankleMid = (aL.y + aR.y) / 2.0;
    const verticalSpan = kneeMid - hipMid;
    if (verticalSpan <= 1e-4) {
        return null;
    }
    const calTime = timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : Date.now();
    return {
        L_standing: {
            L: lenL,
            R: lenR,
        },
        standingY: {
            hip: { L: hL.y, R: hR.y, midpoint: hipMid },
            knee: { L: kL.y, R: kR.y, midpoint: kneeMid },
            ankle: { L: aL.y, R: aR.y, midpoint: ankleMid },
        },
        calibratedAt: calTime,
        imageWidth,
        imageHeight,
        standingLegLengthL: lenL,
        standingLegLengthR: lenR,
        standingHipY_L: hL.y,
        standingHipY_R: hR.y,
        standingKneeY_L: kL.y,
        standingKneeY_R: kR.y,
        standingAnkleY_L: aL.y,
        standingAnkleY_R: aR.y,
        standingHipY: hipMid,
        standingKneeY: kneeMid,
        standingAnkleY: ankleMid,
        verticalSpan,
    };
}
export function computeValgusDeviation(hip, knee, ankle, baseline, side) {
    if (!hip || !knee || !ankle || !baseline)
        return null;
    if (typeof hip !== 'object' || typeof knee !== 'object' || typeof ankle !== 'object')
        return null;
    // Visibility guards (< 0.65)
    if (hip.visibility !== undefined && (typeof hip.visibility !== 'number' || !Number.isFinite(hip.visibility) || hip.visibility < 0.65))
        return null;
    if (knee.visibility !== undefined && (typeof knee.visibility !== 'number' || !Number.isFinite(knee.visibility) || knee.visibility < 0.65))
        return null;
    if (ankle.visibility !== undefined && (typeof ankle.visibility !== 'number' || !Number.isFinite(ankle.visibility) || ankle.visibility < 0.65))
        return null;
    let Xh = hip.x;
    let Yh = hip.y;
    let Xk = knee.x;
    let Yk = knee.y;
    let Xa = ankle.x;
    let Ya = ankle.y;
    if (typeof Xh !== 'number' || !Number.isFinite(Xh) ||
        typeof Yh !== 'number' || !Number.isFinite(Yh) ||
        typeof Xk !== 'number' || !Number.isFinite(Xk) ||
        typeof Yk !== 'number' || !Number.isFinite(Yk) ||
        typeof Xa !== 'number' || !Number.isFinite(Xa) ||
        typeof Ya !== 'number' || !Number.isFinite(Ya)) {
        return null;
    }
    // Retrieve leg length for designated side
    const L_standing = side === 'L'
        ? (baseline.L_standing?.L ?? baseline.standingLegLengthL)
        : (baseline.L_standing?.R ?? baseline.standingLegLengthR);
    if (L_standing === undefined || !Number.isFinite(L_standing) || L_standing <= 1e-4) {
        return null;
    }
    // Guard against vertical division by zero on input coordinates (prone/horizontal posture or collapsed keypoints)
    if (Math.abs(ankle.y - hip.y) <= 1e-4) {
        return null;
    }
    // If points are provided in normalized [0, 1] coordinates while baseline was calibrated with pixel dimensions
    const pointsNormalized = (Math.abs(Xh) <= 1.0 && Math.abs(Yh) <= 1.0 &&
        Math.abs(Xk) <= 1.0 && Math.abs(Yk) <= 1.0 &&
        Math.abs(Xa) <= 1.0 && Math.abs(Ya) <= 1.0);
    if (pointsNormalized && baseline.imageWidth > 1 && baseline.imageHeight > 1 && L_standing > 2.0) {
        Xh *= baseline.imageWidth;
        Yh *= baseline.imageHeight;
        Xk *= baseline.imageWidth;
        Yk *= baseline.imageHeight;
        Xa *= baseline.imageWidth;
        Ya *= baseline.imageHeight;
    }
    // Guard against vertical division by zero on effective coordinates
    const deltaY = Ya - Yh;
    if (Math.abs(deltaY) <= 1e-4) {
        return null;
    }
    // Neutral frontal axis interpolation at current knee vertical height Yk
    const X_baseline = Xh + (Xa - Xh) * ((Yk - Yh) / deltaY);
    // Polarity in unmirrored camera coordinates:
    // Left leg appears on viewer's right (X ~ 0.60): medial collapse decreases X -> polarity = -1
    // Right leg appears on viewer's left (X ~ 0.40): medial collapse increases X -> polarity = +1
    const polarity = side === 'L' ? -1.0 : 1.0;
    const deviation = polarity * (Xk - X_baseline);
    const valgusDevPct = (deviation / L_standing) * 100.0;
    if (!Number.isFinite(valgusDevPct)) {
        return null;
    }
    // Avoid IEEE 754 negative zero (-0)
    return Object.is(valgusDevPct, -0) ? 0.0 : valgusDevPct;
}
export function computeDepthRatio(currentHipY, baseline) {
    if (currentHipY === null || currentHipY === undefined || !baseline)
        return 0.0;
    if (typeof currentHipY !== 'number' || !Number.isFinite(currentHipY))
        return 0.0;
    const standingHipY = baseline.standingY?.hip?.midpoint ?? baseline.standingHipY;
    const standingKneeY = baseline.standingY?.knee?.midpoint ?? baseline.standingKneeY;
    if (standingHipY === undefined || standingKneeY === undefined)
        return 0.0;
    const verticalSpan = standingKneeY - standingHipY;
    if (Math.abs(verticalSpan) <= 1e-4) {
        return 0.0;
    }
    let hipY = currentHipY;
    // If currentHipY is normalized [0, 1] but baseline was calibrated in pixel space
    if (Math.abs(hipY) <= 1.0 &&
        baseline.imageHeight !== undefined &&
        baseline.imageHeight > 1 &&
        Math.abs(standingHipY) > 2.0) {
        hipY *= baseline.imageHeight;
    }
    const depthRatio = (hipY - standingHipY) / verticalSpan;
    if (!Number.isFinite(depthRatio)) {
        return 0.0;
    }
    return Object.is(depthRatio, -0) ? 0.0 : depthRatio;
}
