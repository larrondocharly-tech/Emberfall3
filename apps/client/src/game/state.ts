export type PlayerProfile = {
  name: string;
  raceId: string;
  classId: string;
};

export type Session = {
  id: string;
  player: PlayerProfile;
  createdAt: string;
  code: string;
};

export type GameState = {
  session: Session | null;
};

export const initialState: GameState = {
  session: null
};
