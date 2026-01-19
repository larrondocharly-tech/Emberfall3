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

async function postJson<T>(path: string, body: any): Promise<T> {
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
  races: () => getJson<any[]>("/data/races"),
  classes: () => getJson<any[]>("/data/classes"),
  spells: () => getJson<any[]>("/data/spells"),
  monsters: () => getJson<any[]>("/data/monsters"),

  createVtt: (options: any) => postJson<any>("/matchmake/create/vtt", options),
  joinById: (roomId: string, options: any) =>
    postJson<any>(`/matchmake/joinById/${encodeURIComponent(roomId)}`, options),
};
