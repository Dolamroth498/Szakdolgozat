import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss'],
})
export class LeaderboardComponent {
  constructor( private router: Router){}
  players = [
    { name: 'Player 1', score: 150 },
    { name: 'Player 2', score: 120 },
    { name: 'Player 3', score: 100 },
    { name: 'Player 4', score: 90 },
    { name: 'Player 5', score: 80 },
  ];

  // Sorting logic (optional, if scores change dynamically)
  get sortedPlayers() {
    return this.players.sort((a, b) => b.score - a.score);
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}
