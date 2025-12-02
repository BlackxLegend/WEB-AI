
export enum View {
  CHAT = 'CHAT',
  AUDIO = 'AUDIO',
}

export enum ChatModel {
  FAST = 'gemini-2.5-flash',
  SMART = 'gemini-3-pro-preview',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  grounding?: {
    search?: { uri: string; title: string }[];
    maps?: { uri: string; title: string }[];
  };
  image?: string;
  isThinking?: boolean;
  thoughtDuration?: number;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface User {
  username: string;
  lastLogin: number;
}

export interface VeoConfig {
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p';
}
