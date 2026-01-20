import type { Session } from "./state";

export type GameAction =
  | { type: "SESSION_CREATED"; session: Session }
  | { type: "SESSION_JOINED"; session: Session }
  | { type: "SESSION_LEFT" };
