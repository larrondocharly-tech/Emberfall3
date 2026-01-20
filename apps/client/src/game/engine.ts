import type { PlayerProfile, Session } from "./state";

const STORAGE_KEY = "emberfall:sessions";

type StoredSessions = Record<string, Session>;

function loadSessions(): StoredSessions {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as StoredSessions;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Failed to parse sessions from localStorage:", error);
    return {};
  }
}

function saveSessions(sessions: StoredSessions) {
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
  sessions[session.id] = session;
  saveSessions(sessions);
  return session;
}

export function findSessionById(sessionId: string): Session | null {
  const sessions = loadSessions();
  return sessions[sessionId] ?? null;
}

export function removeSession(sessionId: string) {
  const sessions = loadSessions();
  if (sessions[sessionId]) {
    delete sessions[sessionId];
  }
  saveSessions(sessions);
}

export function listSessions(): Session[] {
  return Object.values(loadSessions());
}
