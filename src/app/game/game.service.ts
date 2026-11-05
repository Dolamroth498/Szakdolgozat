import { Injectable } from '@angular/core';
import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';
import { Move } from './move.model';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly values = [
    'VII',
    'VIII',
    'IX',
    'X',
    'alsó',
    'felső',
    'király',
    'ász',
  ];

  private readonly suits = ['piros', 'zöld', 'makk', 'tök'];

  generateDeck(): Card[] {
    const deck: Card[] = [];

    for (const suit of this.suits) {
      for (const value of this.values) {
        deck.push({ suit, value });
      }
    }

    return deck;
  }

  shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  dealCards(players: Player[], deck: Card[]): GameState {
    if (players.length === 0) {
      throw new RangeError('A játékhoz legalább egy játékos szükséges.');
    }

    const dealtPlayers = players.map(player => ({
      ...player,
      cards: [] as Card[],
    }));

    deck.forEach((card, index) => {
      dealtPlayers[index % dealtPlayers.length].cards.push(card);
    });

    const startedAt = Date.now();
    return {
      players: dealtPlayers,
      discardPile: [],
      gameId: `${startedAt}-${Math.random().toString(36).slice(2)}`,
      startedAt,
      gameDeadline: startedAt + 15 * 60 * 1000,
      aiKnownDiscards: [],
      currentPlayerIndex: 0,
      nextCardValue: this.values[0],
      roundsStarted: 1,
      successfulBluffCount: 0,
      successfulSvindliCount: 0,
      moveCount: 0,
      gameFinished: false,
    };
  }

  playMove(
    playerId: string,
    cards: Card[],
    declaredValue: string,
    gameState: GameState
  ): boolean {
    if (
      gameState.gameFinished ||
      gameState.gamePaused ||
      gameState.revealDeadline !== undefined ||
      gameState.pendingWinnerId !== undefined ||
      gameState.players.length === 0 ||
      gameState.currentPlayerIndex < 0 ||
      gameState.currentPlayerIndex >= gameState.players.length ||
      declaredValue !== gameState.nextCardValue ||
      !this.values.includes(declaredValue) ||
      cards.length !== 1
    ) {
      return false;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.id !== playerId) {
      return false;
    }

    const uniqueCards = new Set(cards);
    if (
      uniqueCards.size !== cards.length ||
      cards.some(card => !player.cards.includes(card))
    ) {
      return false;
    }

    this.countUnchallengedBluff(gameState);

    const playedCards = [...cards];
    for (const card of playedCards) {
      player.cards.splice(player.cards.indexOf(card), 1);
      gameState.discardPile.push(card);
      if (player.isAI) {
        gameState.aiKnownDiscards ??= [];
        let playerMemory = gameState.aiKnownDiscards.find(
          memory => memory.playerId === player.id
        );
        if (!playerMemory) {
          playerMemory = { playerId: player.id, cards: [] };
          gameState.aiKnownDiscards.push(playerMemory);
        }
        playerMemory.cards.push(card);
      }
    }

    const move: Move = {
      playerId,
      declaredValue,
      cards: playedCards,
      count: playedCards.length,
      timestamp: Date.now(),
    };

    gameState.lastMove = move;
    gameState.moveCount = (gameState.moveCount ?? 0) + 1;

    if (player.cards.length === 0) {
      gameState.pendingWinnerId = player.id;
      gameState.challengeDeadline = Date.now() + 10_000;
      gameState.aiFinalChallengeDeadline = Date.now() + 5_000;
      this.nextTurn(gameState);
      return true;
    }

    this.advanceCardValue(gameState, declaredValue);
    this.nextTurn(gameState);

    return true;
  }

  callSvindli(accuserId: string, gameState: GameState): boolean {
    if (gameState.gameFinished || gameState.gamePaused) {
      return false;
    }

    if (
      gameState.pendingWinnerId &&
      gameState.challengeDeadline !== undefined &&
      gameState.revealDeadline === undefined &&
      Date.now() >= gameState.challengeDeadline
    ) {
      this.finishPendingWin(gameState);
      return false;
    }

    if (
      !gameState.lastMove ||
      gameState.revealDeadline !== undefined ||
      (gameState.moveCount ?? 0) <= 1 ||
      gameState.players.length === 0 ||
      gameState.currentPlayerIndex < 0 ||
      gameState.currentPlayerIndex >= gameState.players.length
    ) {
      return false;
    }

    const lastMove = gameState.lastMove;
    const accuser = gameState.players.find(player => player.id === accuserId);
    const offender = gameState.players.find(
      player => player.id === lastMove.playerId
    );

    if (
      !accuser ||
      accuserId === lastMove.playerId ||
      !offender
    ) {
      return false;
    }

    const bluffDetected = lastMove.cards.some(
      card => card.value !== lastMove.declaredValue
    );

    gameState.pendingChallengerId = accuserId;
    gameState.pendingBluffDetected = bluffDetected;
    gameState.revealDeadline = Date.now() + 3_000;
    gameState.aiFinalChallengeDeadline = undefined;

    return bluffDetected;
  }

  finishSvindliChallenge(gameState: GameState): boolean {
    if (
      gameState.gameFinished ||
      gameState.gamePaused ||
      !gameState.lastMove ||
      !gameState.pendingChallengerId ||
      gameState.pendingBluffDetected === undefined ||
      gameState.revealDeadline === undefined ||
      Date.now() < gameState.revealDeadline
    ) {
      return false;
    }

    const lastMove = gameState.lastMove;
    const challenger = gameState.players.find(
      player => player.id === gameState.pendingChallengerId
    );
    const offender = gameState.players.find(
      player => player.id === lastMove.playerId
    );
    if (!challenger || !offender) {
      throw new Error('A kihívás játékosai nem találhatók a játékállapotban.');
    }

    const bluffDetected = gameState.pendingBluffDetected;

    if (bluffDetected) {
      gameState.successfulSvindliCount =
        (gameState.successfulSvindliCount ?? 0) + 1;
      offender.cards.push(...gameState.discardPile);
      gameState.discardPile = [];
      gameState.aiKnownDiscards = [];
      const offenderIndex = gameState.players.indexOf(offender);
      gameState.currentPlayerIndex =
        (offenderIndex + 1) % gameState.players.length;
    } else {
      challenger.cards.push(...gameState.discardPile);
      gameState.discardPile = [];
      gameState.aiKnownDiscards = [];
      gameState.currentPlayerIndex = gameState.players.indexOf(challenger);
      this.nextTurn(gameState);

      if (gameState.pendingWinnerId) {
        gameState.gameFinished = true;
        gameState.winnerId = gameState.pendingWinnerId;
        gameState.winnerIds = [gameState.pendingWinnerId];
        gameState.isDraw = false;
      }
    }

    gameState.lastMove = undefined;
    if (bluffDetected) {
      gameState.nextCardValue = lastMove.declaredValue;
    } else {
      this.advanceCardValue(gameState, lastMove.declaredValue);
    }
    gameState.pendingChallengerId = undefined;
    gameState.pendingBluffDetected = undefined;
    gameState.revealDeadline = undefined;

    if (bluffDetected || gameState.gameFinished) {
      gameState.pendingWinnerId = undefined;
      gameState.challengeDeadline = undefined;
      gameState.aiFinalChallengeDeadline = undefined;
    }

    return true;
  }

  finishPendingWin(gameState: GameState): boolean {
    if (
      gameState.gameFinished ||
      gameState.gamePaused ||
      gameState.revealDeadline !== undefined ||
      !gameState.pendingWinnerId ||
      !gameState.challengeDeadline ||
      Date.now() < gameState.challengeDeadline
    ) {
      return false;
    }

    gameState.gameFinished = true;
    gameState.winnerId = gameState.pendingWinnerId;
    gameState.winnerIds = [gameState.pendingWinnerId];
    gameState.isDraw = false;
    this.countUnchallengedBluff(gameState);
    gameState.pendingWinnerId = undefined;
    gameState.challengeDeadline = undefined;
    gameState.aiFinalChallengeDeadline = undefined;
    return true;
  }

  finishByTime(gameState: GameState, now = Date.now()): boolean {
    if (
      gameState.gameFinished ||
      gameState.gamePaused ||
      gameState.gameDeadline === undefined ||
      now < gameState.gameDeadline
    ) {
      return false;
    }

    const fewestCards = Math.min(
      ...gameState.players.map(player => player.cards.length)
    );
    const winners = gameState.players.filter(
      player => player.cards.length === fewestCards
    );

    gameState.gameFinished = true;
    gameState.winnerIds = winners.map(player => player.id);
    gameState.isDraw = winners.length > 1;
    gameState.winnerId = winners.length === 1 ? winners[0].id : undefined;
    if (
      gameState.pendingWinnerId === undefined &&
      gameState.pendingChallengerId === undefined
    ) {
      this.countUnchallengedBluff(gameState);
    }
    gameState.pendingWinnerId = undefined;
    gameState.challengeDeadline = undefined;
    gameState.aiFinalChallengeDeadline = undefined;
    gameState.pendingChallengerId = undefined;
    gameState.pendingBluffDetected = undefined;
    gameState.revealDeadline = undefined;
    return true;
  }

  nextTurn(gameState: GameState): void {
    if (gameState.players.length === 0) {
      return;
    }

    gameState.currentPlayerIndex =
      (gameState.currentPlayerIndex + 1) % gameState.players.length;
  }

  getNextValue(currentValue: string): string {
    const index = this.values.indexOf(currentValue);
    if (index === -1) {
      throw new RangeError(`Ismeretlen bemondási érték: ${currentValue}`);
    }

    return this.values[(index + 1) % this.values.length];
  }

  private advanceCardValue(gameState: GameState, currentValue: string): void {
    gameState.nextCardValue = this.getNextValue(currentValue);
    if (gameState.nextCardValue === this.values[0] && !gameState.gameFinished) {
      gameState.roundsStarted = (gameState.roundsStarted ?? 1) + 1;
    }
  }

  private countUnchallengedBluff(gameState: GameState): void {
    const lastMove = gameState.lastMove;
    if (
      lastMove &&
      !gameState.pendingChallengerId &&
      lastMove.cards.some(card => card.value !== lastMove.declaredValue)
    ) {
      gameState.successfulBluffCount =
        (gameState.successfulBluffCount ?? 0) + 1;
    }
  }
}
