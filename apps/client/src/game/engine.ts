import type { PlayerProfile, Session } from "./state";

const SESSIONS_KEY = "emberfall:sessions";
const CODES_KEY = "emberfall:codes";

type StoredSessions = Record<string, Session>;
type StoredCodes = Record<string, string>;

function loadSessions(): StoredSessions {
  const raw = localStorage.getItem(SESSIONS_KEY);
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
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function loadCodes(): StoredCodes {
  const raw = localStorage.getItem(CODES_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as StoredCodes;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Failed to parse codes from localStorage:", error);
    return {};
  }
}

function saveCodes(codes: StoredCodes) {
  localStorage.setItem(CODES_KEY, JSON.stringify(codes));
}

function generateSessionId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateRoomCode(codes: StoredCodes): string {
  let attempts = 0;
  while (attempts < 10000) {
    const code = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    if (!codes[code]) {
      return code;
    }
    attempts += 1;
  }
  return Date.now().toString().slice(-4);
}

export function createSession(player: PlayerProfile): Session {
  const codes = loadCodes();
  const code = generateRoomCode(codes);
  const session: Session = {
    id: generateSessionId(),
    player,
    createdAt: new Date().toISOString(),
    code
  };
  const sessions = loadSessions();
  sessions[session.id] = session;
  saveSessions(sessions);
  codes[code] = session.id;
  saveCodes(codes);
  return session;
}

export function findSessionById(sessionId: string): Session | null {
  const sessions = loadSessions();
  return sessions[sessionId] ?? null;
}

export function removeSession(sessionId: string) {
  const sessions = loadSessions();
  if (sessions[sessionId]) {
    const codeToRemove = sessions[sessionId].code;
    delete sessions[sessionId];
    const codes = loadCodes();
    if (codes[codeToRemove] === sessionId) {
      delete codes[codeToRemove];
      saveCodes(codes);
    }
  }
  saveSessions(sessions);
}

export function listSessions(): Session[] {
  return Object.values(loadSessions());
}

export function findSessionIdByCode(code: string): string | null {
  const codes = loadCodes();
  return codes[code] ?? null;
}
