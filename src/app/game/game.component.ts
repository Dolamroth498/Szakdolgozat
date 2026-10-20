import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { GameService } from './game.service';
import { GameState } from './game.state.model';
import { Card } from './card.model';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent {

  gameState: GameState;

  selectedCards: Card[] = [];

  constructor(
    private gameService: GameService,
    private router: Router
  ) {

    const players = [
      {
        id: '1',
        name: 'Player 1',
        cards: [],
        isAI: false
      },
      {
        id: '2',
        name: 'Player 2',
        cards: [],
        isAI: false
      },
      {
        id: '3',
        name: 'Player 3',
        cards: [],
        isAI: false
      },
      {
        id: '4',
        name: 'Player 4',
        cards: [],
        isAI: false
      }
    ];

    const deck = this.gameService.shuffleDeck(
      this.gameService.generateDeck()
    );

    this.gameState =
      this.gameService.dealCards(
        players,
        deck
      );
  }

  get currentPlayer() {

    return this.gameState.players[
      this.gameState.currentPlayerIndex
    ];
  }

  get winnerName(): string | undefined {
    return this.gameState.players.find(
      player => player.id === this.gameState.winnerId
    )?.name;
  }

  toggleCard(card: Card): void {

    const index =
      this.selectedCards.indexOf(card);

    if (index > -1) {

      this.selectedCards.splice(index, 1);

      return;
    }

    if (this.selectedCards.length >= 4) {
      return;
    }

    this.selectedCards.push(card);
  }

  isSelected(card: Card): boolean {

    return this.selectedCards.includes(card);
  }

  playSelectedCards(): void {

    if (this.selectedCards.length === 0) {

      alert('Válassz legalább 1 lapot!');

      return;
    }

    const success =
      this.gameService.playMove(
        this.currentPlayer.id,
        [...this.selectedCards],
        this.gameState.nextCardValue,
        this.gameState
      );

    if (!success) {

      alert('Hibás lépés');

      return;
    }

    this.selectedCards = [];
  }

  callSvindli(): void {

    const result =
      this.gameService.callSvindli(
        this.currentPlayer.id,
        this.gameState
      );

    if (result) {

      alert('Svindli volt!');

    } else {

      alert('Téves svindli!');
    }
  }

  backToMain(): void {

    this.router.navigateByUrl('main');
  }
}