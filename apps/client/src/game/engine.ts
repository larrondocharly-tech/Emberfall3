import type { PlayerProfile, Session } from "./state";

const STORAGE_KEY = "emberfall:sessions";

type StoredSession = Session;

function loadSessions(): StoredSession[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse sessions from localStorage:", error);
    return [];
  }
}

function saveSessions(sessions: StoredSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function generateSessionId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(player: PlayerProfile): Session {
  const session: Session = {
    id: generateSessionId(),
    player,
    createdAt: new Date().toISOString()
  };
  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);
  return session;
}

export function findSessionById(sessionId: string): Session | null {
  const sessions = loadSessions();
  return sessions.find((entry) => entry.id === sessionId) ?? null;
}

export function removeSession(sessionId: string) {
  const sessions = loadSessions().filter((entry) => entry.id !== sessionId);
  saveSessions(sessions);
}

export function listSessions(): Session[] {
  return loadSessions();
}
