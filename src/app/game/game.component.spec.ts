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
  const pinStorageKey = 'svindli-local-player-pins-v1';
  let routeQueryParams: Record<string, string>;
  let userServiceMock: {
    currentUserSnapshot: { id: string; name: string } | null;
    getCurrentUserIdWhenReady: jasmine.Spy<() => Promise<string | undefined>>;
    recordAiGameResult: jasmine.Spy;
    recordGameResult: jasmine.Spy;
  };

  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(pinStorageKey);
    routeQueryParams = {};
    userServiceMock = {
      currentUserSnapshot: null,
      getCurrentUserIdWhenReady: jasmine
        .createSpy()
        .and.resolveTo('test-user'),
      recordAiGameResult: jasmine.createSpy().and.resolveTo(true),
      recordGameResult: jasmine.createSpy().and.resolveTo(true),
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
    window.localStorage.removeItem(pinStorageKey);
    TestBed.resetTestingModule();
  });

  it('maps card values and suits to their positions in the card sprite', () => {
    const component = TestBed.createComponent(GameComponent).componentInstance;

    expect(component.cardSpritePosition({ value: 'VII', suit: 'piros' }))
      .toBe('87.8% 66%');
    expect(component.cardSpritePosition({ value: 'ász', suit: 'tök' }))
      .toBe('12.2% 98%');
  });

  it('renders the discard pile back as a full-size sprite card', fakeAsync(() => {
    const state: GameState = {
      players: [
        { id: 'human', name: 'Te', cards: [{ suit: 'piros', value: 'VII' }], isAI: false },
        { id: 'ai', name: 'AI', cards: [{ suit: 'zöld', value: 'VIII' }], isAI: true },
      ],
      discardPile: [{ suit: 'piros', value: 'VIII' }],
      currentPlayerIndex: 0,
      nextCardValue: 'IX',
      lastMove: {
        playerId: 'ai',
        declaredValue: 'VIII',
        cards: [{ suit: 'piros', value: 'VIII' }],
        count: 1,
        timestamp: Date.now(),
      },
      moveCount: 2,
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    const pile = fixture.nativeElement.querySelector(
      '.last-played-card.card-back-pile'
    ) as HTMLElement | null;
    expect(pile).not.toBeNull();
    expect(pile?.querySelector('.card-back.cardback-back-red')).not.toBeNull();

    fixture.destroy();
    tick(1_000);
  }));

  it('lets the human challenge an opponent while an AI is next', fakeAsync(() => {
    const now = Date.now();
    const state: GameState = {
      players: [
        { id: 'human', name: 'Te', cards: [{ suit: 'zöld', value: 'VII' }], isAI: false },
        { id: 'ai-1', name: 'AI 1', cards: [{ suit: 'piros', value: 'VIII' }], isAI: true },
        { id: 'ai-2', name: 'AI 2', cards: [{ suit: 'makk', value: 'IX' }], isAI: true },
      ],
      discardPile: [{ suit: 'piros', value: 'VIII' }],
      currentPlayerIndex: 2,
      nextCardValue: 'IX',
      lastMove: {
        playerId: 'ai-1',
        declaredValue: 'VII',
        cards: [{ suit: 'piros', value: 'VIII' }],
        count: 1,
        timestamp: now,
      },
      moveCount: 2,
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.currentPlayer.isAI).toBeTrue();
    const challengeButton = fixture.nativeElement.querySelector(
      '.challenge-button'
    ) as HTMLButtonElement | null;
    expect(challengeButton).not.toBeNull();
    challengeButton?.click();

    expect(fixture.componentInstance.gameState.pendingChallengerId).toBe('human');
    expect(fixture.componentInstance.gameState.revealDeadline).toBeDefined();

    fixture.destroy();
    tick(1_000);
  }));

  it('pauses game progress until the challenge result dialog is dismissed', fakeAsync(() => {
    const now = Date.now();
    const state: GameState = {
      players: [
        { id: 'human', name: 'Te', cards: [{ suit: 'tök', value: 'VII' }], isAI: false },
        { id: 'ai-1', name: 'AI 1', cards: [{ suit: 'piros', value: 'VIII' }], isAI: true },
        { id: 'ai-2', name: 'AI 2', cards: [{ suit: 'makk', value: 'IX' }], isAI: true },
      ],
      discardPile: [{ suit: 'piros', value: 'VIII' }],
      currentPlayerIndex: 2,
      nextCardValue: 'IX',
      lastMove: {
        playerId: 'ai-1',
        declaredValue: 'VII',
        cards: [{ suit: 'piros', value: 'VIII' }],
        count: 1,
        timestamp: now,
      },
      moveCount: 2,
      revealDeadline: now + 1_000,
      challengeRevealStartedAt: now,
      pendingChallengerId: 'human',
      pendingBluffDetected: true,
      gameDeadline: now + 60_000,
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    tick(1_000);
    fixture.detectChanges();
    expect(component.challengeResultMessage).toContain('Sikeres leleplezés');
    const deadlineAtResult = component.gameState.gameDeadline!;
    const currentPlayerAtResult = component.gameState.currentPlayerIndex;

    tick(5_000);
    expect(component.gameState.gameDeadline).toBe(deadlineAtResult);
    expect(component.gameState.currentPlayerIndex).toBe(currentPlayerAtResult);

    component.dismissChallengeResult();
    expect(component.gameState.gameDeadline).toBeGreaterThan(deadlineAtResult);
    tick(3_000);
    expect(component.gameState.currentPlayerIndex).not.toBe(currentPlayerAtResult);

    fixture.destroy();
  }));

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

  it('does not open new-game setup while an unpaused game is active', fakeAsync(() => {
    const now = Date.now();
    const existingGame: GameState = {
      players: [
        {
          id: 'human',
          name: 'Te',
          cards: [{ suit: 'piros', value: 'VII' }],
          isAI: false,
        },
      ],
      discardPile: [],
      startedAt: now,
      gameDeadline: now + 15 * 60 * 1000,
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(existingGame);
    routeQueryParams['setup'] = 'true';

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.showGameSetup).toBeFalse();
    expect(fixture.componentInstance.gameState.players).toEqual(
      existingGame.players
    );
    expect(fixture.componentInstance.gameState.gameFinished).toBeFalse();

    fixture.destroy();
    tick(3_000);
  }));

  it('chooses a random starting player for a new AI game', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValue(0.99);
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    fixture.componentInstance.startNewGame();
    flushMicrotasks();

    expect(fixture.componentInstance.gameState.currentPlayerIndex).toBe(2);
    expect(fixture.componentInstance.currentPlayer.isAI).toBeTrue();

    fixture.destroy();
    tick(3_000);
  }));

  it('creates a PIN-protected local lobby and pauses timers until the next player unlocks', async () => {
    userServiceMock.currentUserSnapshot = {
      id: 'signed-in-user',
      name: 'Bejelentkezett',
    };
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectGameMode('human');
    component.selectHumanPlayerCount(3);
    component.beginLocalLobby();
    expect(component.localLobbyPhase).toBe('credentials');
    component.localLobbyPlayerPin = '1234';
    await component.saveLocalLobbyPlayer();
    expect(component.localLobbyPlayerIndex).toBe(1);

    for (const name of ['Bence', 'Csilla']) {
      component.localLobbyPlayerName = name;
      component.localLobbyPlayerPin = '1234';
      await component.saveLocalLobbyPlayer();
    }

    expect(component.gameState.players.length).toBe(3);
    expect(component.gameState.players.map(player => player.name)).toEqual([
      'Bejelentkezett',
      'Bence',
      'Csilla',
    ]);
    expect(component.gameState.profileId).toBe('signed-in-user');
    expect(component.showTurnPinDialog).toBeTrue();

    component.turnPinInput = '0000';
    await component.unlockCurrentTurn();
    expect(component.turnPinError).toContain('nem megfelelő');

    component.turnPinInput = '1234';
    await component.unlockCurrentTurn();
    expect(component.isLocalTurnLocked).toBeFalse();

    component.selectedCards = [component.currentPlayer.cards[0]];
    const deadlineBeforeHandoff = component.gameState.gameDeadline;
    component.playSelectedCards();
    expect(component.isLocalTurnLocked).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-table')).toBeNull();

    await new Promise(resolve => setTimeout(resolve, 20));
    expect(component.gameState.gameDeadline).toBe(deadlineBeforeHandoff);

    component.turnPinInput = '1234';
    await component.unlockCurrentTurn();
    expect(component.isLocalTurnLocked).toBeFalse();
    expect(component.gameState.gameDeadline).toBeGreaterThan(deadlineBeforeHandoff!);

    fixture.destroy();
  });

  it('requires a signed-in profile to create a local human lobby', () => {
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.beginLocalLobby();

    expect(component.localLobbyPhase).toBe('count');
    expect(component.localLobbyError).toContain('jelentkezz be');

    fixture.destroy();
  });

  it('records a local human-game result for the signed-in first player', fakeAsync(() => {
    const finishedGame: GameState = {
      players: [
        { id: 'human-1', name: 'Signed in', cards: [], isAI: false },
        { id: 'human-2', name: 'Opponent 1', cards: [], isAI: false },
        { id: 'human-3', name: 'Opponent 2', cards: [], isAI: false },
      ],
      discardPile: [],
      gameId: 'local-game-result',
      profileId: 'signed-in-user',
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: true,
      winnerId: 'human-1',
    };
    TestBed.inject(GameStateStorageService).save(finishedGame);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    flushMicrotasks();

    expect(userServiceMock.recordGameResult).toHaveBeenCalledWith(
      'signed-in-user',
      'local-game-result',
      'win',
      'human'
    );

    fixture.destroy();
    tick(1_000);
  }));

  it('keeps the human player at the bottom with visible cards during AI turns', fakeAsync(() => {
    const state: GameState = {
      players: [
        {
          id: 'human',
          name: 'Te',
          cards: [{ suit: 'piros', value: 'VII' }],
          isAI: false,
        },
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
      discardPile: [],
      currentPlayerIndex: 1,
      nextCardValue: 'VII',
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    const humanCards = fixture.nativeElement.querySelectorAll(
      '.player-bottom .playing-card'
    ) as NodeListOf<HTMLElement>;
    expect(humanCards.length).toBe(1);
    expect(humanCards[0].textContent).toContain('VII');

    const positionsBeforeTurnChange = state.players.map((_, index) =>
      fixture.componentInstance.playerPosition(index)
    );
    fixture.componentInstance.gameState.currentPlayerIndex = 2;
    expect(
      state.players.map((_, index) =>
        fixture.componentInstance.playerPosition(index)
      )
    ).toEqual(positionsBeforeTurnChange);

    fixture.destroy();
    tick(3_000);
  }));

  it('keeps the current local player at the bottom and hides all cards while paused', fakeAsync(() => {
    const state: GameState = {
      players: [
        { id: 'human-1', name: 'Anna', cards: [{ suit: 'piros', value: 'VII' }], isAI: false },
        { id: 'human-2', name: 'Bence', cards: [{ suit: 'zöld', value: 'VIII' }], isAI: false },
        { id: 'human-3', name: 'Csilla', cards: [{ suit: 'makk', value: 'IX' }], isAI: false },
      ],
      discardPile: [],
      currentPlayerIndex: 1,
      nextCardValue: 'VII',
      gamePaused: true,
      pausedAt: Date.now(),
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.playerPosition(1)).toBe('player-bottom');
    expect(component.playerPosition(0)).toBe('player-top-right');
    expect(component.playerPosition(2)).toBe('player-top-left');
    expect(fixture.nativeElement.querySelectorAll('.playing-card').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.player-cards').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.card-backs').length).toBe(3);

    const pauseDialog = fixture.nativeElement.querySelector(
      '.pause-overlay .pause-dialog'
    ) as HTMLElement | null;
    expect(pauseDialog).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.game-table')).not.toBeNull();

    fixture.destroy();
    tick(1_000);
  }));

  it('sizes the bottom hand panel based on the player card count', fakeAsync(() => {
    const cardValues = ['VII', 'VIII', 'IX', 'X', 'alsó', 'felső', 'király', 'ász'];
    const state: GameState = {
      players: [
        {
          id: 'human',
          name: 'Te',
          cards: cardValues.map(value => ({
            suit: 'piros',
            value,
          })),
          isAI: false,
        },
        { id: 'ai-1', name: 'AI 1', cards: [], isAI: true },
        { id: 'ai-2', name: 'AI 2', cards: [], isAI: true },
      ],
      discardPile: [],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    const hand = fixture.nativeElement.querySelector(
      '.player-bottom'
    ) as HTMLElement;
    expect(hand.style.getPropertyValue('--hand-width')).toBe('21.4rem');

    fixture.componentInstance.gameState.players[0].cards.pop();
    fixture.detectChanges();
    expect(hand.style.getPropertyValue('--hand-width')).toBe('19.05rem');

    fixture.destroy();
    tick(1_000);
  }));

  it('announces the winner in a result dialog when the game is finished', fakeAsync(() => {
    const finishedGame: GameState = {
      players: [
        {
          id: 'human',
          name: 'Te (Játékos 1)',
          cards: [],
          isAI: false,
        },
      ],
      discardPile: [{ suit: 'piros', value: 'VII' }],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: true,
      winnerId: 'human',
    };
    TestBed.inject(GameStateStorageService).save(finishedGame);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    const resultDialog = fixture.nativeElement.querySelector(
      '[role="dialog"][aria-labelledby="game-result-title"]'
    ) as HTMLElement | null;
    expect(resultDialog).not.toBeNull();
    expect(resultDialog?.textContent).toContain('Győztes: Te (Játékos 1)');

    fixture.destroy();
    tick(3_000);
  }));

  it('clears a completed game when opening setup so it cannot return after navigation', fakeAsync(() => {
    const finishedGame: GameState = {
      players: [
        { id: 'human', name: 'Te', cards: [], isAI: false },
      ],
      discardPile: [{ suit: 'piros', value: 'VII' }],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      gameFinished: true,
      winnerId: 'human',
    };
    TestBed.inject(GameStateStorageService).save(finishedGame);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    fixture.componentInstance.openGameSetup();

    expect(fixture.componentInstance.showGameSetup).toBeTrue();
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    fixture.destroy();

    const returnedFixture = TestBed.createComponent(GameComponent);
    returnedFixture.detectChanges();
    expect(returnedFixture.componentInstance.showGameSetup).toBeTrue();
    expect(returnedFixture.componentInstance.gameState).toBeUndefined();
    returnedFixture.destroy();
    tick(1_000);
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

  it('pauses the main game timer while the challenged card is revealed', fakeAsync(() => {
    const now = Date.now();
    const card = { suit: 'piros', value: 'VII' };
    const state: GameState = {
      players: [
        { id: 'human', name: 'Te', cards: [{ suit: 'zöld', value: 'VIII' }], isAI: false },
        { id: 'ai-1', name: 'AI ellenfél 1', cards: [{ suit: 'makk', value: 'IX' }], isAI: true },
        { id: 'ai-2', name: 'AI ellenfél 2', cards: [{ suit: 'tök', value: 'X' }], isAI: true },
      ],
      discardPile: [card],
      currentPlayerIndex: 1,
      nextCardValue: 'VIII',
      moveCount: 2,
      lastMove: {
        playerId: 'human',
        declaredValue: 'VII',
        cards: [card],
        count: 1,
        timestamp: now,
      },
      gameDeadline: now + 15 * 60 * 1000,
      gameFinished: false,
    };
    TestBed.inject(GameStateStorageService).save(state);

    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const initialDeadline = component.gameState.gameDeadline!;

    component.callSvindli('ai-1');
    expect(component.gameState.challengeRevealStartedAt).toBeDefined();

    tick(3_000);

    expect(component.gameState.revealDeadline).toBeUndefined();
    expect(component.gameState.gameDeadline).toBeGreaterThan(initialDeadline);
    expect(component.gameState.gameDeadline! - initialDeadline).toBeGreaterThanOrEqual(2_750);

    fixture.destroy();
    tick(1_000);
  }));
});
