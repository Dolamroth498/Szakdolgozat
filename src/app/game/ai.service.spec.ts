import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';
import { AiService } from './ai.service';
import {
  createAiBeliefs,
  getLastMoveBluffProbability,
  observeAiMove,
  revealAiMove,
  transferAiDiscardBeliefs,
} from './ai-belief';

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

  it('scores bluff options to preserve a card playable on its next turn', () => {
    const futureCard: Card = { suit: 'piros', value: 'X' };
    const otherCard: Card = { suit: 'zöld', value: 'IX' };
    const player = createPlayer('ai', [futureCard, otherCard]);
    const state = createState(player);

    expect(service.chooseCard(player, 'VII', state)).toBe(otherCard);
  });

  it('keeps a playable final card for its next turn when no challenge changes the round', () => {
    const currentCard: Card = { suit: 'piros', value: 'VII' };
    const futureCard: Card = { suit: 'zöld', value: 'X' };
    const player = createPlayer('ai', [currentCard, futureCard]);
    const state = createState(player);

    expect(service.chooseCard(player, 'VII', state)).toBe(currentCard);
  });

  it('bluffs with a card that preserves the required value for its next turn', () => {
    const futureCard: Card = { suit: 'piros', value: 'X' };
    const otherCard: Card = { suit: 'zöld', value: 'IX' };
    const player = createPlayer('ai', [futureCard, otherCard]);
    const state = createState(player);

    expect(service.chooseCard(player, 'VII', state)).toBe(otherCard);
  });

  it('may bluff now to preserve a card predicted to be legal as the last card', () => {
    const finalCard: Card = { suit: 'piros', value: 'VII' };
    const otherCards: Card[] = [
      { suit: 'zöld', value: 'VIII' },
      { suit: 'makk', value: 'IX' },
      { suit: 'tök', value: 'X' },
      { suit: 'piros', value: 'alsó' },
    ];
    const player = createPlayer('ai', [finalCard, ...otherCards]);
    const state = createState(player);
    state.players = [createPlayer('human'), player];
    state.currentPlayerIndex = 1;
    state.aiDifficulty = 'hard';

    const chosenCard = service.chooseCard(player, 'VII', state);

    expect(chosenCard.value).not.toBe('VII');
    expect(player.cards.filter(card => card !== chosenCard).some(
      card => card.value === 'VII'
    )).toBeTrue();
  });

  it('plays a valid last card because a final-card challenge does not defeat a truthful move', () => {
    const finalCard: Card = { suit: 'piros', value: 'VII' };
    const player = createPlayer('ai', [finalCard]);

    expect(service.chooseCard(player, 'VII')).toBe(finalCard);
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
    expect(service.shouldCallSvindli(ai, state, 'hard')).toBeTrue();
  });

  it('updates card probabilities after a hidden move, reveal, and pile transfer', () => {
    const truthfulCard: Card = { suit: 'piros', value: 'VII' };
    const bluffCard: Card = { suit: 'zöld', value: 'VIII' };
    const knownAiCard: Card = { suit: 'makk', value: 'IX' };
    const observer = createPlayer('ai', [knownAiCard]);
    const opponent = {
      ...createPlayer('opponent', [truthfulCard, bluffCard]),
      isAI: false,
    };
    const beliefs = createAiBeliefs(
      [observer, opponent],
      [truthfulCard, bluffCard, knownAiCard]
    );

    observeAiMove(beliefs, opponent.id, bluffCard, 'VII');

    const belief = beliefs[0];
    expect(getLastMoveBluffProbability(belief, 'VII')).toBeCloseTo(0.2);
    expect(
      belief.cards.reduce(
        (sum, card) =>
          sum +
          card.discardProbability +
          card.locations.reduce(
            (locationSum, location) => locationSum + location.probability,
            0
          ),
        0
      )
    ).toBeCloseTo(belief.cards.length);

    revealAiMove(beliefs, opponent.id, [bluffCard]);
    expect(getLastMoveBluffProbability(belief, 'VII')).toBe(1);
    expect(
      belief.cards.find(card => card.card.value === 'VIII')
        ?.discardProbability
    ).toBe(1);
    expect(
      belief.cards.find(card => card.card.value === 'VII')
        ?.locations.find(location => location.playerId === opponent.id)
        ?.probability
    ).toBe(1);

    transferAiDiscardBeliefs(beliefs, opponent.id);
    expect(
      belief.cards.find(card => card.card.value === 'VIII')
        ?.locations.find(location => location.playerId === opponent.id)
        ?.probability
    ).toBe(1);
    expect(belief.cards.every(card => card.discardProbability === 0)).toBeTrue();
  });

  it('uses the estimated bluff probability with the selected difficulty', () => {
    const truthfulCard: Card = { suit: 'piros', value: 'VII' };
    const bluffCard: Card = { suit: 'zöld', value: 'VIII' };
    const aiCard: Card = { suit: 'makk', value: 'IX' };
    const ai = createPlayer('ai', [aiCard]);
    const opponent = {
      ...createPlayer('opponent', [truthfulCard, bluffCard]),
      isAI: false,
    };
    const beliefs = createAiBeliefs(
      [ai, opponent],
      [truthfulCard, bluffCard, aiCard]
    );
    observeAiMove(beliefs, opponent.id, bluffCard, 'VII');
    opponent.cards = [truthfulCard];

    const state: GameState = {
      players: [ai, opponent],
      discardPile: [bluffCard],
      aiBeliefs: beliefs,
      currentPlayerIndex: 0,
      nextCardValue: 'VIII',
      moveCount: 2,
      lastMove: {
        playerId: opponent.id,
        declaredValue: 'VII',
        cards: [bluffCard],
        count: 1,
        timestamp: Date.now(),
      },
      gameFinished: false,
    };

    expect(service.shouldCallSvindli(ai, state, 'hard')).toBeTrue();
    expect(service.shouldCallSvindli(ai, state, 'medium')).toBeFalse();
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
      players: [createPlayer('human'), ai, createPlayer('other')],
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
