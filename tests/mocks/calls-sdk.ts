import { vi } from 'vitest';

export interface SessionSettings {
  sessionType?: string;
  layout?: string;
  startAudioMuted?: boolean;
  startVideoPaused?: boolean;
  hideControlPanel?: boolean;
  hideLeaveSessionButton?: boolean;
  hideToggleAudioButton?: boolean;
  hideToggleVideoButton?: boolean;
  idleTimeoutPeriodBeforePrompt?: number;
  idleTimeoutPeriodAfterPrompt?: number;
  [key: string]: unknown;
}

export const callsMockState = {
  isLoggedIn: false,
  eventListeners: {} as Record<string, Array<() => void>>,
  joinSessionSpy: vi.fn(),
  generateTokenSpy: vi.fn(),
  leaveSessionSpy: vi.fn(),
  reset() {
    this.isLoggedIn = false;
    this.eventListeners = {};
    this.joinSessionSpy = vi.fn().mockResolvedValue({ status: 'success' });
    this.generateTokenSpy = vi.fn().mockImplementation(async (sessionId: string) => ({
      token: `mock_call_token_for_${sessionId}`,
    }));
    this.leaveSessionSpy = vi.fn();
  },
};

callsMockState.reset();

export const CometChatCalls = {
  init: async () => true,
  loginWithAuthToken: async () => {
    callsMockState.isLoggedIn = true;
    return true;
  },
  isUserLoggedIn: () => callsMockState.isLoggedIn,
  addEventListener: (event: string, cb: () => void) => {
    if (!callsMockState.eventListeners[event]) {
      callsMockState.eventListeners[event] = [];
    }
    callsMockState.eventListeners[event].push(cb);
    return () => {
      const list = callsMockState.eventListeners[event];
      if (list) {
        const idx = list.indexOf(cb);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  },
  generateToken: async (sessionId: string) => callsMockState.generateTokenSpy(sessionId),
  joinSession: async (token: string, settings: SessionSettings, container: HTMLElement) =>
    callsMockState.joinSessionSpy(token, settings, container),
  leaveSession: () => {
    callsMockState.isLoggedIn = false;
    callsMockState.leaveSessionSpy();
  },
};
