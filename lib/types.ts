export type GameMode = "fun" | "money";
export type GameStatus = "active" | "ended";
export type GamePhase = "lobby" | "active" | "ended";
export type HandState = "awaiting_start" | "betting" | "awaiting_winner";
export type HandStatus = "active" | "folded" | "all-in";
export type ActionType = "fold" | "check" | "call" | "raise" | "post_blind";

export interface Game {
  id: string;
  room_code: string;
  mode: GameMode;
  chip_value: number;
  starting_chips: number;
  status: GameStatus;
  created_at: string;
  current_dealer_index: number | null;
  current_round: number;
  current_hand: number;
  game_phase: GamePhase;
  hand_state: HandState;
  current_turn_player_id: string | null;
  small_blind: number;
  big_blind: number;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  chips: number;
  total_buyins: number;
  is_host: boolean;
  joined_at: string;
  seat_order: number | null;
  current_bet: number;
  total_hand_bet: number;
  hand_status: HandStatus;
  has_acted: boolean;
  is_dealer: boolean;
  is_small_blind: boolean;
  is_big_blind: boolean;
}

export interface Pot {
  id: string;
  game_id: string;
  amount: number;
}

export interface BettingRound {
  id: string;
  game_id: string;
  hand_number: number;
  round_number: number;
  current_highest_bet: number;
  last_aggressor_id: string | null;
  status: "active" | "complete";
  created_at: string;
}

export interface PlayerActionRow {
  id: string;
  game_id: string;
  betting_round_id: string;
  player_id: string;
  action: ActionType;
  amount: number;
  snapshot: PlayerActionSnapshot | null;
  undone: boolean;
  created_at: string;
}

export interface PlayerActionSnapshot {
  player: {
    chips: number;
    current_bet: number;
    total_hand_bet: number;
    hand_status: HandStatus;
    has_acted: boolean;
  };
  round: {
    current_highest_bet: number;
    last_aggressor_id: string | null;
  };
  pot_amount: number;
}

export interface SidePotRow {
  id: string;
  game_id: string;
  pot_index: number;
  amount: number;
  eligible_player_ids: string[];
  awarded_player_id: string | null;
  created_at: string;
}
