import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GameState } from './game.state.model';
import { GameStateStorageService } from './game-state-storage.service';

describe('GameStateStorageService', () => {
  const storageKey = 'svindli-current-game-v1';
  let storage: GameStateStorageService;

  const gameState: GameState = {
    players: [
      {
        id: 'player-1',
        name: 'Player 1',
        cards: [{ suit: 'piros', value: 'VII' }],
        isAI: false,
      },
    ],
    discardPile: [{ suit: 'zöld', value: 'VIII' }],
    currentPlayerIndex: 0,
    nextCardValue: 'VIII',
    gameFinished: false,
  };

  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
    TestBed.configureTestingModule({
      providers: [
        GameStateStorageService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    storage = TestBed.inject(GameStateStorageService);
  });

  afterEach(() => {
    window.localStorage.removeItem(storageKey);
  });

  it('restores the saved state rather than creating a different game', () => {
    storage.save(gameState);

    expect(storage.load()).toEqual({ ...gameState, moveCount: 0 });
  });

  it('publishes saved and restored states to subscribers', () => {
    const emittedStates: Array<GameState | null> = [];
    storage.gameState$.subscribe(state => emittedStates.push(state));

    storage.save(gameState);
    storage.load();

    expect(emittedStates).toEqual([
      null,
      gameState,
      { ...gameState, moveCount: 0 },
    ]);
  });

  it('restores the final-card challenge deadline', () => {
    const pendingGameState: GameState = {
      ...gameState,
      moveCount: 4,
      pendingWinnerId: 'player-1',
      challengeDeadline: Date.now() + 10_000,
      aiFinalChallengeDeadline: Date.now() + 5_000,
    };

    storage.save(pendingGameState);

    expect(storage.load()).toEqual(pendingGameState);
  });

  it('restores the number of rounds started', () => {
    const stateWithStartedRounds: GameState = {
      ...gameState,
      roundsStarted: 3,
    };

    storage.save(stateWithStartedRounds);

    expect(storage.load()).toEqual({
      ...stateWithStartedRounds,
      moveCount: 0,
    });
  });

  it('restores bluff and successful challenge counters', () => {
    const stateWithBluffStats: GameState = {
      ...gameState,
      successfulBluffCount: 2,
      successfulSvindliCount: 1,
    };

    storage.save(stateWithBluffStats);

    expect(storage.load()).toEqual({
      ...stateWithBluffStats,
      moveCount: 0,
    });
  });

  it('restores a challenge while the played card is being revealed', () => {
    const revealGameState: GameState = {
      ...gameState,
      players: [
        ...gameState.players,
        {
          id: 'player-2',
          name: 'Player 2',
          cards: [],
          isAI: false,
        },
      ],
      moveCount: 3,
      lastMove: {
        playerId: 'player-1',
        declaredValue: 'VIII',
        cards: [{ suit: 'zöld', value: 'VIII' }],
        count: 1,
        timestamp: Date.now(),
      },
      revealDeadline: Date.now() + 3_000,
      pendingChallengerId: 'player-2',
      pendingBluffDetected: false,
    };

    storage.save(revealGameState);

    expect(storage.load()).toEqual(revealGameState);
  });

  it('restores a paused game with its paused timestamp', () => {
    const pausedGameState: GameState = {
      ...gameState,
      gamePaused: true,
      pausedAt: Date.now(),
    };

    storage.save(pausedGameState);

    expect(storage.load()).toEqual({
      ...pausedGameState,
      moveCount: 0,
    });
  });

  it('recovers the latest AI-played card from a saved game without AI memory', () => {
    const savedState: GameState = {
      ...gameState,
      players: [
        { id: 'human', name: 'Te', cards: [], isAI: false },
        { id: 'ai-1', name: 'AI ellenfél', cards: [], isAI: true },
      ],
      moveCount: 2,
      lastMove: {
        playerId: 'ai-1',
        declaredValue: 'VII',
        cards: [{ suit: 'makk', value: 'VIII' }],
        count: 1,
        timestamp: Date.now(),
      },
    };

    storage.save(savedState);

    expect(storage.load()?.aiKnownDiscards).toEqual([
      {
        playerId: 'ai-1',
        cards: [{ suit: 'makk', value: 'VIII' }],
      },
    ]);
  });

  it('returns null when no game has been saved yet', () => {
    expect(storage.load()).toBeNull();
  });

  it('reports malformed saved state instead of silently replacing it', () => {
    window.localStorage.setItem(storageKey, '{invalid json');

    expect(() => storage.load()).toThrow();
  });

  it('does not access browser storage during server rendering', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        GameStateStorageService,
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const serverStorage = TestBed.inject(GameStateStorageService);

    expect(serverStorage.load()).toBeNull();
    expect(() => serverStorage.save(gameState)).not.toThrow();
  });
});
