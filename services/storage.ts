

import { ChatMessage, ChatSession } from '../types';

const STORAGE_PREFIX = 'omniai_chat_';
const USERS_DB_KEY = 'omniai_users_db';
const API_KEY_STORAGE_KEY = 'omniai_custom_api_key';

interface UserCredentials {
    password: string;
    created: number;
}

interface UserDB {
    [username: string]: UserCredentials;
}

// --- API Key Management ---

export const saveApiKey = (apiKey: string) => {
    if (!apiKey) {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        return;
    }
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
};

export const getApiKey = (): string | null => {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
};

// --- User Auth & Management ---

const getUserDB = (): UserDB => {
    try {
        return JSON.parse(localStorage.getItem(USERS_DB_KEY) || '{}');
    } catch {
        return {};
    }
};

const saveUserDB = (db: UserDB) => {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
};

export const registerUser = (username: string, password: string): { success: boolean; message: string } => {
    const db = getUserDB();
    if (db[username]) {
        return { success: false, message: 'Username already exists' };
    }
    
    db[username] = {
        password: password, 
        created: Date.now()
    };
    
    saveUserDB(db);
    return { success: true, message: 'Account created successfully' };
};

export const authenticateUser = (username: string, password: string): boolean => {
    const db = getUserDB();
    const user = db[username];
    if (!user) return false;
    return user.password === password;
};

// --- Chat Data Management ---

export const getSessions = (username: string): ChatSession[] => {
    if (!username) return [];
    try {
        const data = localStorage.getItem(`${STORAGE_PREFIX}sessions_${username}`);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Failed to load sessions", e);
        return [];
    }
};

export const saveSession = (username: string, session: ChatSession) => {
    if (!username) return;
    const sessions = getSessions(username);
    const index = sessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
        sessions[index] = session;
    } else {
        sessions.unshift(session);
    }
    localStorage.setItem(`${STORAGE_PREFIX}sessions_${username}`, JSON.stringify(sessions));
    
    // --- SERVER SYNC PLACEHOLDER ---
    // If you have a web server host, you would uncomment this function and 
    // implement the API call to your backend.
    // syncToServer(username, sessions);
};

export const deleteSession = (username: string, sessionId: string) => {
     if (!username) return;
     const sessions = getSessions(username);
     const newSessions = sessions.filter(s => s.id !== sessionId);
     localStorage.setItem(`${STORAGE_PREFIX}sessions_${username}`, JSON.stringify(newSessions));
};

export const clearUserHistory = (username: string) => {
    localStorage.removeItem(`${STORAGE_PREFIX}sessions_${username}`);
};

export const exportUserData = (username: string) => {
    if (!username) return;
    const sessions = getSessions(username);
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `omniai_chat_history_${username}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// --- MOCK SERVER SYNC (For Future Implementation) ---
/*
const syncToServer = async (username: string, data: any) => {
    try {
        await fetch('https://your-web-server.com/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, data })
        });
    } catch (e) {
        console.error("Sync failed", e);
    }
};
*/