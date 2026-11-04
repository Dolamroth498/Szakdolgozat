import { Component, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { GameControlService } from './game/game-control.service';
import { GameStateStorageService } from './game/game-state-storage.service';
import { GameState } from './game/game.state.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  readonly user$: AuthService['user$'];
  gameNavigationLocked = false;
  isGamePage = false;
  navigationStateError = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly gameControl: GameControlService,
    private readonly gameStateStorage: GameStateStorageService,
    destroyRef: DestroyRef,
  ) {
    this.user$ = this.authService.user$;
    this.isGamePage = this.router.url.startsWith('/game');
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(event => {
        this.isGamePage = event.urlAfterRedirects.startsWith('/game');
      });

    this.gameStateStorage.gameState$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(state => {
        this.updateNavigationLock(state);
        this.navigationStateError = '';
      });

    try {
      this.updateNavigationLock(this.gameStateStorage.load());
    } catch (error) {
      console.error('Nem sikerült betölteni a mentett játékállapotot.', error);
      this.gameNavigationLocked = true;
      this.navigationStateError =
        'A mentett játék állapotát nem lehet ellenőrizni; a menü ideiglenesen le van tiltva.';
    }
  }

  async logout(): Promise<void> {
    if (this.gameNavigationLocked) {
      return;
    }

    try {
      await this.authService.logout();
      await this.router.navigateByUrl('/main');
    } catch (error) {
      console.error('Firebase sign-out failed.', error);
      alert('A kijelentkezés nem sikerült. Próbáld újra.');
    }
  }

  pauseGame(): void {
    if (this.gameNavigationLocked && this.isGamePage) {
      this.gameControl.requestPause();
    }
  }

  private updateNavigationLock(gameState: GameState | null): void {
    this.gameNavigationLocked =
      gameState !== null &&
      !gameState.gameFinished &&
      gameState.gamePaused !== true;
  }
}
