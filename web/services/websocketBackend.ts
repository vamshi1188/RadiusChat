import { User, SocketMessage } from '../types';

/**
 * Real WebSocket backend connection to Go server
 */
class WebSocketBackend {
  private ws: WebSocket | null = null;
  private listeners: ((msg: SocketMessage) => void)[] = [];
  private myId: string | null = null;
  private connected = false;
  private reconnectTimer: any = null;
  private wsUrl: string;

  constructor() {
    // Detect if we're in development (localhost:3000) or production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host === 'localhost:3000' || window.location.host.includes('localhost:3000')
      ? 'localhost:8080'  // Dev: connect to Go server directly
      : window.location.host; // Production: same host
    this.wsUrl = `${protocol}//${host}/ws`;
  }

  public connect(name: string, lat: number, lon: number): string {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    // Generate a unique client ID
    this.myId = 'user-' + Math.random().toString(36).substr(2, 9);
    
    this.ws = new WebSocket(`${this.wsUrl}?id=${this.myId}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connected = true;
      
      // Send login message
      this.send({
        type: 'login',
        name: name,
        lat: lat,
        lon: lon
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.connected = false;
      // Attempt to reconnect after 3 seconds
      this.reconnectTimer = setTimeout(() => {
        if (!this.connected) {
          console.log('Attempting to reconnect...');
          this.connect(name, lat, lon);
        }
      }, 3000);
    };

    return this.myId;
  }

  private handleMessage(message: any) {
    // Transform backend messages to match frontend expectations
    switch (message.type) {
      case 'world_state':
        // Backend sends: { type: 'world_state', users: [...] }
        this.broadcast({
          type: 'world_state',
          payload: { users: message.users }
        });
        break;

      case 'chat_request':
        // Backend sends: { type: 'chat_request', fromId: '...', fromName: '...' }
        this.broadcast({
          type: 'chat_request',
          payload: { fromId: message.fromId, fromName: message.fromName }
        });
        break;

      case 'chat_connected':
        // Backend sends: { type: 'chat_connected', partnerId: '...', partnerName: '...' }
        this.broadcast({
          type: 'chat_connected',
          payload: { partnerId: message.partnerId, partnerName: message.partnerName }
        });
        break;

      case 'chat_msg':
        // Backend sends: { type: 'chat_msg', content: '...', fromId: '...' }
        this.broadcast({
          type: 'chat_msg',
          payload: { content: message.content, fromId: message.fromId }
        });
        break;

      case 'chat_ended':
        // Backend sends: { type: 'chat_ended', message: '...' }
        this.broadcast({
          type: 'chat_ended',
          payload: { message: message.message || 'Chat ended' }
        });
        break;

      case 'chat_declined':
        // Backend sends: { type: 'chat_declined' }
        this.broadcast({
          type: 'chat_ended',
          payload: { message: 'Chat request declined' }
        });
        break;

      case 'request_cancelled':
        // Backend sends: { type: 'request_cancelled' }
        this.broadcast({
          type: 'chat_ended',
          payload: { message: 'Request cancelled' }
        });
        break;

      default:
        console.log('Unknown message type:', message);
    }
  }

  public send(msg: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    // Transform frontend messages to backend format
    let backendMsg: any;

    switch (msg.type) {
      case 'update_location':
        backendMsg = {
          type: 'update_location',
          lat: msg.payload.lat,
          lon: msg.payload.lon
        };
        break;

      case 'request_chat':
        backendMsg = {
          type: 'request_chat',
          targetId: msg.payload.targetId
        };
        break;

      case 'accept_chat':
        backendMsg = {
          type: 'accept_chat',
          requesterId: msg.payload.requesterId
        };
        break;

      case 'decline_chat':
        backendMsg = {
          type: 'decline_chat',
          requesterId: msg.payload.requesterId
        };
        break;

      case 'cancel_request':
        backendMsg = {
          type: 'cancel_request',
          targetId: msg.payload.targetId
        };
        break;

      case 'chat_msg':
        backendMsg = {
          type: 'chat_msg',
          content: msg.payload.content
        };
        break;

      case 'end_chat':
        backendMsg = {
          type: 'end_chat'
        };
        break;

      default:
        backendMsg = msg;
    }

    this.ws.send(JSON.stringify(backendMsg));
  }

  public onMessage(callback: (msg: SocketMessage) => void) {
    this.listeners.push(callback);
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.listeners = [];
  }

  private broadcast(msg: SocketMessage) {
    this.listeners.forEach(cb => cb(msg));
  }
}

export const websocketBackend = new WebSocketBackend();
