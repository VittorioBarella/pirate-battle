import type { GameConfig } from "../config/gameConfig";

export interface Match {
  id: string;
  playerId: string;
  playerName: string;
  date: string;
  score: number;
  duration: number;
  reason: "time" | "death";
  config: GameConfig;
}

export interface Page {
  items: Match[];
  total: number;
  page: number;
  pageSize: number;
}

export const playerId = "local-captain";