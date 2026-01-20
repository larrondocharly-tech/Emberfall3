export type Tool = "token" | "pan" | "ping" | "measure" | "draw";

export const defaultTool: Tool = "token";

export const toolLabels: Record<Tool, string> = {
  token: "Token",
  pan: "Pan",
  ping: "Ping",
  measure: "Measure",
  draw: "Draw"
};
