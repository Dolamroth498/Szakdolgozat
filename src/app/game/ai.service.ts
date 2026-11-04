import { Injectable } from '@angular/core';
import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

@Injectable({
  providedIn: 'root',
})
export class AiService {
  chooseRandomChallenger(
    players: Player[],
    lastPlayerId: string
  ): Player | undefined {
    const challengers = players.filter(
      player => player.isAI && player.id !== lastPlayerId
    );
    if (challengers.length === 0) {
      return undefined;
    }

    return challengers[Math.floor(Math.random() * challengers.length)];
  }

  shouldCallSvindli(
    player: Player,
    gameState: GameState,
    difficulty: AiDifficulty = 'medium'
  ): boolean {
    const lastMove = gameState.lastMove;
    if (
      !lastMove ||
      player.id === lastMove.playerId ||
      (gameState.moveCount ?? 0) <= 1 ||
      gameState.revealDeadline !== undefined
    ) {
      return false;
    }

    const opponent = gameState.players.find(
      candidate => candidate.id === lastMove.playerId
    );
    const rememberedCards =
      gameState.aiKnownDiscards?.find(
        memory => memory.playerId === player.id
      )?.cards ?? [];
    const knownDeclaredValueCards =
      player.cards.filter(card => card.value === lastMove.declaredValue).length +
      rememberedCards.filter(card => card.value === lastMove.declaredValue).length;

    if (knownDeclaredValueCards + lastMove.count > 4) {
      return true;
    }

    const riskScore = Math.min(
      1,
      (knownDeclaredValueCards / 4) * 0.55 +
        (lastMove.count / 4) * 0.2 +
        (opponent && opponent.cards.length <= 1 ? 0.2 : 0) +
        (gameState.discardPile.length / 32) * 0.1
    );

    const thresholds: Record<AiDifficulty, number> = {
      easy: 0.7,
      medium: 0.45,
      hard: 0.3,
    };

    return riskScore >= thresholds[difficulty];
  }

  chooseCard(player: Player, declaredValue: string): Card {
    const matchingCard = player.cards.find(
      card => card.value === declaredValue
    );
    if (matchingCard) {
      return matchingCard;
    }

    return player.cards[0];
  }
}
