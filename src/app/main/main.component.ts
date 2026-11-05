import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameStateStorageService } from '../game/game-state-storage.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent {
  hasPausedGame = false;
  storageError = '';

  constructor(
    private readonly router: Router,
    gameStateStorage: GameStateStorageService
  ) {
    try {
      this.hasPausedGame = gameStateStorage.load()?.gamePaused === true;
    } catch (error) {
      console.error('Nem sikerült betölteni a mentett játékállapotot.', error);
      this.storageError =
        'A mentett játékállapot nem tölthető be, ezért a parti nem folytatható.';
    }
  }

  startNewGame(): void {
    this.router.navigate(['/game'], { queryParams: { setup: 'true' } });
  }

  resumeGame(): void {
    this.router.navigate(['/game'], { queryParams: { resume: 'true' } });
  }
}
