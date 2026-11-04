import { Card } from './card.model';
import { Player } from './game.player.model';
import { Move } from './move.model';

export interface GameState {

  players: Player[];

  discardPile: Card[];

  gameId?: string;

  startedAt?: number;

  gameDeadline?: number;

  gamePaused?: boolean;

  pausedAt?: number;

  profileId?: string;

  rewardProcessed?: boolean;

  winnerIds?: string[];

  isDraw?: boolean;

  aiKnownDiscards?: {
    playerId: string;
    cards: Card[];
  }[];

  aiKnownDiscardCards?: Card[];

  currentPlayerIndex: number;

  nextCardValue: string;

  moveCount?: number;

  lastMove?: Move;

  pendingWinnerId?: string;

  challengeDeadline?: number;

  aiFinalChallengeDeadline?: number;

  revealDeadline?: number;

  pendingChallengerId?: string;

  pendingBluffDetected?: boolean;

  gameFinished: boolean;

  winnerId?: string;
}