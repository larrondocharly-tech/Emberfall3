const DEFAULT_SERVER_URL = "http://localhost:2567";
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? DEFAULT_SERVER_URL;
const WS_SERVER_URL = SERVER_URL.replace(/^http/, "ws");
const USE_PROXY = import.meta.env.DEV;

export const API_BASE = USE_PROXY ? "" : SERVER_URL;
export const DATA_BASE = USE_PROXY ? "/data" : `${SERVER_URL}/data`;
export const WS_BASE = USE_PROXY ? "/colyseus" : `${WS_SERVER_URL}/colyseus`;
