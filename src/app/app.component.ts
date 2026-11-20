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
import { GameService } from './game/game.service';
import { GameStateStorageService } from './game/game-state-storage.service';
import { GameState } from './game/game.state.model';
import { UserService } from './user/user.service';

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
  appError = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly gameControl: GameControlService,
    private readonly gameService: GameService,
    private readonly gameStateStorage: GameStateStorageService,
    private readonly userService: UserService,
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

    this.appError = '';
    try {
      await this.forfeitPausedGameForCurrentUser();
      await this.authService.logout();
      await this.router.navigateByUrl('/main');
    } catch (error) {
      console.error('Firebase sign-out failed.', error);
      this.appError = 'A kijelentkezés nem sikerült. Próbáld újra.';
    }
  }

  private async forfeitPausedGameForCurrentUser(): Promise<void> {
    const userId = await this.authService.getCurrentUserId();
    const gameState = this.gameStateStorage.load();
    if (
      !gameState ||
      gameState.gameFinished ||
      gameState.gamePaused !== true ||
      gameState.profileId !== userId
    ) {
      return;
    }

    const profilePlayerId = gameState.players.some(player => player.isAI)
      ? 'human'
      : 'human-1';
    if (!this.gameService.forfeitGame(profilePlayerId, gameState)) {
      return;
    }

    this.gameStateStorage.save(gameState);
    if (!gameState.gameId || !gameState.profileId) {
      return;
    }

    try {
      await this.userService.recordGameResult(
        gameState.profileId,
        gameState.gameId,
        'loss',
        gameState.players.some(player => player.isAI) ? 'computer' : 'human'
      );
      gameState.rewardProcessed = true;
      this.gameStateStorage.save(gameState);
    } catch (error) {
      console.error('Nem sikerült rögzíteni a kijelentkezés miatti vereséget.', error);
      this.appError =
        'A parti vereségként lett lezárva, de az eredmény mentése nem sikerült. ' +
        'A játék újbóli megnyitásakor újrapróbálható.';
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
