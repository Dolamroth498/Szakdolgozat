import { Card } from './card.model';
import { Player } from './game.player.model';
import { Move } from './move.model';

export interface GameState {

  players: Player[];

  discardPile: Card[];

  currentPlayerIndex: number;

  nextCardValue: string;

  lastMove?: Move;

  gameFinished: boolean;

  winnerId?: string;
}