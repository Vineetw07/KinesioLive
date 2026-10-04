export const chatMockState = {
  loggedInUser: null as { getUid: () => string } | null,
  sentMessages: [] as any[],
  customFetchPrevious: null as (() => Promise<any[]>) | null,
  capturedQueryConfig: null as any,
  reset() {
    this.loggedInUser = null;
    this.sentMessages = [];
    this.customFetchPrevious = null;
    this.capturedQueryConfig = null;
  },
};

export class MockAppSettingsBuilder {
  subscribePresenceForAllUsers() {
    return this;
  }
  setRegion(_region: string) {
    return this;
  }
  build() {
    return {};
  }
}

export class MockCustomMessage {
  private receiverId: string;
  private receiverType: string;
  private type: string;
  private customData: Record<string, unknown>;
  private updateConversation: boolean = true;
  private id: number;
  private sentAt: number;

  constructor(receiverId: string, receiverType: string, type: string, customData: Record<string, unknown>) {
    this.receiverId = receiverId;
    this.receiverType = receiverType;
    this.type = type;
    this.customData = customData;
    this.id = Math.floor(Math.random() * 1000000);
    this.sentAt = Date.now();
  }

  shouldUpdateConversation(val: boolean) {
    this.updateConversation = val;
  }
  getShouldUpdateConversation() {
    return this.updateConversation;
  }
  getReceiverId() {
    return this.receiverId;
  }
  getReceiverType() {
    return this.receiverType;
  }
  getType() {
    return this.type;
  }
  getSubType() {
    return this.type;
  }
  getCustomData() {
    return this.customData;
  }
  getId() {
    return this.id;
  }
  getSentAt() {
    return this.sentAt;
  }
  setSentAt(t: number) {
    this.sentAt = t;
  }
  getSender() {
    return { getUid: () => 'dr-demo' };
  }
}

export class MockMessagesRequestBuilder {
  private guid: string = '';
  private categories: string[] = [];
  private limit: number = 0;

  setGUID(guid: string) {
    this.guid = guid;
    return this;
  }
  setCategories(categories: string[]) {
    this.categories = categories;
    return this;
  }
  setLimit(limit: number) {
    this.limit = limit;
    return this;
  }
  build() {
    const config = {
      guid: this.guid,
      categories: this.categories,
      limit: this.limit,
    };
    chatMockState.capturedQueryConfig = config;

    return {
      guid: this.guid,
      categories: this.categories,
      limit: this.limit,
      fetchPrevious: async () => {
        if (chatMockState.customFetchPrevious) {
          return chatMockState.customFetchPrevious();
        }
        return [...chatMockState.sentMessages];
      },
    };
  }
}

export class MockTransientMessage {
  private receiverId: string;
  private receiverType: string;
  private data: Record<string, unknown>;

  constructor(receiverId: string, receiverType: string, data: Record<string, unknown>) {
    this.receiverId = receiverId;
    this.receiverType = receiverType;
    this.data = data;
  }

  getReceiverID() {
    return this.receiverId;
  }
  getReceiverType() {
    return this.receiverType;
  }
  getData() {
    return this.data;
  }
}

export class MockMessageListener {
  public callbacks: {
    onTransientMessageReceived?: (msg: any) => void;
    onCustomMessageReceived?: (msg: any) => void;
  };

  constructor(callbacks: {
    onTransientMessageReceived?: (msg: any) => void;
    onCustomMessageReceived?: (msg: any) => void;
  }) {
    this.callbacks = callbacks;
  }
}

export const CometChat = {
  AppSettingsBuilder: MockAppSettingsBuilder,
  CustomMessage: MockCustomMessage,
  TransientMessage: MockTransientMessage,
  MessageListener: MockMessageListener,
  MessagesRequestBuilder: MockMessagesRequestBuilder,
  RECEIVER_TYPE: {
    GROUP: 'group',
    USER: 'user',
  },
  init: async () => true,
  getLoggedinUser: async () => chatMockState.loggedInUser,
  login: async (token: string) => {
    chatMockState.loggedInUser = {
      getUid: () => (token.includes('pt-demo') ? 'pt-demo' : 'dr-demo'),
    };
    return chatMockState.loggedInUser;
  },
  logout: async () => {
    chatMockState.loggedInUser = null;
    return true;
  },
  sendCustomMessage: async (msg: MockCustomMessage) => {
    chatMockState.sentMessages.push(msg);
    // Broadcast to registered listeners
    for (const listener of Object.values(chatMockListeners)) {
      if (typeof listener.callbacks?.onCustomMessageReceived === 'function') {
        listener.callbacks.onCustomMessageReceived(msg);
      }
    }
    return msg;
  },
  sendTransientMessage: (msg: MockTransientMessage) => {
    chatMockTransientMessages.push(msg);
    // Broadcast to registered listeners
    for (const listener of Object.values(chatMockListeners)) {
      if (typeof listener.callbacks?.onTransientMessageReceived === 'function') {
        listener.callbacks.onTransientMessageReceived(msg);
      }
    }
  },
  addMessageListener: (id: string, listener: any) => {
    chatMockListeners[id] = listener;
  },
  removeMessageListener: (id: string) => {
    delete chatMockListeners[id];
  },
};

export const chatMockListeners: Record<string, any> = {};
export const chatMockTransientMessages: any[] = [];
