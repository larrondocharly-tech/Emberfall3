export type Tool = "token" | "pan" | "measure" | "draw";

export const defaultTool: Tool = "token";

export const toolLabels: Record<Tool, string> = {
  token: "Token",
  pan: "Pan",
  measure: "Measure",
  draw: "Draw"
};
