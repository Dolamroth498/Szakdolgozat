import { Component } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameService } from './game.service';
import { GameControlService } from './game-control.service';
import { GameExitGuard } from './game.guard';
import { GameState } from './game.state.model';
import { Card } from './card.model';
import { GameStateStorageService } from './game-state-storage.service';
import { AiService } from './ai.service';
import { UserService } from '../user/user.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnDestroy, GameExitGuard {

  gameState!: GameState;

  selectedCards: Card[] = [];

  aiOpponentCount = 2;

  gameMode: 'computer' | 'human' = 'computer';

  showGameSetup = false;

  challengeFeedback = '';

  persistenceError = '';

  challengeSecondsRemaining = 0;

  gameSecondsRemaining = 15 * 60;

  rewardMessage = '';

  private challengeTimer?: ReturnType<typeof setInterval>;

  private gameTimer?: ReturnType<typeof setInterval>;

  private aiTimer?: ReturnType<typeof setTimeout>;

  private readonly isBrowser: boolean;

  constructor(
    private gameService: GameService,
    private gameControl: GameControlService,
    private aiService: AiService,
    private gameStateStorage: GameStateStorageService,
    private userService: UserService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: object,
    destroyRef: DestroyRef,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.gameControl.pauseRequested$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.toggleGamePause());
    const shouldResumeGame =
      this.route.snapshot.queryParamMap.get('resume') === 'true';
    const requestedMode = this.route.snapshot.queryParamMap.get('opponent');
    if (requestedMode === 'human' || requestedMode === 'computer') {
      this.gameMode = requestedMode;
      this.showGameSetup = true;
    }

    try {
      const savedState = this.gameStateStorage.load();
      if (savedState) {
        this.gameState = savedState;
        this.ensureGameMetadata();
        if (this.gameState.gamePaused) {
          this.updateGameCountdown();
          this.updateChallengeCountdown();
          if (shouldResumeGame) {
            this.resumePausedGame();
          }
        } else if (!this.showGameSetup) {
          this.startGameTimer();
          this.startPendingWinTimer();
          this.scheduleAiTurn();
          if (this.gameState.gameFinished) {
            void this.processCompletedGame();
          }
        }
      } else {
        this.showGameSetup = true;
      }
    } catch (error) {
      console.error('Nem sikerült betölteni a mentett játékállapotot.', error);
      this.showGameSetup = true;
      this.persistenceError =
        'A mentett játékállapot nem tölthető be. A korábbi parti nem állítható vissza.';
    }
  }

  get currentPlayer() {

    return this.gameState.players[
      this.gameState.currentPlayerIndex
    ];
  }

  get winnerName(): string | undefined {
    return this.gameState.players.find(
      player => player.id === this.gameState.winnerId
    )?.name;
  }

  get winnerNames(): string[] {
    const winnerIds = this.gameState.winnerIds ??
      (this.gameState.winnerId ? [this.gameState.winnerId] : []);
    return winnerIds
      .map(id => this.gameState.players.find(player => player.id === id)?.name)
      .filter((name): name is string => name !== undefined);
  }

  get hasAiOpponents(): boolean {
    return this.gameState.players.some(player => player.isAI);
  }

  get gameTableClass(): string {
    const background = this.userService.currentUserSnapshot?.selectedBackground;
    return background ? `table-${background}` : '';
  }

  get gameCardBackClass(): string {
    const cardBack = this.userService.currentUserSnapshot?.selectedCardBack;
    return cardBack ? `cardback-${cardBack}` : '';
  }

  get eligibleChallengers() {
    const lastPlayerId = this.gameState.lastMove?.playerId;
    if (
      (this.gameState.moveCount ?? 0) <= 1 ||
      this.gameState.revealDeadline !== undefined ||
      this.gameState.gamePaused
    ) {
      return [];
    }

    return this.gameState.players.filter(
      player => player.id !== lastPlayerId && !player.isAI
    );
  }

  toggleCard(card: Card): void {
    if (this.gameState.gamePaused || this.gameState.gameFinished) {
      return;
    }

    const index =
      this.selectedCards.indexOf(card);

    if (index > -1) {

      this.selectedCards.splice(index, 1);

      return;
    }

    this.selectedCards = [card];
  }

  isSelected(card: Card): boolean {

    return this.selectedCards.includes(card);
  }

  playSelectedCards(): void {
    if (this.gameState.gamePaused || this.gameState.gameFinished) {
      return;
    }

    if (this.selectedCards.length === 0) {

      alert('Válassz legalább 1 lapot!');

      return;
    }

    const success =
      this.gameService.playMove(
        this.currentPlayer.id,
        [...this.selectedCards],
        this.gameState.nextCardValue,
        this.gameState
      );

    if (!success) {

      alert('Hibás lépés');

      return;
    }

    this.selectedCards = [];
    this.challengeFeedback = '';
    this.persistGameState();
    this.startPendingWinTimer();
    this.scheduleAiTurn();
  }

  callSvindli(accuserId: string): void {
    if (this.gameState.gamePaused || this.gameState.gameFinished) {
      return;
    }

    this.clearAiTimer();

    if (
      this.gameState.pendingWinnerId &&
      this.gameState.challengeDeadline !== undefined &&
      Date.now() >= this.gameState.challengeDeadline
    ) {
      this.finishPendingWin();
      this.challengeFeedback = 'A 10 másodperces kihívási idő lejárt.';
      return;
    }

    this.gameService.callSvindli(accuserId, this.gameState);

    if (this.gameState.gameFinished) {
      this.clearChallengeTimer();
      this.challengeFeedback = 'A kihívási idő lejárt; a játék véget ért.';
      this.persistGameState();
      return;
    }

    if (this.gameState.revealDeadline === undefined) {
      return;
    }

    this.clearAiTimer();
    this.challengeFeedback =
      'A lap felfordítva látható. A kihívás eredménye 3 másodperc múlva lép életbe.';
    this.persistGameState();
    this.startPendingWinTimer();
  }


  openGameSetup(): void {
    this.clearChallengeTimer();
    this.clearAiTimer();
    this.gameMode = this.gameState.players.some(player => player.isAI)
      ? 'computer'
      : 'human';
    this.showGameSetup = true;
  }

  toggleGamePause(): void {
    if (!this.gameState || this.gameState.gameFinished) {
      return;
    }

    if (this.gameState.gamePaused) {
      this.resumePausedGame();
      return;
    }

    this.gameState.pausedAt = Date.now();
    this.gameState.gamePaused = true;
    this.clearGameTimer();
    this.clearChallengeTimer();
    this.clearAiTimer();
    this.updateGameCountdown();
    this.updateChallengeCountdown();
    this.persistGameState();
  }

  private resumePausedGame(): void {
    const pausedAt = this.gameState.pausedAt;
    if (pausedAt === undefined) {
      throw new Error('A megállított játék időpontja hiányzik.');
    }

    const pausedDuration = Date.now() - pausedAt;
    for (const deadline of [
      'gameDeadline',
      'challengeDeadline',
      'aiFinalChallengeDeadline',
      'revealDeadline',
    ] as const) {
      const value = this.gameState[deadline];
      if (value !== undefined) {
        this.gameState[deadline] = value + pausedDuration;
      }
    }
    this.gameState.gamePaused = false;
    this.gameState.pausedAt = undefined;
    this.persistGameState();
    this.startGameTimer();
    this.startPendingWinTimer();
    this.scheduleAiTurn();
  }

  canLeaveGame(): boolean {
    const canLeave =
      !this.gameState ||
      this.gameState.gameFinished ||
      this.gameState.gamePaused === true;
    if (!canLeave && this.isBrowser) {
      alert('Játék közben nem lehet elhagyni az oldalt. Állítsd meg a játékot vagy fejezd be előbb.');
    }
    return canLeave;
  }

  cancelGameSetup(): void {
    this.showGameSetup = false;
    if (!this.gameState.gamePaused) {
      this.startGameTimer();
      this.startPendingWinTimer();
      this.scheduleAiTurn();
    }
  }

  startNewGame(): void {
    if (
      this.gameMode === 'computer' &&
      this.aiOpponentCount !== 2 &&
      this.aiOpponentCount !== 3
    ) {
      throw new RangeError('2 és 3 közötti AI-ellenfelet válassz.');
    }

    if (
      this.gameState &&
      !this.gameState.gameFinished &&
      this.isBrowser &&
      !window.confirm(
        `Biztosan elveted a jelenlegi partit és új ${
          this.gameMode === 'computer' ? 'AI-játékot' : 'emberi játékot'
        } indítasz?`
      )
    ) {
      return;
    }

    this.gameState = this.createNewGameState(
      this.gameMode,
      this.aiOpponentCount
    );
    this.gameState.profileId = this.userService.currentUserSnapshot?.id;
    const gameId = this.gameState.gameId;
    if (this.gameMode === 'computer' && !this.gameState.profileId && gameId) {
      void this.captureGameProfileId(gameId);
    }
    this.showGameSetup = false;
    this.selectedCards = [];
    this.challengeFeedback = '';
    this.clearChallengeTimer();
    this.clearGameTimer();
    this.clearAiTimer();
    this.persistGameState();
    this.startGameTimer();
    this.scheduleAiTurn();
  }

  ngOnDestroy(): void {
    this.clearChallengeTimer();
    this.clearGameTimer();
    this.clearAiTimer();
  }

  selectAiOpponentCount(count: number): void {
    if (count === 2 || count === 3) {
      this.aiOpponentCount = count;
    }
  }

  selectGameMode(mode: 'computer' | 'human'): void {
    this.gameMode = mode;
  }

  private createNewGameState(
    mode: 'computer' | 'human',
    aiOpponentCount: number
  ): GameState {
    const players =
      mode === 'computer'
        ? [
            { id: 'human', name: 'Te', cards: [], isAI: false },
            ...Array.from({ length: aiOpponentCount }, (_, index) => ({
              id: `ai-${index + 1}`,
              name: `AI ellenfél ${index + 1}`,
              cards: [],
              isAI: true,
            })),
          ]
        : Array.from({ length: 4 }, (_, index) => ({
            id: `human-${index + 1}`,
            name: index === 0 ? 'Te (Játékos 1)' : `Játékos ${index + 1}`,
            cards: [],
            isAI: false,
          }));

    const deck = this.gameService.shuffleDeck(
      this.gameService.generateDeck()
    );

    return this.gameService.dealCards(players, deck);
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:` +
      remainingSeconds.toString().padStart(2, '0');
  }

  private ensureGameMetadata(): void {
    let updated = false;
    if (!this.gameState.gameId) {
      this.gameState.gameId =
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      updated = true;
    }
    if (this.gameState.startedAt === undefined) {
      this.gameState.startedAt = Date.now();
      updated = true;
    }
    if (this.gameState.gameDeadline === undefined) {
      this.gameState.gameDeadline = this.gameState.startedAt + 15 * 60 * 1000;
      updated = true;
    }
    if (updated) {
      this.persistGameState();
    }
  }

  private startGameTimer(): void {
    this.clearGameTimer();
    if (
      !this.isBrowser ||
      this.gameState.gameFinished ||
      this.gameState.gamePaused
    ) {
      return;
    }

    this.updateGameCountdown();
    this.gameTimer = setInterval(() => {
      if (this.gameService.finishByTime(this.gameState)) {
        this.gameSecondsRemaining = 0;
        this.clearGameTimer();
        this.clearChallengeTimer();
        this.clearAiTimer();
        this.challengeFeedback = 'Lejárt a 15 perces játékidő.';
        this.persistGameState();
        void this.processCompletedGame();
        return;
      }
      this.updateGameCountdown();
    }, 250);
  }

  private updateGameCountdown(): void {
    const deadline = this.gameState.gameDeadline;
    const now = this.gameState.gamePaused
      ? this.gameState.pausedAt ?? Date.now()
      : Date.now();
    this.gameSecondsRemaining = deadline === undefined
      ? 0
      : Math.max(0, Math.ceil((deadline - now) / 1000));
  }

  private clearGameTimer(): void {
    if (this.gameTimer !== undefined) {
      clearInterval(this.gameTimer);
      this.gameTimer = undefined;
    }
  }

  private async processCompletedGame(): Promise<void> {
    if (
      !this.gameState.gameFinished ||
      this.gameState.rewardProcessed ||
      !this.hasAiOpponents ||
      !this.gameState.gameId ||
      !this.gameState.profileId
    ) {
      return;
    }

    const winnerIds = this.gameState.winnerIds ??
      (this.gameState.winnerId ? [this.gameState.winnerId] : []);
    const outcome = this.gameState.isDraw || winnerIds.length > 1
      ? 'draw'
      : winnerIds.includes('human')
        ? 'win'
        : 'loss';
    try {
      const recorded = await this.userService.recordAiGameResult(
        this.gameState.profileId,
        this.gameState.gameId,
        outcome
      );
      this.gameState.rewardProcessed = true;
      this.rewardMessage = recorded
        ? outcome === 'win'
          ? 'A győzelemért 15 érme került a profilodra.'
          : 'A játék eredménye rögzítve lett a profilodon.'
        : 'A játék jutalma már korábban rögzítve lett.';
      this.persistGameState();
    } catch (error) {
      console.error('Nem sikerült rögzíteni a játék eredményét.', error);
      this.rewardMessage =
        'A játék véget ért, de az eredményt nem sikerült a profilhoz menteni.';
    }
  }

  private async captureGameProfileId(gameId: string): Promise<void> {
    try {
      const profileId = await this.userService.getCurrentUserIdWhenReady();
      if (
        !profileId ||
        this.gameState.gameId !== gameId ||
        this.gameState.profileId
      ) {
        return;
      }

      this.gameState.profileId = profileId;
      this.persistGameState();
      if (this.gameState.gameFinished) {
        await this.processCompletedGame();
      }
    } catch (error) {
      console.error('Nem sikerült megállapítani a játékos profilját.', error);
    }
  }

  private persistGameState(): void {
    try {
      this.gameStateStorage.save(this.gameState);
      this.persistenceError = '';
    } catch (error) {
      console.error('Nem sikerült elmenteni a játékállapotot.', error);
      this.persistenceError =
        'A játékállapot mentése nem sikerült; frissítéskor elveszhet a parti.';
    }
  }

  private startPendingWinTimer(): void {
    this.clearChallengeTimer();

    if (!this.isBrowser || this.gameState.gamePaused) {
      this.updateChallengeCountdown();
      return;
    }

    const revealDeadline = this.gameState.revealDeadline;
    const challengeDeadline = this.gameState.challengeDeadline;
    const deadline = revealDeadline ?? (
      this.gameState.pendingWinnerId ? challengeDeadline : undefined
    );
    if (deadline === undefined) {
      return;
    }

    this.updateChallengeCountdown();
    this.challengeTimer = setInterval(() => {
      this.updateChallengeCountdown();

      if (this.gameState.revealDeadline !== undefined) {
        this.finishSvindliReveal();
      } else if (this.tryAutomaticFinalCardChallenge()) {
        return;
      } else if (this.gameService.finishPendingWin(this.gameState)) {
        this.clearChallengeTimer();
        this.persistGameState();
        this.clearGameTimer();
        void this.processCompletedGame();
      }
    }, 250);
  }

  private updateChallengeCountdown(): void {
    const deadline = this.gameState.revealDeadline ??
      (this.gameState.pendingWinnerId
        ? this.gameState.challengeDeadline
        : undefined);
    const now = this.gameState.gamePaused
      ? this.gameState.pausedAt ?? Date.now()
      : Date.now();
    this.challengeSecondsRemaining = deadline === undefined
      ? 0
      : Math.max(0, Math.ceil((deadline - now) / 1000));
  }

  private finishSvindliReveal(): void {
    const wasBluff = this.gameState.pendingBluffDetected;
    if (!this.gameService.finishSvindliChallenge(this.gameState)) {
      return;
    }

    this.clearChallengeTimer();
    this.challengeFeedback = wasBluff
      ? `Sikeres leleplezés! A blöffölő felvette a dobóhalmot. ` +
        `${this.currentPlayer.name} következik, a bemondás: ` +
        `${this.gameState.nextCardValue}.`
      : this.gameState.gameFinished
        ? `Téves kihívás! ${this.winnerName} megnyerte a játékot.`
        : `Téves kihívás! A kihívó felvette a dobóhalmot. ` +
          `${this.currentPlayer.name} következik, a bemondás: ` +
          `${this.gameState.nextCardValue}.`;
    this.persistGameState();
    if (this.gameState.gameFinished) {
      this.clearGameTimer();
      void this.processCompletedGame();
    }
    this.scheduleAiTurn();
  }

  private finishPendingWin(): void {
    this.gameService.finishPendingWin(this.gameState);
    this.clearChallengeTimer();
    this.persistGameState();
    if (this.gameState.gameFinished) {
      this.clearGameTimer();
      void this.processCompletedGame();
    }
  }

  private clearChallengeTimer(): void {
    if (this.challengeTimer !== undefined) {
      clearInterval(this.challengeTimer);
      this.challengeTimer = undefined;
    }
    this.challengeSecondsRemaining = 0;
  }

  private scheduleAiTurn(): void {
    this.clearAiTimer();
    if (
      !this.isBrowser ||
      this.gameState.gameFinished ||
      this.gameState.gamePaused ||
      this.gameState.pendingWinnerId !== undefined ||
      this.gameState.revealDeadline !== undefined ||
      !this.currentPlayer.isAI
    ) {
      return;
    }

    this.aiTimer = setTimeout(() => this.runAiTurn(), 3_000);
  }

  private runAiTurn(): void {
    this.aiTimer = undefined;

    if (
      this.gameState.gameFinished ||
      this.gameState.gamePaused ||
      this.gameState.pendingWinnerId !== undefined ||
      this.gameState.revealDeadline !== undefined ||
      !this.currentPlayer.isAI
    ) {
      return;
    }

    const aiPlayer = this.currentPlayer;
    if (
      this.gameState.lastMove &&
      this.aiService.shouldCallSvindli(aiPlayer, this.gameState)
    ) {
      this.callSvindli(aiPlayer.id);
      return;
    }

    if (this.gameState.pendingWinnerId) {
      return;
    }

    const card = this.aiService.chooseCard(
      aiPlayer,
      this.gameState.nextCardValue
    );
    if (
      !this.gameService.playMove(
        aiPlayer.id,
        [card],
        this.gameState.nextCardValue,
        this.gameState
      )
    ) {
      console.error('Az AI nem tudott szabályos lépést végrehajtani.');
      return;
    }

    this.challengeFeedback = 'Az AI-ellenfél lerakott egy lapot.';
    this.persistGameState();
    this.startPendingWinTimer();
    this.scheduleAiTurn();
  }

  private clearAiTimer(): void {
    if (this.aiTimer !== undefined) {
      clearTimeout(this.aiTimer);
      this.aiTimer = undefined;
    }
  }

  private tryAutomaticFinalCardChallenge(): boolean {
    if (
      !this.isBrowser ||
      !this.gameState.pendingWinnerId ||
      this.gameState.revealDeadline !== undefined ||
      this.gameState.aiFinalChallengeDeadline === undefined ||
      Date.now() < this.gameState.aiFinalChallengeDeadline
    ) {
      return false;
    }

    const lastMove = this.gameState.lastMove;
    const lastPlayerId = lastMove?.playerId;
    if (!lastPlayerId) {
      return false;
    }

    const challenger = this.aiService.chooseRandomChallenger(
      this.gameState.players,
      lastPlayerId
    );
    if (!challenger) {
      return false;
    }

    this.callSvindli(challenger.id);
    return this.gameState.revealDeadline !== undefined;
  }
}