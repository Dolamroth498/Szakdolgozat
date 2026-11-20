import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './auth/auth.service';
import { GameControlService } from './game/game-control.service';
import { GameService } from './game/game.service';
import { GameState } from './game/game.state.model';
import { GameStateStorageService } from './game/game-state-storage.service';
import { UserService } from './user/user.service';

describe('AppComponent error feedback', () => {
  let gameState: GameState | null;
  let authService: jasmine.SpyObj<AuthService>;
  let gameService: jasmine.SpyObj<GameService>;
  let gameStateStorage: jasmine.SpyObj<GameStateStorageService>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    gameState = null;
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['getCurrentUserId', 'logout'],
      { user$: EMPTY }
    );
    gameService = jasmine.createSpyObj<GameService>('GameService', ['forfeitGame']);
    gameService.forfeitGame.and.callFake((_playerId, state) => {
      state.gameFinished = true;
      state.gamePaused = false;
      return true;
    });
    const gameStateSubject = new BehaviorSubject<GameState | null>(null);
    gameStateStorage = jasmine.createSpyObj<GameStateStorageService>(
      'GameStateStorageService',
      ['load', 'save'],
      { gameState$: gameStateSubject.asObservable() }
    );
    gameStateStorage.load.and.callFake(() => gameState);
    userService = jasmine.createSpyObj<UserService>(
      'UserService',
      ['recordGameResult']
    );

    TestBed.configureTestingModule({
      imports: [AppComponent, RouterTestingModule.withRoutes([])],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: GameControlService, useValue: { pauseRequested$: EMPTY, requestPause: jasmine.createSpy() } },
        { provide: GameService, useValue: gameService },
        { provide: GameStateStorageService, useValue: gameStateStorage },
        { provide: UserService, useValue: userService },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows a user-facing error when sign-out fails', async () => {
    authService.logout.and.rejectWith(new Error('offline'));
    spyOn(console, 'error');
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    await fixture.componentInstance.logout();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('A kijelentkezés nem sikerült');
    fixture.destroy();
  });

  it('keeps the paused-game result save error visible after logging out', async () => {
    gameState = {
      players: [
        { id: 'human', name: 'Játékos', cards: [{ suit: 'piros', value: 'VII' }], isAI: false },
        { id: 'ai-1', name: 'AI', cards: [{ suit: 'zöld', value: 'VIII' }], isAI: true },
      ],
      discardPile: [],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gamePaused: true,
      gameFinished: false,
      profileId: 'user-1',
      gameId: 'game-1',
    };
    authService.getCurrentUserId.and.resolveTo('user-1');
    authService.logout.and.resolveTo();
    userService.recordGameResult.and.rejectWith(new Error('offline'));
    spyOn(console, 'error');
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    await fixture.componentInstance.logout();
    fixture.detectChanges();

    expect(gameService.forfeitGame).toHaveBeenCalledWith('human', gameState);
    expect(userService.recordGameResult).toHaveBeenCalledWith(
      'user-1',
      'game-1',
      'loss',
      'computer'
    );
    expect(authService.logout).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('eredmény mentése nem sikerült');
    fixture.destroy();
  });
});
