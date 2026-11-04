import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    service = new AiService();
  });

  function createPlayer(id: string, cards: Card[] = []): Player {
    return { id, name: `Player ${id}`, cards, isAI: id !== 'human' };
  }

  it('plays the required card truthfully when one is in its hand', () => {
    const requiredCard: Card = { suit: 'piros', value: 'VII' };
    const player = createPlayer('ai', [
      { suit: 'zöld', value: 'VIII' },
      requiredCard,
    ]);

    expect(service.chooseCard(player, 'VII')).toBe(requiredCard);
  });

  it('chooses a bluff card from its own hand without consulting discard contents', () => {
    const firstCard: Card = { suit: 'piros', value: 'VII' };
    const player = createPlayer('ai', [
      firstCard,
      { suit: 'zöld', value: 'VIII' },
    ]);

    expect(service.chooseCard(player, 'IX')).toBe(firstCard);
  });

  it('always challenges when the claimed value is impossible', () => {
    const ai = createPlayer('ai', [
      { suit: 'piros', value: 'VII' },
      { suit: 'zöld', value: 'VII' },
      { suit: 'makk', value: 'VII' },
      { suit: 'tök', value: 'VII' },
    ]);
    const state = createState(ai);
    setLastMove(state, { suit: 'piros', value: 'ász' });

    expect(service.shouldCallSvindli(ai, state, 'easy')).toBeTrue();
  });

  it('uses the selected difficulty threshold for uncertain challenges', () => {
    const ai = createPlayer('ai', [
      { suit: 'piros', value: 'VII' },
      { suit: 'zöld', value: 'VII' },
      { suit: 'makk', value: 'VII' },
    ]);
    const state = createState(ai);
    state.players[0].cards = [{ suit: 'tök', value: 'X' }];
    setLastMove(state, { suit: 'piros', value: 'ász' });

    expect(service.shouldCallSvindli(ai, state, 'easy')).toBeFalse();
    expect(service.shouldCallSvindli(ai, state, 'medium')).toBeTrue();
  });

  it('randomly selects an AI challenger other than the player who played last', () => {
    const players = [
      createPlayer('human'),
      createPlayer('ai-1'),
      createPlayer('ai-2'),
      createPlayer('ai-3'),
    ];
    spyOn(Math, 'random').and.returnValue(0.99);

    expect(service.chooseRandomChallenger(players, 'human')?.id).toBe('ai-3');
    expect(service.chooseRandomChallenger(players, 'ai-1')?.id).toBe('ai-3');
  });

  it('does not select the final-card player or choose a challenger if none are eligible', () => {
    const players = [createPlayer('human'), createPlayer('ai-1')];

    expect(service.chooseRandomChallenger(players, 'ai-1')).toBeUndefined();
    expect(service.chooseRandomChallenger([players[0]], 'someone-else'))
      .toBeUndefined();
  });

  it('uses the actual values of its previously played cards when challenging', () => {
    const ai = createPlayer('ai', [
      { suit: 'piros', value: 'VII' },
      { suit: 'zöld', value: 'VII' },
    ]);
    const state = createState(ai);
    state.players[0].cards = [
      { suit: 'tök', value: 'X' },
      { suit: 'makk', value: 'X' },
      { suit: 'piros', value: 'X' },
      { suit: 'zöld', value: 'X' },
    ];
    setLastMove(state, { suit: 'piros', value: 'ász' });
    state.aiKnownDiscards = [
      { playerId: 'ai', cards: [{ suit: 'makk', value: 'VII' }] },
    ];

    expect(service.shouldCallSvindli(ai, state)).toBeTrue();
  });

  it('does not mistake the declared value for the actual value of a remembered card', () => {
    const ai = createPlayer('ai', [
      { suit: 'piros', value: 'VII' },
      { suit: 'zöld', value: 'VII' },
    ]);
    const state = createState(ai);
    state.players[0].cards = [
      { suit: 'tök', value: 'X' },
      { suit: 'makk', value: 'X' },
      { suit: 'piros', value: 'X' },
    ];
    setLastMove(state, { suit: 'piros', value: 'IX' });
    state.aiKnownDiscards = [
      { playerId: 'ai', cards: [{ suit: 'makk', value: 'IX' }] },
    ];

    expect(service.shouldCallSvindli(ai, state)).toBeFalse();
  });

  it('does not use another AI opponent’s remembered cards', () => {
    const ai = createPlayer('ai', [
      { suit: 'piros', value: 'VII' },
      { suit: 'zöld', value: 'VII' },
    ]);
    const state = createState(ai);
    state.players[0].cards = [
      { suit: 'tök', value: 'X' },
      { suit: 'makk', value: 'X' },
      { suit: 'piros', value: 'X' },
    ];
    setLastMove(state, { suit: 'piros', value: 'IX' });
    state.aiKnownDiscards = [
      { playerId: 'ai-2', cards: [{ suit: 'makk', value: 'IX' }] },
    ];

    expect(service.shouldCallSvindli(ai, state)).toBeFalse();
  });

  it('never challenges its own move or the first card of a game', () => {
    const ai = createPlayer('ai');
    const state = createState(ai);
    setLastMove(state, { suit: 'piros', value: 'ász' });

    expect(service.shouldCallSvindli(ai, state)).toBeFalse();

    state.lastMove!.playerId = 'ai';
    state.moveCount = 2;
    expect(service.shouldCallSvindli(ai, state)).toBeFalse();
  });

  function createState(ai: Player): GameState {
    return {
      players: [createPlayer('human'), ai],
      discardPile: [],
      currentPlayerIndex: 1,
      nextCardValue: 'VII',
      moveCount: 2,
      gameFinished: false,
    };
  }

  function setLastMove(state: GameState, card: Card): void {
    state.lastMove = {
      playerId: 'human',
      declaredValue: 'VII',
      cards: [card],
      count: 1,
      timestamp: Date.now(),
    };
    state.discardPile = [card];
  }
});
