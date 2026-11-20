import { AiService } from './ai.service';
import { AiDifficulty, GameState } from './game.state.model';
import { Player } from './game.player.model';
import { GameService } from './game.service';

interface DifficultyResult {
  difficulty: AiDifficulty;
  games: number;
  moves: number;
  bluffs: number;
  successfulBluffs: number;
  challenges: number;
  successfulChallenges: number;
  wins: number;
  draws: number;
  bluffRate: number;
  successfulBluffRate: number;
  successfulChallengeRate: number;
  winRate: number;
}

const SIMULATED_GAMES_PER_DIFFICULTY = 100;
const MAX_TURNS_PER_GAME = 10_000;

describe('AI difficulty simulation', () => {
  it('runs seeded matches and reports bluff and challenge metrics', () => {
    let simulatedNow = 1_800_000_000_000;
    const dateNow = spyOn(Date, 'now').and.callFake(() => simulatedNow);
    const random = spyOn(Math, 'random');
    const gameService = new GameService();
    const aiService = new AiService();
    const results = (['easy', 'medium', 'hard'] as const).map(difficulty =>
      simulateDifficulty(
        difficulty,
        SIMULATED_GAMES_PER_DIFFICULTY,
        gameService,
        aiService,
        random,
        value => simulatedNow = value
      )
    );

    console.log('AI-SIMULATION', JSON.stringify(results));

    expect(dateNow).toHaveBeenCalled();
    expect(results.map(result => result.difficulty)).toEqual([
      'easy',
      'medium',
      'hard',
    ]);
    for (const result of results) {
      expect(result.games).toBe(SIMULATED_GAMES_PER_DIFFICULTY);
      expect(result.moves).toBeGreaterThan(0);
      expect(result.challenges).toBeGreaterThan(0);
      expect(result.successfulChallenges).toBeLessThanOrEqual(result.challenges);
      expect(result.successfulBluffs).toBeLessThanOrEqual(result.bluffs);
      expect(result.wins + result.draws).toBe(result.games);
    }
  });
});

function simulateDifficulty(
  difficulty: AiDifficulty,
  gameCount: number,
  gameService: GameService,
  aiService: AiService,
  random: jasmine.Spy<() => number>,
  setNow: (value: number) => void
): DifficultyResult {
  const totals = {
    moves: 0,
    bluffs: 0,
    successfulBluffs: 0,
    challenges: 0,
    successfulChallenges: 0,
    wins: 0,
    draws: 0,
  };

  for (let gameIndex = 0; gameIndex < gameCount; gameIndex++) {
    const seed = 0x51_1D_11 + gameIndex;
    random.and.callFake(createSeededRandom(seed));
    let gameNow = 1_800_000_000_000 + gameIndex * 1_000_000;
    const advanceTo = (value: number): void => {
      gameNow = Math.max(gameNow, value);
      setNow(gameNow);
    };
    setNow(gameNow);

    const players: Player[] = [0, 1, 2].map(index => ({
      id: `ai-${index}`,
      name: `AI ${index + 1}`,
      cards: [],
      isAI: true,
    }));
    const deck = gameService.shuffleDeck(gameService.generateDeck());
    const state = gameService.dealCards(players, deck);
    state.aiDifficulty = difficulty;

    let turnCount = 0;
    while (!state.gameFinished && turnCount < MAX_TURNS_PER_GAME) {
      turnCount++;

      if (state.pendingWinnerId) {
        const automaticChallengeDeadline = state.aiFinalChallengeDeadline;
        if (automaticChallengeDeadline !== undefined) {
          advanceTo(automaticChallengeDeadline);
          if (finishByTime(state, gameService, gameNow, totals)) {
            continue;
          }
          const challenger = aiService.chooseRandomChallenger(
            state.players,
            state.pendingWinnerId
          );
          if (challenger && beginAndResolveChallenge(
            challenger.id,
            state,
            gameService,
            advanceTo,
            totals
          )) {
            continue;
          }
        }

        if (state.challengeDeadline === undefined) {
          throw new Error('Final-card move is missing its challenge deadline.');
        }
        advanceTo(state.challengeDeadline);
        if (finishByTime(state, gameService, gameNow, totals)) {
          continue;
        }
        gameService.finishPendingWin(state);
        continue;
      }

      advanceTo(gameNow + 3_000);
      if (finishByTime(state, gameService, gameNow, totals)) {
        continue;
      }

      const currentPlayer = state.players[state.currentPlayerIndex];
      if (
        state.lastMove &&
        aiService.shouldCallSvindli(
          currentPlayer,
          state,
          state.aiDifficulty
        )
      ) {
        if (beginAndResolveChallenge(
          currentPlayer.id,
          state,
          gameService,
          advanceTo,
          totals
        )) {
          continue;
        }
      }

      const card = aiService.chooseCard(
        currentPlayer,
        state.nextCardValue,
        state
      );
      if (!card) {
        throw new Error(`Player ${currentPlayer.id} has no card to play.`);
      }
      if (card.value !== state.nextCardValue) {
        totals.bluffs++;
      }
      if (!gameService.playMove(
        currentPlayer.id,
        [card],
        state.nextCardValue,
        state
      )) {
        throw new Error(`AI move rejected for player ${currentPlayer.id}.`);
      }
      totals.moves++;
    }

    if (!state.gameFinished) {
      throw new Error(
        `${difficulty} game ${gameIndex + 1} exceeded ${MAX_TURNS_PER_GAME} turns.`
      );
    }

    totals.successfulBluffs += state.successfulBluffCount ?? 0;
    if (state.winnerIds?.length === 1) {
      totals.wins++;
    } else {
      totals.draws++;
    }
  }

  return {
    difficulty,
    games: gameCount,
    ...totals,
    bluffRate: rate(totals.bluffs, totals.moves),
    successfulBluffRate: rate(totals.successfulBluffs, totals.bluffs),
    successfulChallengeRate: rate(
      totals.successfulChallenges,
      totals.challenges
    ),
    winRate: rate(totals.wins, gameCount),
  };
}

function beginAndResolveChallenge(
  challengerId: string,
  state: GameState,
  gameService: GameService,
  advanceTo: (value: number) => void,
  totals: Pick<DifficultyResult, 'challenges' | 'successfulChallenges'>
): boolean {
  const wasBluff = gameService.callSvindli(challengerId, state);
  if (state.revealDeadline === undefined) {
    return false;
  }

  totals.challenges++;
  if (wasBluff) {
    totals.successfulChallenges++;
  }
  const revealStartedAt = Date.now();
  advanceTo(state.revealDeadline);
  const revealDuration = Date.now() - revealStartedAt;
  if (!gameService.finishSvindliChallenge(state)) {
    throw new Error('AI challenge could not be resolved.');
  }
  if (!state.gameFinished && state.gameDeadline !== undefined) {
    state.gameDeadline += revealDuration;
    advanceTo(Date.now() + 5_000);
    gameService.finishByTime(state);
  }
  return true;
}

function finishByTime(
  state: GameState,
  gameService: GameService,
  now: number,
  totals: Pick<DifficultyResult, 'successfulBluffs'>
): boolean {
  const pendingUnchallengedBluff =
    state.pendingWinnerId !== undefined &&
    state.pendingChallengerId === undefined &&
    state.lastMove?.cards.some(card => card.value !== state.lastMove?.declaredValue);
  const finished = gameService.finishByTime(state, now);
  if (finished && pendingUnchallengedBluff) {
    totals.successfulBluffs++;
  }
  return finished;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number(((numerator / denominator) * 100).toFixed(2));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
