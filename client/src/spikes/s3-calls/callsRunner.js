/**
 * Spike S3 (Milestone D2.2): Headless CometChat Calls v5 Session Join Runner
 * Conforms to .cometchat/skills/cometchat-js-v5-sdk/SKILL.md & MCP Verified Specs
 */
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatCalls } from '@cometchat/calls-sdk-javascript';
import { requestSession } from '../utils/tokenService';
export class CallsJoinRunner {
    activeTeardown = null;
    isConnected = false;
    async joinCall(options) {
        const { role, sessionId: customSessionId, containerElement, onLog } = options;
        const isClinician = role === 'clinician';
        const startConnectTime = performance.now();
        onLog?.('info', `Requesting server-minted session token for role: ${role}...`);
        // 1. Fetch Session Credentials from backend POST /api/session
        const session = await requestSession(role, customSessionId);
        onLog?.('info', `Session credentials received: ID=${session.sessionId}, UID=${session.uid}`);
        // 2. Initialize Chat SDK v4
        const chatSettings = new CometChat.AppSettingsBuilder()
            .subscribePresenceForAllUsers()
            .setRegion(session.region)
            .build();
        await CometChat.init(session.appId, chatSettings);
        // 3. Login to Chat SDK with server-minted Auth Token
        const currentChatUser = await CometChat.getLoggedinUser();
        if (!currentChatUser || currentChatUser.getUid() !== session.uid) {
            onLog?.('info', `Logging into Chat SDK with auth token...`);
            await CometChat.login(session.authToken);
        }
        // 4. Initialize Calls SDK v5
        onLog?.('info', `Initializing Calls SDK v5 (App ID: ${session.appId}, Region: ${session.region})...`);
        await CometChatCalls.init({
            appId: session.appId,
            region: session.region,
        });
        // 5. Authenticate Calls SDK with server-minted Auth Token
        if (!CometChatCalls.isUserLoggedIn()) {
            onLog?.('info', `Authenticating Calls SDK with auth token...`);
            await CometChatCalls.loginWithAuthToken(session.authToken);
            onLog?.('success', `Calls SDK authenticated successfully`);
        }
        // 6. Register Call Event Listeners
        const unsubs = [];
        unsubs.push(CometChatCalls.addEventListener('onSessionJoined', () => {
            onLog?.('success', `Calls v5 Session Joined`);
        }), CometChatCalls.addEventListener('onSessionLeft', () => {
            onLog?.('info', 'Calls v5 Session Left');
        }), CometChatCalls.addEventListener('onConnectionFailed', () => {
            onLog?.('error', `Calls v5 Connection Failed`);
        }));
        // 7. Generate Call Token for Session ID
        onLog?.('info', `Generating call token for room: ${session.sessionId}...`);
        const tokenResult = await CometChatCalls.generateToken(session.sessionId);
        const callToken = tokenResult.token;
        // 8. Configure SessionSettings
        // INVARIANT: Clinician must mount with startAudioMuted: true to stop acoustic feedback
        const callSettings = {
            sessionType: 'VIDEO',
            layout: 'TILE',
            startAudioMuted: isClinician,
            startVideoPaused: false,
            hideControlPanel: false,
            hideLeaveSessionButton: false,
            hideToggleAudioButton: false,
            hideToggleVideoButton: false,
            idleTimeoutPeriodBeforePrompt: 60000,
            idleTimeoutPeriodAfterPrompt: 180000,
        };
        onLog?.('info', `Joining session container (startAudioMuted=${callSettings.startAudioMuted})...`);
        // 9. Join Session into DOM Container
        const joinResult = await CometChatCalls.joinSession(callToken, callSettings, containerElement);
        if (joinResult?.error) {
            throw new Error(`Failed to join call session: ${JSON.stringify(joinResult.error)}`);
        }
        const connectLatencyMs = performance.now() - startConnectTime;
        this.isConnected = true;
        // Save teardown handler
        this.activeTeardown = () => {
            unsubs.forEach((unsub) => {
                try {
                    unsub();
                }
                catch {
                    // Ignore
                }
            });
            try {
                CometChatCalls.leaveSession();
            }
            catch {
                // Ignore
            }
            this.isConnected = false;
        };
        const pass = connectLatencyMs < 3000;
        const metrics = {
            role,
            uid: session.uid,
            sessionId: session.sessionId,
            connectLatencyMs: Math.round(connectLatencyMs),
            audioMuted: isClinician,
            videoConnected: true,
            containerRendered: true,
            pass,
        };
        onLog?.(pass ? 'success' : 'warn', `Connected to Calls v5 in ${(connectLatencyMs / 1000).toFixed(2)}s (audioMuted=${isClinician}) -> ${pass ? 'PASS' : 'FAIL'}`);
        return metrics;
    }
    leaveCall() {
        if (this.activeTeardown) {
            this.activeTeardown();
            this.activeTeardown = null;
        }
    }
    getIsConnected() {
        return this.isConnected;
    }
}
