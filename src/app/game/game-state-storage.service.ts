import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GameState } from './game.state.model';

@Injectable({
  providedIn: 'root',
})
export class GameStateStorageService {
  private readonly storageKey = 'svindli-current-game-v1';
  private readonly isBrowser: boolean;
  private readonly gameStateSubject = new BehaviorSubject<GameState | null>(null);
  readonly gameState$ = this.gameStateSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  load(): GameState | null {
    if (!this.isBrowser) {
      return null;
    }

    const savedState = window.localStorage.getItem(this.storageKey);
    if (savedState === null) {
      this.gameStateSubject.next(null);
      return null;
    }

    const parsedState: unknown = JSON.parse(savedState);
    if (!this.isGameState(parsedState)) {
      throw new Error('A mentett játékállapot formátuma érvénytelen.');
    }

    const aiPlayers = parsedState.players.filter(player => player.isAI);
    const rememberedAiCards =
      parsedState.aiKnownDiscardCards?.length
        ? parsedState.aiKnownDiscardCards
        : aiPlayers.length === 1 &&
            parsedState.lastMove &&
            parsedState.players.some(
              player =>
                player.id === parsedState.lastMove?.playerId && player.isAI
            )
          ? parsedState.lastMove.cards
          : undefined;
    const legacyAiMemory =
      parsedState.aiKnownDiscards === undefined &&
      aiPlayers.length === 1 &&
      rememberedAiCards
        ? [{ playerId: aiPlayers[0].id, cards: rememberedAiCards }]
        : undefined;
    const stateWithoutLegacyMemory = { ...parsedState };
    delete stateWithoutLegacyMemory.aiKnownDiscardCards;

    const restoredState: GameState = {
      ...stateWithoutLegacyMemory,
      ...(parsedState.aiKnownDiscards !== undefined
        ? {}
        : legacyAiMemory
          ? { aiKnownDiscards: legacyAiMemory }
          : {}),
      moveCount:
        parsedState.moveCount ??
        (parsedState.lastMove ? 2 : 0),
    };
    this.gameStateSubject.next(restoredState);
    return restoredState;
  }

  save(gameState: GameState): void {
    if (this.isBrowser) {
      window.localStorage.setItem(this.storageKey, JSON.stringify(gameState));
      this.gameStateSubject.next(gameState);
    }
  }

  private isGameState(value: unknown): value is GameState {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const state = value as Partial<GameState>;
    return (
      Array.isArray(state.players) &&
      state.players.length > 0 &&
      state.players.every(
        player =>
          typeof player.id === 'string' &&
          typeof player.name === 'string' &&
          typeof player.isAI === 'boolean' &&
          Array.isArray(player.cards) &&
          player.cards.every(
            card =>
              typeof card.suit === 'string' &&
              typeof card.value === 'string'
          )
      ) &&
      Array.isArray(state.discardPile) &&
      state.discardPile.every(
        card =>
          typeof card.suit === 'string' &&
          typeof card.value === 'string'
      ) &&
      (state.gameId === undefined || typeof state.gameId === 'string') &&
      (state.startedAt === undefined || typeof state.startedAt === 'number') &&
      (state.gameDeadline === undefined || typeof state.gameDeadline === 'number') &&
      (state.gamePaused === undefined || typeof state.gamePaused === 'boolean') &&
      (state.pausedAt === undefined || typeof state.pausedAt === 'number') &&
      (state.gamePaused === true) === (state.pausedAt !== undefined) &&
      (state.profileId === undefined || typeof state.profileId === 'string') &&
      (state.rewardProcessed === undefined ||
        typeof state.rewardProcessed === 'boolean') &&
      (state.winnerIds === undefined ||
        (Array.isArray(state.winnerIds) &&
          state.winnerIds.every(id => typeof id === 'string'))) &&
      (state.isDraw === undefined || typeof state.isDraw === 'boolean') &&
      (state.aiKnownDiscards === undefined ||
        (Array.isArray(state.aiKnownDiscards) &&
          state.aiKnownDiscards.every(
            memory =>
              typeof memory.playerId === 'string' &&
              Array.isArray(memory.cards) &&
              memory.cards.every(
                card =>
                  typeof card.suit === 'string' &&
                  typeof card.value === 'string'
              )
          ))) &&
      (state.aiKnownDiscardCards === undefined ||
        (Array.isArray(state.aiKnownDiscardCards) &&
          state.aiKnownDiscardCards.every(
            card =>
              typeof card.suit === 'string' &&
              typeof card.value === 'string'
          ))) &&
      Number.isInteger(state.currentPlayerIndex) &&
      state.currentPlayerIndex! >= 0 &&
      state.currentPlayerIndex! < state.players.length &&
      typeof state.nextCardValue === 'string' &&
      (state.moveCount === undefined ||
        (Number.isInteger(state.moveCount) && state.moveCount >= 0)) &&
      (state.pendingWinnerId === undefined ||
        typeof state.pendingWinnerId === 'string') &&
      (state.challengeDeadline === undefined ||
        typeof state.challengeDeadline === 'number') &&
      (state.pendingWinnerId === undefined) ===
        (state.challengeDeadline === undefined) &&
      (state.aiFinalChallengeDeadline === undefined ||
        typeof state.aiFinalChallengeDeadline === 'number') &&
      (state.revealDeadline === undefined ||
        typeof state.revealDeadline === 'number') &&
      (state.pendingChallengerId === undefined ||
        typeof state.pendingChallengerId === 'string') &&
      (state.pendingBluffDetected === undefined ||
        typeof state.pendingBluffDetected === 'boolean') &&
      (state.revealDeadline === undefined) ===
        (state.pendingChallengerId === undefined) &&
      (state.revealDeadline === undefined) ===
        (state.pendingBluffDetected === undefined) &&
      typeof state.gameFinished === 'boolean' &&
      (state.winnerId === undefined || typeof state.winnerId === 'string') &&
      (state.lastMove === undefined ||
        (typeof state.lastMove.playerId === 'string' &&
          typeof state.lastMove.declaredValue === 'string' &&
          Number.isInteger(state.lastMove.count) &&
          Array.isArray(state.lastMove.cards) &&
          state.lastMove.cards.every(
            card =>
              typeof card.suit === 'string' &&
              typeof card.value === 'string'
          ) &&
          typeof state.lastMove.timestamp === 'number'))
    );
  }
}
