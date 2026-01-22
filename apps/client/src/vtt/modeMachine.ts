export type VttMode = "idle" | "move" | "attack" | "spell_menu" | "spell_targeting";

type ModeChangeHandler = (next: VttMode, prev: VttMode) => void;

export function createModeMachine(initial: VttMode, onChange: ModeChangeHandler) {
  let currentMode = initial;

  const setMode = (next: VttMode) => {
    if (next === currentMode) {
      return;
    }
    const prev = currentMode;
    currentMode = next;
    onChange(next, prev);
  };

  const getMode = () => currentMode;

  return {
    getMode,
    setMode
  };
}
