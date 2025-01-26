import { Card } from "./card.model";

export interface Player {
    id: string;
    name: string;
    cards: Card[];
    isAI: boolean; // Igaz, ha gépi játékos
  }