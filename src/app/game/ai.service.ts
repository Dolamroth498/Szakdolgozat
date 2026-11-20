import { Injectable } from '@angular/core';
import { Card } from './card.model';
import { AiDifficulty, GameState } from './game.state.model';
import { Player } from './game.player.model';
import { getLastMoveBluffProbability } from './ai-belief';
import { getNextCardValue } from './game.service';

interface AiMoveWeights {
  truthfulMove: number;
  bluffPenalty: number;
  finalCardBonus: number;
  missedFinalCardPenalty: number;
  futureLegalMove: number;
}

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
    const belief = gameState.aiBeliefs?.find(
      candidate => candidate.playerId === player.id
    );
    if (belief?.lastMoveCardProbabilities.length) {
      const bluffProbability = getLastMoveBluffProbability(
        belief,
        lastMove.declaredValue
      );
      const riskScore = Math.min(
        1,
        bluffProbability + (opponent && opponent.cards.length <= 1 ? 0.15 : 0)
      );
      const thresholds: Record<AiDifficulty, number> = {
        easy: 0.7,
        medium: 0.45,
        hard: 0.3,
      };

      return riskScore >= thresholds[difficulty];
    }

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

  chooseCard(
    player: Player,
    declaredValue: string,
    gameState?: GameState
  ): Card {
    if (!gameState || player.cards.length <= 1) {
      return (
        player.cards.find(card => card.value === declaredValue) ??
        player.cards[0]
      );
    }

    const weights = this.getMoveWeights(gameState.aiDifficulty ?? 'medium');
    let bestCandidate = player.cards[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of player.cards) {
      const handAfterMove = player.cards.filter(card => card !== candidate);
      const score = this.scoreMove(
        candidate,
        handAfterMove,
        declaredValue,
        gameState.players.length,
        weights
      );
      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    return bestCandidate;
  }

  private getMoveWeights(difficulty: AiDifficulty): AiMoveWeights {
    const weights = {
      easy: {
        truthfulMove: 18,
        bluffPenalty: 30,
        finalCardBonus: 32,
        missedFinalCardPenalty: 16,
        futureLegalMove: 4,
      },
      medium: {
        truthfulMove: 14,
        bluffPenalty: 20,
        finalCardBonus: 48,
        missedFinalCardPenalty: 24,
        futureLegalMove: 6,
      },
      hard: {
        truthfulMove: 10,
        bluffPenalty: 12,
        finalCardBonus: 70,
        missedFinalCardPenalty: 35,
        futureLegalMove: 8,
      },
    };

    return weights[difficulty];
  }

  private scoreMove(
    candidate: Card,
    remainingCards: Card[],
    declaredValue: string,
    playerCount: number,
    weights: AiMoveWeights
  ): number {
    const isTruthful = candidate.value === declaredValue;
    if (remainingCards.length === 0) {
      return isTruthful ? 1_000 : -1_000;
    }

    let score = isTruthful ? weights.truthfulMove : -weights.bluffPenalty;
    const finalCardValue = this.getFinalCardValue(
      declaredValue,
      playerCount,
      remainingCards.length
    );
    const matchingFinalCards = remainingCards.filter(
      card => card.value === finalCardValue
    ).length;

    score += matchingFinalCards > 0
      ? weights.finalCardBonus
      : -weights.missedFinalCardPenalty;
    score += this.scoreFutureLegalMoves(
      remainingCards,
      declaredValue,
      playerCount,
      weights.futureLegalMove
    );
    return score;
  }

  private getFinalCardValue(
    declaredValue: string,
    playerCount: number,
    cardsAfterMove: number
  ): string {
    let value = declaredValue;
    for (let turn = 0; turn < playerCount * cardsAfterMove; turn++) {
      value = getNextCardValue(value);
    }
    return value;
  }

  private scoreFutureLegalMoves(
    cards: Card[],
    declaredValue: string,
    playerCount: number,
    moveWeight: number
  ): number {
    let score = 0;
    const remainingByValue = new Map<string, number>();
    for (const card of cards) {
      remainingByValue.set(
        card.value,
        (remainingByValue.get(card.value) ?? 0) + 1
      );
    }
    let value = declaredValue;
    for (let ownTurn = 0; ownTurn < cards.length; ownTurn++) {
      for (let turn = 0; turn < playerCount; turn++) {
        value = getNextCardValue(value);
      }
      const available = remainingByValue.get(value) ?? 0;
      if (available > 0) {
        score += moveWeight / (ownTurn + 1);
        remainingByValue.set(value, available - 1);
      }
    }
    return score;
  }
}
