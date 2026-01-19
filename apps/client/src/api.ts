import type { ClassData, MonsterData, RaceData, SpellData } from "@emberfall3/shared";
import { API_BASE } from "./config";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${txt}`);
  }

  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${txt}`);
  }

  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<{ ok: boolean }>("/health"),
  races: () => getJson<RaceData[]>("/data/races.json"),
  classes: () => getJson<ClassData[]>("/data/classes.json"),
  spells: () => getJson<SpellData[]>("/data/spells.json"),
  monsters: () => getJson<MonsterData[]>("/data/monsters.json"),

  createVtt: (options: Record<string, unknown>) =>
    postJson<unknown>("/matchmake/create/vtt", options),
  joinById: (roomId: string, options: Record<string, unknown>) =>
    postJson<unknown>(`/matchmake/joinById/${encodeURIComponent(roomId)}`, options),
};
