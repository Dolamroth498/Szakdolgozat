export interface User {
  id: string;
  name: string;
  email: string;
  backgrounds: string[];
  cardBacks: string[];
  selectedBackground: string | null;
  selectedCardBack: string | null;
  coins: number;
  points: number;
  wins: number;
  draws: number;
  gamesPlayed: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  winRate: number;
}