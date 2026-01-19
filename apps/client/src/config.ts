const isHttps = window.location.protocol === "https:";
const wsProto = isHttps ? "wss" : "ws";

// On garde /colyseus pour le WS (proxy Vite => 2567)
export const WS_BASE = `${wsProto}://${window.location.host}/colyseus`;
