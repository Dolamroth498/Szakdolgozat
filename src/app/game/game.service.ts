import { Injectable } from '@angular/core';
import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private values = ['VII', 'VIII', 'IX', 'X', 'alsó', 'felső', 'király', 'ász'];
  private suits = ['piros', 'zöld', 'makk', 'tök'];

  generateDeck(type: 'hungarian' | 'french'): Card[] {
    const deck: Card[] = [];
    const suits = type === 'hungarian' ? this.suits : ['hearts', 'diamonds', 'clubs', 'spades'];

    for (const suit of suits) {
      for (const value of this.values) {
        deck.push({ value, suit });
      }
    }
    return deck;
  }

  shuffleDeck(deck: Card[]): Card[] {
    return deck.sort(() => Math.random() - 0.5);
  }

  dealCards(players: Player[], deck: Card[]): GameState {
    const cardsPerPlayer = Math.floor(deck.length / players.length);
    players.forEach((player) => {
      player.cards = deck.splice(0, cardsPerPlayer);
    });

    return {
      players,
      discardPile: [],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
    };
  }

  playCard(player: Player, card: Card, gameState: GameState): boolean {
    if (card.value === gameState.nextCardValue) {
      gameState.discardPile.push(card);
      player.cards = player.cards.filter((c) => c !== card);
      gameState.nextCardValue = this.getNextValue(gameState.nextCardValue);
      return true;
    }
    return false;
  }

  getNextValue(currentValue: string): string {
    const index = this.values.indexOf(currentValue);
    return this.values[(index + 1) % this.values.length];
  }

  callSvindli(gameState: GameState, playerIndex: number): boolean {
    const lastCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (lastCard.value !== gameState.nextCardValue) {
      const offender = gameState.players[gameState.currentPlayerIndex];
      offender.cards.push(...gameState.discardPile);
      gameState.discardPile = [];
      return true;
    } else {
      const accuser = gameState.players[playerIndex];
      accuser.cards.push(...gameState.discardPile);
      gameState.discardPile = [];
      return false;
    }
  }
}
