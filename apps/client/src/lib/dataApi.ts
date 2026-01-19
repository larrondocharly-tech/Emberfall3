import type { ClassData, MonsterData, RaceData, SpellData } from "@emberfall3/shared";
import { DATA_BASE } from "../config";

type DataResource = "races" | "classes" | "spells" | "monsters";

export async function fetchJson<T>(resource: DataResource): Promise<T> {
  const url = `${DATA_BASE}/${resource}`;
  console.info(`[data] fetch ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  console.info(`[data] ${url} -> ${response.status}`);

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const suffix = details ? ` :: ${details}` : "";
    throw new Error(`Serveur data indisponible (${response.status}) pour ${url}${suffix}`);
  }

  return (await response.json()) as T;
}

export const dataApi = {
  races: () => fetchJson<RaceData[]>("races"),
  classes: () => fetchJson<ClassData[]>("classes"),
  spells: () => fetchJson<SpellData[]>("spells"),
  monsters: () => fetchJson<MonsterData[]>("monsters")
};
