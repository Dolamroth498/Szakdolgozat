import { PLATFORM_ID } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AiService } from './ai.service';
import { GameComponent } from './game.component';
import { GameService } from './game.service';
import { GameControlService } from './game-control.service';
import { GameState } from './game.state.model';
import { GameStateStorageService } from './game-state-storage.service';
import { UserService } from '../user/user.service';

describe('GameComponent', () => {
  const storageKey = 'svindli-current-game-v1';
  let routeQueryParams: Record<string, string>;
  let userServiceMock: {
    currentUserSnapshot: { id: string } | null;
    getCurrentUserIdWhenReady: jasmine.Spy<() => Promise<string | undefined>>;
    recordAiGameResult: jasmine.Spy;
  };

  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
    routeQueryParams = {};
    userServiceMock = {
      currentUserSnapshot: null,
      getCurrentUserIdWhenReady: jasmine
        .createSpy()
        .and.resolveTo('test-user'),
      recordAiGameResult: jasmine.createSpy().and.resolveTo(true),
    };
    TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [
        GameService,
        AiService,
        GameStateStorageService,
        {
          provide: UserService,
          useValue: userServiceMock,
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (name: string) => routeQueryParams[name] ?? null,
              },
            },
          },
        },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
      ],
    });
  });

  afterEach(() => {
    window.localStorage.removeItem(storageKey);
    TestBed.resetTestingModule();
  });

  it('attaches the loaded profile to a new AI game', fakeAsync(() => {
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    fixture.componentInstance.startNewGame();
    const gameId = fixture.componentInstance.gameState.gameId;
    expect(fixture.componentInstance.gameState.profileId).toBeUndefined();

    flushMicrotasks();

    expect(userServiceMock.getCurrentUserIdWhenReady).toHaveBeenCalled();
    expect(fixture.componentInstance.gameState.profileId).toBe('test-user');
    expect(fixture.componentInstance.gameState.gameId).toBe(gameId);
    fixture.destroy();
  }));

  it('freezes the countdown and blocks moves while paused, then resumes the timer', fakeAsync(() => {
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    fixture.componentInstance.startNewGame();
    flushMicrotasks();
    const component = fixture.componentInstance;
    const originalDeadline = component.gameState.gameDeadline!;

    TestBed.inject(GameControlService).requestPause();
    const remainingSeconds = component.gameSecondsRemaining;
    expect(component.canLeaveGame()).toBeTrue();

    tick(5_000);
    expect(component.gameSecondsRemaining).toBe(remainingSeconds);
    component.toggleCard(component.gameState.players[0].cards[0]);
    expect(component.selectedCards).toEqual([]);

    component.toggleGamePause();
    expect(component.gameState.gameDeadline).toBe(originalDeadline + 5_000);
    expect(component.gameState.gamePaused).toBeFalse();

    fixture.destroy();
    tick(3_000);
  }));

  it('resumes a saved paused game when opened with the resume route parameter', fakeAsync(() => {
    const now = Date.now();
    const pausedState: GameState = {
      players: [
        {
          id: 'human',
          name: 'Te',
          cards: [{ suit: 'piros', value: 'VII' }],
          isAI: false,
        },
      ],
      discardPile: [],
      startedAt: now - 60_000,
      gameDeadline: now - 1_000,
      gamePaused: true,
      pausedAt: now - 5_000,
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(pausedState);
    routeQueryParams['resume'] = 'true';

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.gameState.gamePaused).toBeFalse();
    expect(fixture.componentInstance.gameState.gameDeadline).toBeGreaterThan(Date.now());

    fixture.destroy();
    tick(3_000);
  }));

  it('lets a random AI challenge a human final-card move after five seconds', fakeAsync(() => {
    const now = Date.now();
    const finalCard = { suit: 'piros', value: 'VII' };
    const state: GameState = {
      players: [
        { id: 'human', name: 'Te', cards: [], isAI: false },
        {
          id: 'ai-1',
          name: 'AI ellenfél 1',
          cards: [{ suit: 'zöld', value: 'VIII' }],
          isAI: true,
        },
        {
          id: 'ai-2',
          name: 'AI ellenfél 2',
          cards: [{ suit: 'makk', value: 'IX' }],
          isAI: true,
        },
      ],
      discardPile: [finalCard],
      aiKnownDiscards: [],
      currentPlayerIndex: 1,
      nextCardValue: 'VIII',
      moveCount: 2,
      lastMove: {
        playerId: 'human',
        declaredValue: 'VII',
        cards: [finalCard],
        count: 1,
        timestamp: now,
      },
      pendingWinnerId: 'human',
      challengeDeadline: now + 10_000,
      aiFinalChallengeDeadline: now + 5_000,
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);
    spyOn(Math, 'random').and.returnValue(0.99);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    tick(4_999);
    expect(fixture.componentInstance.gameState.revealDeadline).toBeUndefined();

    tick(1);
    expect(fixture.componentInstance.gameState.pendingChallengerId).toBe('ai-2');
    expect(fixture.componentInstance.gameState.revealDeadline).toBeGreaterThan(now);

    fixture.destroy();
    tick(3_000);
  }));

  it('lets another AI challenge an AI final-card move after five seconds', fakeAsync(() => {
    const now = Date.now();
    const finalCard = { suit: 'piros', value: 'VII' };
    const state: GameState = {
      players: [
        {
          id: 'human',
          name: 'Te',
          cards: [{ suit: 'zöld', value: 'VIII' }],
          isAI: false,
        },
        {
          id: 'ai-1',
          name: 'AI ellenfél 1',
          cards: [finalCard],
          isAI: true,
        },
        {
          id: 'ai-2',
          name: 'AI ellenfél 2',
          cards: [{ suit: 'makk', value: 'IX' }],
          isAI: true,
        },
      ],
      discardPile: [],
      aiKnownDiscards: [],
      currentPlayerIndex: 1,
      nextCardValue: 'VII',
      moveCount: 2,
      gameFinished: false,
    };
    const gameService = TestBed.inject(GameService);
    expect(gameService.playMove('ai-1', [finalCard], 'VII', state)).toBeTrue();
    expect(state.pendingWinnerId).toBe('ai-1');
    expect(state.players[1].cards).toEqual([]);
    expect(state.aiFinalChallengeDeadline).toBeGreaterThanOrEqual(now + 5_000);
    expect(state.aiFinalChallengeDeadline).toBeLessThanOrEqual(now + 5_001);

    TestBed.inject(GameStateStorageService).save(state);
    spyOn(Math, 'random').and.returnValue(0);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    tick(4_999);
    expect(fixture.componentInstance.gameState.revealDeadline).toBeUndefined();

    tick(1);
    expect(fixture.componentInstance.gameState.pendingChallengerId).toBe('ai-2');
    expect(fixture.componentInstance.gameState.revealDeadline).toBeGreaterThan(now);

    fixture.destroy();
    tick(3_000);
  }));
});
