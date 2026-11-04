import { Card } from './card.model';
import { GameState } from './game.state.model';
import { Player } from './game.player.model';
import { GameService } from './game.service';

describe('GameService', () => {
  let service: GameService;

  beforeEach(() => {
    service = new GameService();
  });

  function createPlayer(id: string, cards: Card[] = []): Player {
    return { id, name: `Player ${id}`, cards, isAI: false };
  }

  function createState(firstPlayerCards: Card[] = []): GameState {
    return {
      players: [
        createPlayer('1', firstPlayerCards),
        createPlayer('2'),
        createPlayer('3'),
      ],
      discardPile: [],
      currentPlayerIndex: 0,
      nextCardValue: 'VII',
      moveCount: 1,
      gameFinished: false,
    };
  }

  it('creates a 32-card deck with unique suit and value combinations', () => {
    const deck = service.generateDeck();

    expect(deck.length).toBe(32);
    expect(new Set(deck.map(card => `${card.value}-${card.suit}`)).size).toBe(32);
  });

  it('shuffles without changing the source deck or losing cards', () => {
    const deck = service.generateDeck();
    const shuffled = service.shuffleDeck(deck);

    expect(shuffled).not.toBe(deck);
    expect(deck.length).toBe(32);
    expect(shuffled.map(card => `${card.value}-${card.suit}`).sort()).toEqual(
      deck.map(card => `${card.value}-${card.suit}`).sort()
    );
  });

  it('deals every card as evenly as possible without mutating its inputs', () => {
    const deck = service.generateDeck();
    const players = [
      createPlayer('1'),
      createPlayer('2'),
      createPlayer('3'),
    ];
    const state = service.dealCards(players, deck);

    expect(state.players.map(player => player.cards.length)).toEqual([11, 11, 10]);
    expect(state.players.flatMap(player => player.cards).length).toBe(32);
    expect(deck.length).toBe(32);
    expect(players.every(player => player.cards.length === 0)).toBeTrue();
    expect(state.gameDeadline).toBe(state.startedAt! + 15 * 60 * 1000);
    expect(state.gameId).toBeTruthy();
  });

  it('rejects dealing when there are no players', () => {
    expect(() => service.dealCards([], service.generateDeck())).toThrowError(
      RangeError
    );
  });

  it('rejects a move from a player whose turn it is not', () => {
    const card: Card = { suit: 'piros', value: 'VII' };
    const state = createState([card]);

    expect(service.playMove('2', [card], 'VII', state)).toBeFalse();
    expect(state.players[0].cards).toEqual([card]);
    expect(state.discardPile).toEqual([]);
  });

  it('rejects moves and timeout completion while the game is paused', () => {
    const card: Card = { suit: 'piros', value: 'VII' };
    const state = createState([card]);
    state.gamePaused = true;
    state.pausedAt = Date.now();
    state.gameDeadline = 0;

    expect(service.playMove('1', [card], 'VII', state)).toBeFalse();
    expect(service.finishByTime(state, Date.now())).toBeFalse();
    expect(state.players[0].cards).toEqual([card]);
    expect(state.discardPile).toEqual([]);
    expect(state.gameFinished).toBeFalse();
  });

  it('rejects duplicate or invalid cards without changing the game state', () => {
    const card: Card = { suit: 'piros', value: 'VII' };
    const secondCard: Card = { suit: 'zöld', value: 'VIII' };
    const state = createState([card, secondCard]);

    expect(service.playMove('1', [card, card], 'VII', state)).toBeFalse();
    expect(service.playMove('1', [card, secondCard], 'VII', state)).toBeFalse();
    expect(service.playMove('1', [{ suit: 'zöld', value: 'VII' }], 'VII', state))
      .toBeFalse();
    expect(state.players[0].cards).toEqual([card, secondCard]);
    expect(state.discardPile).toEqual([]);
  });

  it('advances the turn and declared value after a valid move', () => {
    const playedCard: Card = { suit: 'piros', value: 'VII' };
    const heldCard: Card = { suit: 'zöld', value: 'VIII' };
    const state = createState([playedCard, heldCard]);

    expect(service.playMove('1', [playedCard], 'VII', state)).toBeTrue();
    expect(state.players[0].cards).toEqual([heldCard]);
    expect(state.discardPile).toEqual([playedCard]);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.nextCardValue).toBe('VIII');
    expect(state.lastMove?.count).toBe(1);
  });

  it('remembers the actual value of AI cards still in the discard pile', () => {
    const aiCard: Card = { suit: 'makk', value: 'VIII' };
    const ai = { ...createPlayer('1', [aiCard]), isAI: true };
    const state = createState([aiCard]);
    state.players[0] = ai;

    expect(service.playMove('1', [aiCard], 'VII', state)).toBeTrue();
    expect(state.aiKnownDiscards).toEqual([
      { playerId: '1', cards: [aiCard] },
    ]);
    expect(state.lastMove?.declaredValue).toBe('VII');
    expect(state.aiKnownDiscards?.[0].cards[0].value).toBe('VIII');
  });

  it('ends the game when a player plays their last card', () => {
    const lastCard: Card = { suit: 'piros', value: 'VII' };
    const state = createState([lastCard]);

    expect(service.playMove('1', [lastCard], 'VII', state)).toBeTrue();
    expect(state.gameFinished).toBeFalse();
    expect(state.pendingWinnerId).toBe('1');
    expect(state.challengeDeadline).toBeGreaterThan(Date.now());
    expect(state.aiFinalChallengeDeadline).toBeGreaterThan(Date.now());
    expect(state.aiFinalChallengeDeadline).toBeLessThanOrEqual(
      Date.now() + 5_000
    );
  });

  it('does not allow a challenge on the first card of a game', () => {
    const firstCard: Card = { suit: 'piros', value: 'VII' };
    const state = createState([firstCard]);
    state.moveCount = 0;

    expect(service.playMove('1', [firstCard], 'VII', state)).toBeTrue();
    expect(service.callSvindli('2', state)).toBeFalse();
    expect(state.discardPile).toEqual([firstCard]);
  });

  it('declares a pending winner after the final-card challenge window expires', () => {
    const lastCard: Card = { suit: 'piros', value: 'VII' };
    const state = createState([lastCard]);

    service.playMove('1', [lastCard], 'VII', state);
    expect(service.finishPendingWin(state)).toBeFalse();
    expect(state.gameFinished).toBeFalse();

    state.challengeDeadline = Date.now() - 1;

    expect(service.finishPendingWin(state)).toBeTrue();
    expect(state.gameFinished).toBeTrue();
    expect(state.winnerId).toBe('1');
    expect(state.pendingWinnerId).toBeUndefined();
    expect(state.aiFinalChallengeDeadline).toBeUndefined();
  });

  it('ends a timed game with the player who has the fewest cards', () => {
    const state = createState();
    state.gameDeadline = 10_000;
    state.players[0].cards = [
      { suit: 'piros', value: 'VII' },
      { suit: 'zöld', value: 'VIII' },
    ];
    state.players[1].cards = [{ suit: 'makk', value: 'IX' }];
    state.players[2].cards = [
      { suit: 'tök', value: 'X' },
      { suit: 'piros', value: 'ász' },
    ];

    expect(service.finishByTime(state, 9_999)).toBeFalse();
    expect(service.finishByTime(state, 10_000)).toBeTrue();
    expect(state.gameFinished).toBeTrue();
    expect(state.winnerIds).toEqual(['2']);
    expect(state.winnerId).toBe('2');
    expect(state.isDraw).toBeFalse();
  });

  it('declares a draw when multiple players share the fewest cards at time limit', () => {
    const state = createState();
    state.gameDeadline = 10_000;
    state.players[0].cards = [{ suit: 'piros', value: 'VII' }];
    state.players[1].cards = [{ suit: 'makk', value: 'IX' }];
    state.players[2].cards = [
      { suit: 'tök', value: 'X' },
      { suit: 'piros', value: 'ász' },
    ];
    state.pendingWinnerId = '1';
    state.challengeDeadline = 12_000;
    state.aiFinalChallengeDeadline = 11_000;

    expect(service.finishByTime(state, 10_000)).toBeTrue();
    expect(state.gameFinished).toBeTrue();
    expect(state.winnerIds).toEqual(['1', '2']);
    expect(state.winnerId).toBeUndefined();
    expect(state.isDraw).toBeTrue();
    expect(state.pendingWinnerId).toBeUndefined();
    expect(state.challengeDeadline).toBeUndefined();
    expect(state.aiFinalChallengeDeadline).toBeUndefined();
  });

  it('keeps the game running when the final card is successfully challenged', () => {
    const lastBluffCard: Card = { suit: 'piros', value: 'ász' };
    const state = createState([lastBluffCard]);
    state.aiKnownDiscards = [{
      playerId: '1',
      cards: [{ suit: 'makk', value: 'VIII' }],
    }];

    service.playMove('1', [lastBluffCard], 'VII', state);

    expect(service.callSvindli('2', state)).toBeTrue();
    state.revealDeadline = Date.now() - 1;
    expect(service.finishSvindliChallenge(state)).toBeTrue();
    expect(state.gameFinished).toBeFalse();
    expect(state.pendingWinnerId).toBeUndefined();
    expect(state.players[0].cards).toContain(lastBluffCard);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.aiKnownDiscards).toEqual([]);
    expect(state.aiFinalChallengeDeadline).toBeUndefined();
  });

  it('declares the pending winner when the final-card challenge is incorrect', () => {
    const lastCard: Card = { suit: 'piros', value: 'VII' };
    const state = createState([lastCard]);

    service.playMove('1', [lastCard], 'VII', state);

    expect(service.callSvindli('2', state)).toBeFalse();
    expect(state.gameFinished).toBeFalse();
    state.revealDeadline = Date.now() - 1;
    expect(service.finishSvindliChallenge(state)).toBeTrue();
    expect(state.gameFinished).toBeTrue();
    expect(state.winnerId).toBe('1');
    expect(state.pendingWinnerId).toBeUndefined();
    expect(state.challengeDeadline).toBeUndefined();
    expect(state.aiFinalChallengeDeadline).toBeUndefined();
    expect(state.revealDeadline).toBeUndefined();
    expect(state.players[1].cards).toContain(lastCard);
    expect(service.finishPendingWin(state)).toBeFalse();
  });

  it('allows only players other than the player who made the last move to challenge', () => {
    const card: Card = { suit: 'piros', value: 'VII' };
    const state = createState([card, { suit: 'zöld', value: 'VIII' }]);

    expect(service.callSvindli('2', state)).toBeFalse();
    expect(service.playMove('1', [card], 'VII', state)).toBeTrue();
    expect(service.callSvindli('1', state)).toBeFalse();
    expect(service.callSvindli('unknown', state)).toBeFalse();
    expect(state.discardPile).toEqual([card]);
  });

  it('gives the pile to the bluffer and continues after them after a correct challenge', () => {
    const bluffCard: Card = { suit: 'piros', value: 'ász' };
    const nextPlayerCard: Card = { suit: 'zöld', value: 'VII' };
    const state = createState([bluffCard, { suit: 'zöld', value: 'VIII' }]);
    state.players[1].cards.push(nextPlayerCard, { suit: 'makk', value: 'X' });

    service.playMove('1', [bluffCard], 'VII', state);

    expect(service.callSvindli('3', state)).toBeTrue();
    expect(state.players[0].cards).not.toContain(bluffCard);
    expect(state.discardPile).toContain(bluffCard);
    expect(state.revealDeadline).toBeGreaterThan(Date.now());
    expect(service.finishSvindliChallenge(state)).toBeFalse();
    expect(
      service.playMove('2', [nextPlayerCard], state.nextCardValue, state)
    ).toBeFalse();

    state.revealDeadline = Date.now() - 1;
    expect(service.finishSvindliChallenge(state)).toBeTrue();
    expect(state.players[0].cards).toContain(bluffCard);
    expect(state.discardPile).toEqual([]);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.nextCardValue).toBe('VII');
    expect(state.lastMove).toBeUndefined();

    expect(service.playMove('2', [nextPlayerCard], state.nextCardValue, state))
      .toBeTrue();
    expect(state.lastMove?.declaredValue).toBe('VII');
    expect(state.nextCardValue).toBe('VIII');
  });

  it('gives the pile to a mistaken accuser and advances to the following value', () => {
    const truthfulCard: Card = { suit: 'piros', value: 'VII' };
    const state = createState([
      truthfulCard,
      { suit: 'zöld', value: 'VIII' },
    ]);

    service.playMove('1', [truthfulCard], 'VII', state);

    expect(service.callSvindli('3', state)).toBeFalse();
    expect(state.players[2].cards).not.toContain(truthfulCard);
    expect(state.discardPile).toContain(truthfulCard);

    state.revealDeadline = Date.now() - 1;
    expect(service.finishSvindliChallenge(state)).toBeTrue();
    expect(state.players[2].cards).toContain(truthfulCard);
    expect(state.discardPile).toEqual([]);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.nextCardValue).toBe('VIII');
    expect(state.lastMove).toBeUndefined();
  });
});
