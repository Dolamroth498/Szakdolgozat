import { Injectable } from '@angular/core';
import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';
import { Move } from './move.model';

@Injectable({
  providedIn: 'root',
})
export class GameService {

  private values = [
    'VII',
    'VIII',
    'IX',
    'X',
    'alsó',
    'felső',
    'király',
    'ász'
  ];

  private suits = [
    'piros',
    'zöld',
    'makk',
    'tök'
  ];

  generateDeck(): Card[] {

    const deck: Card[] = [];

    for (const suit of this.suits) {
      for (const value of this.values) {
        deck.push({
          suit,
          value
        });
      }
    }

    return deck;
  }

  shuffleDeck(deck: Card[]): Card[] {

    return [...deck].sort(
      () => Math.random() - 0.5
    );
  }

  dealCards(
    players: Player[],
    deck: Card[]
  ): GameState {

    const cardsPerPlayer =
      Math.floor(deck.length / players.length);

    players.forEach(player => {

      player.cards = deck.splice(
        0,
        cardsPerPlayer
      );

    });

    return {
      players,
      discardPile: [],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: false
    };
  }

  playMove(
    playerId: string,
    cards: Card[],
    declaredValue: string,
    gameState: GameState
  ): boolean {

    const player =
      gameState.players.find(
        p => p.id === playerId
      );

    if (!player) {
      return false;
    }

    if (cards.length < 1 || cards.length > 4) {
      return false;
    }

    for (const card of cards) {

      if (!player.cards.includes(card)) {
        return false;
      }
    }

    cards.forEach(card => {

      const index =
        player.cards.indexOf(card);

      if (index > -1) {

        player.cards.splice(
          index,
          1
        );
      }

      gameState.discardPile.push(card);

    });

    const move: Move = {

      playerId,
      declaredValue,
      cards,
      count: cards.length,
      timestamp: Date.now()

    };

    gameState.lastMove = move;

    if (player.cards.length === 0) {

      gameState.gameFinished = true;
      gameState.winnerId = player.id;

      return true;
    }

    gameState.nextCardValue =
      this.getNextValue(
        gameState.nextCardValue
      );

    this.nextTurn(gameState);

    return true;
  }

  callSvindli(
    accuserId: string,
    gameState: GameState
  ): boolean {

    if (!gameState.lastMove) {
      return false;
    }

    const lastMove =
      gameState.lastMove;

    const bluffDetected =
      lastMove.cards.some(
        card =>
          card.value !==
          lastMove.declaredValue
      );

    if (bluffDetected) {

      const offender =
        gameState.players.find(
          p => p.id === lastMove.playerId
        );

      if (offender) {

        offender.cards.push(
          ...gameState.discardPile
        );
      }

      gameState.discardPile = [];

      const accuserIndex =
        gameState.players.findIndex(
          p => p.id === accuserId
        );

      if (accuserIndex !== -1) {

        gameState.currentPlayerIndex =
          accuserIndex;
      }

      gameState.lastMove = undefined;

      return true;
    }

    const accuser =
      gameState.players.find(
        p => p.id === accuserId
      );

    if (accuser) {

      accuser.cards.push(
        ...gameState.discardPile
      );
    }

    gameState.discardPile = [];

    this.nextTurn(gameState);

    gameState.lastMove = undefined;

    return false;
  }

  nextTurn(
    gameState: GameState
  ): void {

    gameState.currentPlayerIndex =
      (
        gameState.currentPlayerIndex + 1
      ) %
      gameState.players.length;
  }

  getNextValue(
    currentValue: string
  ): string {

    const index =
      this.values.indexOf(
        currentValue
      );

    return this.values[
      (index + 1) %
      this.values.length
    ];
  }
}