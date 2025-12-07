export interface User {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: 'idle' | 'requesting' | 'chatting';
  lastActive?: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: 'text' | 'system';
}

export type ChatState = 'idle' | 'requesting' | 'waiting' | 'chatting';

// Mock Socket Message Types
export interface SocketMessage {
  type: string;
  payload?: any;
}

export interface ChatRequest {
  fromId: string;
  fromName: string;
}

export interface ChatSession {
  partnerId: string;
  partnerName: string;
}