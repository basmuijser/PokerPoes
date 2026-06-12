export type GameMode = "fun" | "money";
export type GameStatus = "active" | "ended";

export interface Game {
  id: string;
  room_code: string;
  mode: GameMode;
  chip_value: number;
  starting_chips: number;
  status: GameStatus;
  created_at: string;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  chips: number;
  total_buyins: number;
  is_host: boolean;
  joined_at: string;
}

export interface Pot {
  id: string;
  game_id: string;
  amount: number;
}
