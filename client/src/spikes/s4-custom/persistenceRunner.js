/**
 * Spike S4 (Milestone D2.4): Custom Message Persistence & History Retrieval Runner
 * Conforms to TRD § Section 2, Survey 2 & MCP Verified Specs
 */
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { requestSession } from '../utils/tokenService';
export class PersistenceBenchmarkRunner {
    async runPersistenceTest(options) {
        const { sessionId: customSessionId, burstCount = 25, onProgress, onLog } = options;
        onLog?.('info', `Initializing session for Spike S4 Persistence benchmark...`);
        // 1. Obtain session credentials from server
        const session = await requestSession('clinician', customSessionId);
        const targetGuid = session.sessionId;
        // 2. Initialize Chat SDK
        const appSettings = new CometChat.AppSettingsBuilder()
            .subscribePresenceForAllUsers()
            .setRegion(session.region)
            .build();
        await CometChat.init(session.appId, appSettings);
        const currentUser = await CometChat.getLoggedinUser();
        if (!currentUser || currentUser.getUid() !== session.uid) {
            onLog?.('info', `Logging into Chat SDK as ${session.uid}...`);
            await CometChat.login(session.authToken);
            onLog?.('success', `Logged in successfully`);
        }
        // 3. Send Burst of Custom Messages
        onLog?.('info', `Starting burst transmission of ${burstCount} custom messages to group ${targetGuid}...`);
        const sentMessageIds = [];
        const sentTimestamps = [];
        const cues = ['knees_out', 'slower', 'chest_up', 'good_depth'];
        for (let i = 1; i <= burstCount; i++) {
            let customType;
            let payloadData;
            if (i % 3 === 1) {
                customType = 'kine.rep';
                const repPayload = {
                    v: 1,
                    sid: targetGuid,
                    t: Date.now(),
                    type: 'kine.rep',
                    n: Math.ceil(i / 3),
                    minKneeDeg: 78,
                    depth: 'good',
                    durMs: 2450,
                    tempo: 'controlled',
                };
                payloadData = repPayload;
            }
            else if (i % 3 === 2) {
                customType = 'kine.alert';
                const alertPayload = {
                    v: 1,
                    sid: targetGuid,
                    t: Date.now(),
                    type: 'kine.alert',
                    kind: 'knee_valgus',
                    side: 'L',
                    value: 9.4,
                    thresholdPct: 8.0,
                    repN: Math.ceil(i / 3),
                    phase: 'bottom',
                    note: 'Form alert (biomechanical feedback)',
                };
                payloadData = alertPayload;
            }
            else {
                customType = 'kine.cue';
                const cue = cues[(i - 1) % cues.length] || 'knees_out';
                const cuePayload = {
                    v: 1,
                    sid: targetGuid,
                    t: Date.now(),
                    type: 'kine.cue',
                    cue,
                    text: `Clinician Cue: ${cue.replace('_', ' ').toUpperCase()}`,
                };
                payloadData = cuePayload;
            }
            const customMessage = new CometChat.CustomMessage(targetGuid, CometChat.RECEIVER_TYPE.GROUP, customType, payloadData);
            // Invariant: shouldUpdateConversation(false) prevents spamming conversation list preview
            customMessage.shouldUpdateConversation(false);
            const sentMsg = await CometChat.sendCustomMessage(customMessage);
            const msgId = sentMsg.getId();
            const sentAt = sentMsg.getSentAt();
            sentMessageIds.push(msgId);
            sentTimestamps.push(sentAt);
            onProgress?.(i, burstCount);
            // Slight yield to ensure distinct timestamps
            await new Promise((resolve) => setTimeout(resolve, 60));
        }
        onLog?.('success', `All ${burstCount} custom messages sent and persisted to CometChat`);
        // 4. History Retrieval via MessagesRequestBuilder
        onLog?.('info', `Querying MessagesRequestBuilder for category 'custom' (limit: 30)...`);
        const fetchStart = performance.now();
        // Invariant: Use verified uppercase .setGUID(targetGuid)
        const messagesRequest = new CometChat.MessagesRequestBuilder()
            .setGUID(targetGuid)
            .setCategories(['custom'])
            .setLimit(35)
            .build();
        const fetchedMessages = await messagesRequest.fetchPrevious();
        const fetchDurationMs = Math.round(performance.now() - fetchStart);
        onLog?.('info', `Fetched ${fetchedMessages.length} messages from history in ${fetchDurationMs}ms`);
        // 5. Transform & Validate
        const retrievedSummaries = [];
        const retrievedSentAts = [];
        const typesFound = new Set();
        for (const msg of fetchedMessages) {
            if (msg instanceof CometChat.CustomMessage) {
                const id = msg.getId();
                const sentAt = msg.getSentAt();
                const type = msg.getType() || msg.getSubType() || 'custom';
                const sender = msg.getSender()?.getUid() || 'unknown';
                const data = (msg.getCustomData() || {});
                typesFound.add(type);
                retrievedSentAts.push(sentAt);
                retrievedSummaries.push({ id, type, sentAt, sender, data });
            }
        }
        // Sort to verify chronological sequence
        let isChronological = true;
        for (let j = 1; j < retrievedSentAts.length; j++) {
            if (retrievedSentAts[j] < retrievedSentAts[j - 1]) {
                isChronological = false;
                break;
            }
        }
        // If fetched in reverse order (standard pagination cursor), sorting by sentAt verifies chronological monotonicity
        const sortedRetrieved = [...retrievedSummaries].sort((a, b) => a.sentAt - b.sentAt);
        // Check retrieval coverage
        const retrievedCount = retrievedSummaries.length;
        const isFullRetrieval = retrievedCount >= burstCount;
        const pass = isFullRetrieval && isChronological;
        const metrics = {
            sentCount: burstCount,
            retrievedCount,
            targetCount: burstCount,
            chronologicalMatch: isChronological,
            messageTypesRetrieved: Array.from(typesFound),
            retrievalLatencyMs: fetchDurationMs,
            pass,
        };
        onLog?.(pass ? 'success' : 'warn', `S4 Persistence Validated: ${retrievedCount}/${burstCount} retrieved (Chronological: ${isChronological ? 'YES' : 'NO'}) -> ${pass ? 'PASS' : 'FAIL'}`);
        return { metrics, messages: sortedRetrieved };
    }
}
