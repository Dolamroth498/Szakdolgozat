import { Card } from './card.model';

export interface Move {

  playerId: string;

  declaredValue: string;

  cards: Card[];

  count: number;

  timestamp: number;
}