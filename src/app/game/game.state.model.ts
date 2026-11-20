import { Card } from './card.model';
import { Player } from './game.player.model';
import { Move } from './move.model';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export interface AiCardBelief {
  card: Card;
  locations: { playerId: string; probability: number }[];
  discardProbability: number;
}

export interface AiMoveCardProbability {
  card: Card;
  probability: number;
}

export interface AiPlayerBelief {
  playerId: string;
  cards: AiCardBelief[];
  lastMoveCardProbabilities: AiMoveCardProbability[];
}

export interface GameState {

  players: Player[];

  discardPile: Card[];

  gameId?: string;

  startedAt?: number;

  gameDeadline?: number;

  gamePaused?: boolean;

  pausedAt?: number;

  localTurnLockedAt?: number;

  challengeRevealStartedAt?: number;

  profileId?: string;

  rewardProcessed?: boolean;

  winnerIds?: string[];

  forfeitedPlayerId?: string;

  isDraw?: boolean;

  aiKnownDiscards?: {
    playerId: string;
    cards: Card[];
  }[];

  aiKnownDiscardCards?: Card[];

  aiBeliefs?: AiPlayerBelief[];

  aiDifficulty?: AiDifficulty;

  currentPlayerIndex: number;

  nextCardValue: string;

  roundsStarted?: number;

  successfulBluffCount?: number;

  successfulSvindliCount?: number;

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