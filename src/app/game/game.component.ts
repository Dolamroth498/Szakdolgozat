import { Component } from '@angular/core';
import { GameService } from './game.service';
import { GameState } from './game.state.model';
import { Card } from './card.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent {
  gameState: GameState;

  constructor(private gameService: GameService, private router: Router) {
    const players = [
      { id: '1', name: 'Player 1', cards: [], isAI: false },
      { id: '2', name: 'Player 2', cards: [], isAI: false },
      { id: '3', name: 'Player 3', cards: [], isAI: false },
      { id: '4', name: 'Player 4', cards: [], isAI: false },
    ];
    const deck = this.gameService.shuffleDeck(this.gameService.generateDeck('hungarian'));
    this.gameState = this.gameService.dealCards(players, deck);
  }

  playCard(card: Card) {
    const success = this.gameService.playCard(
      this.gameState.players[this.gameState.currentPlayerIndex],
      card,
      this.gameState
    );
    if (success) {
      // Haladjon a játék tovább
    } else {
      alert('Nem megfelelő kártya!');
    }
  }

  callSvindli() {
    const result = this.gameService.callSvindli(this.gameState, this.gameState.currentPlayerIndex);
    if (result) {
      alert('Svindli volt!');
    } else {
      alert('Téves svindli!');
    }
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}
