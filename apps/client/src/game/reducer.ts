import type { GameAction } from "./actions";
import type { GameState } from "./state";

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SESSION_CREATED":
    case "SESSION_JOINED":
      return { ...state, session: action.session };
    case "SESSION_LEFT":
      return { ...state, session: null };
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
