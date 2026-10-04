/**
 * client/src/engine/buildSummary.ts
 *
 * Deterministic Biomechanical Summary Engine for KinesioLive.
 * Ingests raw CometChat.BaseMessage[] history from MessagesRequestBuilder.fetchPrevious(),
 * filters and validates persisted custom messages at the boundary, and compiles comprehensive
 * session analytics with zero ?. at calculation sites.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R3 (lines 410–470)
 * - docs/trd.md § Section-2
 * - Antigravity Master Engineering Protocol § Critic Rubric C1
 */
import { CometChat } from '@cometchat/chat-sdk-javascript';
// ----------------------------------------------------------------------------
// Boundary Ingestion Guard (All validation happens here; zero ?. downstream)
// ----------------------------------------------------------------------------
function extractRecord(msg, index) {
    if (!msg || !(msg instanceof CometChat.CustomMessage)) {
        return null;
    }
    let rawCustomData = null;
    if (typeof msg.getCustomData === 'function') {
        rawCustomData = msg.getCustomData();
    }
    if (!rawCustomData || typeof rawCustomData !== 'object' || Array.isArray(rawCustomData)) {
        return null;
    }
    const data = rawCustomData;
    if (typeof data.type !== 'string') {
        return null;
    }
    let id = `msg-${index}`;
    if (typeof msg.getId === 'function') {
        const rawId = msg.getId();
        if (rawId !== null && rawId !== undefined) {
            id = String(rawId);
        }
    }
    let t = 0;
    if (typeof data.t === 'number' && Number.isFinite(data.t)) {
        t = data.t;
    }
    else if (typeof msg.getSentAt === 'function') {
        const sentAt = msg.getSentAt();
        if (typeof sentAt === 'number' && Number.isFinite(sentAt)) {
            t = sentAt;
        }
    }
    switch (data.type) {
        case 'kine.rep': {
            if (typeof data.n !== 'number' ||
                !Number.isFinite(data.n) ||
                typeof data.minKneeDeg !== 'number' ||
                !Number.isFinite(data.minKneeDeg) ||
                (data.depth !== 'shallow' && data.depth !== 'good' && data.depth !== 'deep') ||
                typeof data.durMs !== 'number' ||
                !Number.isFinite(data.durMs) ||
                (data.tempo !== 'fast' && data.tempo !== 'controlled' && data.tempo !== 'slow')) {
                return null;
            }
            return {
                kind: 'rep',
                data: {
                    id,
                    t,
                    n: data.n,
                    minKneeDeg: data.minKneeDeg,
                    depth: data.depth,
                    durMs: data.durMs,
                    tempo: data.tempo,
                },
            };
        }
        case 'kine.alert': {
            if ((data.side !== 'L' && data.side !== 'R') ||
                typeof data.value !== 'number' ||
                !Number.isFinite(data.value)) {
                return null;
            }
            let thresholdPct = 8.0;
            if (typeof data.thresholdPct === 'number' && Number.isFinite(data.thresholdPct)) {
                thresholdPct = data.thresholdPct;
            }
            let repN = 0;
            if (typeof data.repN === 'number' && Number.isFinite(data.repN)) {
                repN = data.repN;
            }
            return {
                kind: 'alert',
                data: {
                    id,
                    t,
                    side: data.side,
                    value: data.value,
                    thresholdPct,
                    repN,
                },
            };
        }
        case 'kine.cue': {
            if ((data.cue !== 'knees_out' &&
                data.cue !== 'slower' &&
                data.cue !== 'chest_up' &&
                data.cue !== 'good_depth') ||
                typeof data.text !== 'string') {
                return null;
            }
            return {
                kind: 'cue',
                data: {
                    id,
                    t,
                    cue: data.cue,
                    text: data.text,
                },
            };
        }
        case 'kine.session': {
            if (data.action !== 'start' && data.action !== 'end' && data.action !== 'summary') {
                return null;
            }
            let clinicianUid = '';
            if (typeof data.clinicianUid === 'string') {
                clinicianUid = data.clinicianUid;
            }
            let patientUid = '';
            if (typeof data.patientUid === 'string') {
                patientUid = data.patientUid;
            }
            return {
                kind: 'session',
                data: {
                    id,
                    t,
                    action: data.action,
                    clinicianUid,
                    patientUid,
                },
            };
        }
        default:
            return null;
    }
}
// ----------------------------------------------------------------------------
// Pure Summary Builder (Zero ?. at calculation sites)
// ----------------------------------------------------------------------------
export function buildSummary(sessionId, messages) {
    if (!Array.isArray(messages)) {
        return {
            sessionId,
            durationMs: 0,
            totalReps: 0,
            validReps: 0,
            depthDistribution: { shallow: 0, good: 0, deep: 0 },
            tempoDistribution: { fast: 0, controlled: 0, slow: 0 },
            averageMinKneeDeg: 0,
            peakDepthDeg: 0,
            alertCount: 0,
            alertBreakdown: { L: 0, R: 0 },
            maxValgusDevPct: 0,
            cuesCount: 0,
            cuesDelivered: [],
            timeline: [],
        };
    }
    const reps = [];
    const alerts = [];
    const cues = [];
    const timeline = [];
    let startMarkerT = null;
    let endMarkerT = null;
    // Stage 1: Extraction & Categorization
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg) {
            continue;
        }
        const item = extractRecord(msg, i);
        if (!item) {
            continue;
        }
        switch (item.kind) {
            case 'rep': {
                const r = item.data;
                reps.push(r);
                timeline.push({
                    id: r.id,
                    timestamp: r.t,
                    type: 'rep',
                    title: `Rep #${r.n} (${r.depth})`,
                    detail: `${r.depth.toUpperCase()} depth (${r.minKneeDeg}°) • ${r.durMs}ms • ${r.tempo}`,
                    severity: 'normal',
                });
                break;
            }
            case 'alert': {
                const a = item.data;
                alerts.push(a);
                timeline.push({
                    id: a.id,
                    timestamp: a.t,
                    type: 'alert',
                    title: `Knee Valgus Alert (${a.side})`,
                    detail: `${a.side === 'L' ? 'Left' : 'Right'} knee deviation +${a.value}% (threshold ${a.thresholdPct}%)`,
                    severity: 'critical',
                });
                break;
            }
            case 'cue': {
                const c = item.data;
                cues.push(c);
                timeline.push({
                    id: c.id,
                    timestamp: c.t,
                    type: 'cue',
                    title: `Coaching Cue: ${c.cue.replace('_', ' ')}`,
                    detail: c.text,
                    severity: 'normal',
                });
                break;
            }
            case 'session': {
                const s = item.data;
                if (s.action === 'start') {
                    if (startMarkerT === null || s.t < startMarkerT) {
                        startMarkerT = s.t;
                    }
                }
                else if (s.action === 'end') {
                    if (endMarkerT === null || s.t > endMarkerT) {
                        endMarkerT = s.t;
                    }
                }
                let detail = `Session marker: ${s.action}`;
                if (s.clinicianUid.length > 0 && s.patientUid.length > 0) {
                    detail = `Clinician: ${s.clinicianUid} • Patient: ${s.patientUid}`;
                }
                timeline.push({
                    id: s.id,
                    timestamp: s.t,
                    type: 'session',
                    title: `Session ${s.action.charAt(0).toUpperCase() + s.action.slice(1)}`,
                    detail,
                    severity: 'normal',
                });
                break;
            }
        }
    }
    // Stage 2: Pure Calculations
    const totalReps = reps.length;
    let validReps = 0;
    const depthDistribution = { shallow: 0, good: 0, deep: 0 };
    const tempoDistribution = { fast: 0, controlled: 0, slow: 0 };
    let repSum = 0;
    let peakDepthDeg = 0;
    if (totalReps > 0) {
        let minKneeFound = reps[0].minKneeDeg;
        for (let i = 0; i < reps.length; i++) {
            const r = reps[i];
            if (r.depth !== 'shallow') {
                validReps++;
            }
            depthDistribution[r.depth]++;
            tempoDistribution[r.tempo]++;
            repSum += r.minKneeDeg;
            if (r.minKneeDeg < minKneeFound) {
                minKneeFound = r.minKneeDeg;
            }
        }
        peakDepthDeg = minKneeFound;
    }
    let averageMinKneeDeg = 0;
    if (totalReps > 0) {
        averageMinKneeDeg = Math.round((repSum / totalReps) * 10) / 10;
    }
    const alertCount = alerts.length;
    const alertBreakdown = { L: 0, R: 0 };
    let maxValgusDevPct = 0;
    if (alertCount > 0) {
        let maxValgusFound = alerts[0].value;
        for (let i = 0; i < alerts.length; i++) {
            const a = alerts[i];
            alertBreakdown[a.side]++;
            if (a.value > maxValgusFound) {
                maxValgusFound = a.value;
            }
        }
        maxValgusDevPct = maxValgusFound;
    }
    const cuesCount = cues.length;
    const cuesDelivered = [];
    for (let i = 0; i < cues.length; i++) {
        const c = cues[i];
        cuesDelivered.push({
            cue: c.cue,
            text: c.text,
            timestamp: c.t,
        });
    }
    cuesDelivered.sort((a, b) => a.timestamp - b.timestamp);
    timeline.sort((a, b) => a.timestamp - b.timestamp);
    let durationMs = 0;
    if (startMarkerT !== null && endMarkerT !== null && endMarkerT >= startMarkerT) {
        durationMs = endMarkerT - startMarkerT;
    }
    return {
        sessionId,
        durationMs,
        totalReps,
        validReps,
        depthDistribution,
        tempoDistribution,
        averageMinKneeDeg,
        peakDepthDeg,
        alertCount,
        alertBreakdown,
        maxValgusDevPct,
        cuesCount,
        cuesDelivered,
        timeline,
    };
}
