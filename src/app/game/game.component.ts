import { Component } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { LocalPlayerPinService } from './local-player-pin.service';

interface LocalLobbyPlayer {
  name: string;
  pin: string;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnDestroy, GameExitGuard {

  gameState!: GameState;

  selectedCards: Card[] = [];

  aiOpponentCount = 2;

  humanPlayerCount = 3;

  gameMode: 'computer' | 'human' = 'computer';

  showGameSetup = false;

  localLobbyPhase: 'count' | 'credentials' = 'count';

  localLobbyPlayerIndex = 0;

  localLobbyPlayerName = '';

  localLobbyPlayerPin = '';

  localLobbyError = '';

  private localLobbyProfileId?: string;

  private localLobbyProfileName = '';

  turnPinInput = '';

  turnPinError = '';

  unlockedPlayerId?: string;

  private localLobbyPlayers: LocalLobbyPlayer[] = [];

  challengeResultMessage = '';

  private challengeResultShownAt?: number;

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
    private localPlayerPinService: LocalPlayerPinService,
    private userService: UserService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: object,
    destroyRef: DestroyRef,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.gameControl.pauseRequested$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.toggleGamePause());
    const shouldOpenSetup =
      this.route.snapshot.queryParamMap.get('setup') === 'true';
    const shouldResumeGame =
      this.route.snapshot.queryParamMap.get('resume') === 'true';
    const requestedMode = this.route.snapshot.queryParamMap.get('opponent');
    this.showGameSetup = shouldOpenSetup;
    if (requestedMode === 'human' || requestedMode === 'computer') {
      this.gameMode = requestedMode;
      this.showGameSetup = true;
    }

    try {
      const savedState = this.gameStateStorage.load();
      if (savedState) {
        this.gameState = savedState;
        this.lockCurrentLocalTurn();
        if (!this.gameState.gameFinished && !this.gameState.gamePaused) {
          this.showGameSetup = false;
        }
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

  playerPosition(index: number): string {
    const humanIndex = this.gameState.players.findIndex(player => !player.isAI);
    const playerIndex = this.isLocalHumanGame
      ? this.gameState.currentPlayerIndex
      : humanIndex === -1 ? 0 : humanIndex;
    const relativeIndex =
      (index - playerIndex + this.gameState.players.length) %
      this.gameState.players.length;
    if (relativeIndex === 0) {
      return 'player-bottom';
    }

    if (this.gameState.players.length === 3) {
      return relativeIndex === 1 ? 'player-top-left' : 'player-top-right';
    }

    if (relativeIndex === 1) {
      return 'player-left';
    }
    if (relativeIndex === 2) {
      return 'player-top';
    }
    return 'player-right';
  }

  handWidth(cardCount: number): string {
    const widthRem = Math.max(12, Math.min(80, cardCount * 2.35 + 2.6));
    return `${Number(widthRem.toFixed(2))}rem`;
  }

  cardSpritePosition(card: Card): string {
    const columnByValue: Record<string, number> = {
      ász: 0,
      király: 1,
      felső: 2,
      alsó: 3,
      X: 4,
      IX: 5,
      VIII: 6,
      VII: 7,
    };
    const rowBySuit: Record<string, number> = {
      makk: 0,
      zöld: 1,
      piros: 2,
      tök: 3,
    };
    const columnPositions = [12.2, 23, 33.8, 44.6, 55.4, 66.2, 77, 87.8];
    const rowPositions = [2, 34, 66, 98];
    const column = columnByValue[card.value];
    const row = rowBySuit[card.suit];

    if (column === undefined || row === undefined) {
      throw new RangeError(`Ismeretlen kártya a sprite-ban: ${card.value} ${card.suit}`);
    }

    return `${columnPositions[column]}% ${rowPositions[row]}%`;
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

  get canHumanPlayerChallenge(): boolean {
    const lastMove = this.gameState.lastMove;
    const humanPlayer = this.gameState.players.find(player => !player.isAI);
    if (!lastMove || !humanPlayer) {
      return false;
    }

    const canChallengeDuringTurn = this.isLocalHumanGame
      ? this.unlockedPlayerId === this.currentPlayer.id &&
        !this.currentPlayer.isAI &&
        this.currentPlayer.id !== lastMove.playerId
      : humanPlayer.id !== lastMove.playerId;

    return canChallengeDuringTurn &&
      (this.gameState.moveCount ?? 0) > 1 &&
      this.gameState.revealDeadline === undefined &&
      !this.gameState.gamePaused &&
      !this.gameState.gameFinished;
  }

  get humanPlayerId(): string {
    return this.gameState.players.find(player => !player.isAI)?.id ?? '';
  }

  get isLocalHumanGame(): boolean {
    return !!this.gameState &&
      this.gameState.players.length > 1 &&
      this.gameState.players.every(player => !player.isAI);
  }

  get showTurnPinDialog(): boolean {
    return this.isLocalTurnLocked &&
      !this.showGameSetup &&
      !this.gameState.gamePaused &&
      !this.gameState.gameFinished;
  }

  get isLocalTurnLocked(): boolean {
    return this.isLocalHumanGame &&
      this.unlockedPlayerId !== this.currentPlayer.id;
  }

  get currentTurnHasPin(): boolean {
    return !!this.gameState?.gameId &&
      this.localPlayerPinService.hasPin(
        this.gameState.gameId,
        this.currentPlayer.id
      );
  }

  get showChallengeRevealDialog(): boolean {
    return !!this.gameState &&
      !this.showGameSetup &&
      !this.gameState.gamePaused &&
      !this.gameState.gameFinished &&
      this.gameState.revealDeadline !== undefined;
  }

  toggleCard(card: Card): void {
    if (
      this.gameState.gamePaused ||
      this.gameState.gameFinished ||
      (this.isLocalHumanGame && this.unlockedPlayerId !== this.currentPlayer.id)
    ) {
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
    if (
      this.gameState.gamePaused ||
      this.gameState.gameFinished ||
      (this.isLocalHumanGame && this.unlockedPlayerId !== this.currentPlayer.id)
    ) {
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
    this.lockCurrentLocalTurn();
    this.challengeResultMessage = '';
    this.persistGameState();
    this.startPendingWinTimer();
    this.scheduleAiTurn();
  }

  callSvindli(accuserId: string): void {
    if (
      this.gameState.gamePaused ||
      this.gameState.gameFinished ||
      (this.isLocalHumanGame && this.unlockedPlayerId !== this.currentPlayer.id)
    ) {
      return;
    }

    this.clearAiTimer();
    this.challengeResultMessage = '';

    if (
      this.gameState.pendingWinnerId &&
      this.gameState.challengeDeadline !== undefined &&
      Date.now() >= this.gameState.challengeDeadline
    ) {
      this.finishPendingWin();
      return;
    }

    this.gameService.callSvindli(accuserId, this.gameState);

    if (this.gameState.gameFinished) {
      this.clearChallengeTimer();
      this.lockCurrentLocalTurn();
      this.persistGameState();
      return;
    }

    if (this.gameState.revealDeadline === undefined) {
      return;
    }

    this.clearAiTimer();
    this.gameState.challengeRevealStartedAt = Date.now();
    this.clearGameTimer();
    this.persistGameState();
    this.startPendingWinTimer();
  }

  dismissChallengeResult(): void {
    if (this.challengeResultShownAt !== undefined) {
      this.shiftGameDeadlines(Math.max(0, Date.now() - this.challengeResultShownAt));
      this.challengeResultShownAt = undefined;
      this.persistGameState();
    }
    this.challengeResultMessage = '';
    this.startGameTimer();
    this.startPendingWinTimer();
    this.scheduleAiTurn();
  }


  openGameSetup(): void {
    if (
      !this.gameState.gameFinished &&
      this.gameState.gamePaused !== true
    ) {
      return;
    }

    if (this.gameState.gameFinished) {
      try {
        this.gameStateStorage.clear();
      } catch (error) {
        console.error('Nem sikerült törölni a befejezett játék mentését.', error);
        this.persistenceError =
          'A befejezett játék mentését nem sikerült törölni; frissítéskor visszatérhet az eredmény.';
      }
    }

    this.clearChallengeTimer();
    this.clearAiTimer();
    this.gameMode = this.gameState.players.some(player => player.isAI)
      ? 'computer'
      : 'human';
    this.localLobbyPhase = 'count';
    this.localLobbyPlayers = [];
    this.localLobbyPlayerName = '';
    this.localLobbyPlayerPin = '';
    this.localLobbyError = '';
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
    if (
      this.isLocalTurnLocked &&
      this.gameState.localTurnLockedAt !== undefined
    ) {
      this.shiftGameDeadlines(Date.now() - this.gameState.localTurnLockedAt);
      this.gameState.localTurnLockedAt = Date.now();
    }
    this.gameState.gamePaused = true;
    this.lockCurrentLocalTurn();
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
    if (this.gameState.challengeRevealStartedAt !== undefined) {
      this.gameState.challengeRevealStartedAt += pausedDuration;
    }
    this.gameState.gamePaused = false;
    this.gameState.pausedAt = undefined;
    if (this.isLocalHumanGame) {
      this.unlockedPlayerId = undefined;
      this.gameState.localTurnLockedAt = Date.now();
    }
    this.persistGameState();
    if (!this.showTurnPinDialog) {
      this.startGameTimer();
      this.startPendingWinTimer();
    }
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
      this.gameState &&
      !this.gameState.gameFinished &&
      this.gameState.gamePaused !== true
    ) {
      if (this.isBrowser) {
        alert('Új játékot csak a jelenlegi parti megállítása vagy befejezése után indíthatsz.');
      }
      return;
    }

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
    this.challengeResultMessage = '';
    this.turnPinInput = '';
    this.turnPinError = '';
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
    if (mode !== this.gameMode) {
      this.localLobbyPhase = 'count';
      this.localLobbyPlayers = [];
      this.localLobbyError = '';
    }
    this.gameMode = mode;
  }

  selectHumanPlayerCount(count: number): void {
    if (count === 3 || count === 4) {
      this.humanPlayerCount = count;
    }
  }

  beginLocalLobby(): void {
    const profile = this.userService.currentUserSnapshot;
    if (!profile) {
      this.localLobbyError =
        'Az ember elleni játékhoz előbb jelentkezz be. A bejelentkezett játékos lesz az első játékos.';
      return;
    }

    this.localLobbyProfileId = profile.id;
    this.localLobbyProfileName = profile.name.trim() || 'Játékos';
    this.localLobbyPlayers = [];
    this.localLobbyPlayerIndex = 0;
    this.localLobbyPlayerName = this.localLobbyProfileName;
    this.localLobbyPlayerPin = '';
    this.localLobbyError = '';
    this.localLobbyPhase = 'credentials';
    this.localLobbyPlayerName = '';
    this.localLobbyPlayerPin = '';
    this.localLobbyError = '';
  }

  async saveLocalLobbyPlayer(): Promise<void> {
    const name = this.localLobbyPlayerIndex === 0
      ? this.localLobbyProfileName
      : this.localLobbyPlayerName.trim();
    const pin = this.localLobbyPlayerPin;
    if (!name || (this.localLobbyPlayerIndex > 0 && name.length > 20)) {
      this.localLobbyError = 'Adj meg egy 1–20 karakteres becenevet.';
      return;
    }
    if (this.localLobbyPlayers.some(
      player => player.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )) {
      this.localLobbyError = 'Minden játékosnak külön becenevet válasszatok.';
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      this.localLobbyError = 'A PIN pontosan 4 számjegyből álljon.';
      return;
    }

    this.localLobbyPlayers.push({ name, pin });
    this.localLobbyPlayerIndex++;
    this.localLobbyError = '';
    if (this.localLobbyPlayerIndex < this.humanPlayerCount) {
      this.localLobbyPhase = 'credentials';
      this.localLobbyPlayerName = '';
      this.localLobbyPlayerPin = '';
      return;
    }

    try {
      const state = this.createNewGameState(
        'human',
        0,
        this.localLobbyPlayers.map(player => player.name)
      );
      const pins = Object.fromEntries(
        this.localLobbyPlayers.map((player, index) => [
          state.players[index].id,
          player.pin,
        ])
      );
      await this.localPlayerPinService.savePins(state.gameId!, pins);
      this.startCreatedGame(state, this.localLobbyProfileId);
    } catch (error) {
      console.error('Nem sikerült elindítani a PIN-védett helyi játékot.', error);
      this.localLobbyPlayerIndex = this.humanPlayerCount - 1;
      this.localLobbyPlayers.pop();
      this.localLobbyPhase = 'credentials';
      this.localLobbyError =
        'A PIN-ek mentése nem sikerült. Ellenőrizd a böngésző tárhelyét, majd próbáld újra.';
    }
  }

  async unlockCurrentTurn(): Promise<void> {
    const gameId = this.gameState.gameId;
    if (!gameId || !/^\d{4}$/.test(this.turnPinInput)) {
      this.turnPinError = 'A PIN pontosan 4 számjegyből álljon.';
      return;
    }

    try {
      if (!this.currentTurnHasPin) {
        await this.localPlayerPinService.setPin(
          gameId,
          this.currentPlayer.id,
          this.turnPinInput
        );
      } else if (!await this.localPlayerPinService.verifyPin(
        gameId,
        this.currentPlayer.id,
        this.turnPinInput
      )) {
        this.turnPinError = 'A PIN nem megfelelő. Próbáld újra.';
        this.turnPinInput = '';
        return;
      }

      const lockedDuration = this.gameState.localTurnLockedAt === undefined
        ? 0
        : Date.now() - this.gameState.localTurnLockedAt;
      this.shiftGameDeadlines(lockedDuration);
      this.gameState.localTurnLockedAt = undefined;
      this.unlockedPlayerId = this.currentPlayer.id;
      this.turnPinInput = '';
      this.turnPinError = '';
      this.persistGameState();
      this.startGameTimer();
      this.startPendingWinTimer();
    } catch (error) {
      console.error('Nem sikerült ellenőrizni a játékos PIN-kódját.', error);
      this.turnPinError =
        'A PIN ellenőrzése nem sikerült. Ellenőrizd a böngésző tárhelyét.';
    }
  }

  private createNewGameState(
    mode: 'computer' | 'human',
    aiOpponentCount: number,
    humanPlayerNames?: string[]
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
        : Array.from({ length: humanPlayerNames?.length ?? 4 }, (_, index) => ({
            id: `human-${index + 1}`,
            name: humanPlayerNames?.[index] ??
              (index === 0 ? 'Te (Játékos 1)' : `Játékos ${index + 1}`),
            cards: [],
            isAI: false,
          }));

    const deck = this.gameService.shuffleDeck(
      this.gameService.generateDeck()
    );

    const gameState = this.gameService.dealCards(players, deck);
    gameState.currentPlayerIndex = Math.floor(
      Math.random() * gameState.players.length
    );
    return gameState;
  }

  private startCreatedGame(gameState: GameState, profileId?: string): void {
    this.gameState = gameState;
    this.gameState.profileId = profileId ??
      this.userService.currentUserSnapshot?.id;
    this.showGameSetup = false;
    this.selectedCards = [];
    this.lockCurrentLocalTurn();
    this.challengeResultMessage = '';
    this.clearChallengeTimer();
    this.clearGameTimer();
    this.clearAiTimer();
    this.persistGameState();
    this.startGameTimer();
    this.scheduleAiTurn();
  }

  private lockCurrentLocalTurn(): void {
    if (this.isLocalHumanGame) {
      this.unlockedPlayerId = undefined;
      this.turnPinInput = '';
      this.turnPinError = '';
      const startedLock = this.gameState.localTurnLockedAt === undefined;
      this.gameState.localTurnLockedAt ??= Date.now();
      this.clearGameTimer();
      this.clearChallengeTimer();
      if (startedLock) {
        this.persistGameState();
      }
    }
  }

  private shiftGameDeadlines(duration: number): void {
    for (const deadline of [
      'gameDeadline',
      'challengeDeadline',
      'aiFinalChallengeDeadline',
      'revealDeadline',
    ] as const) {
      const value = this.gameState[deadline];
      if (value !== undefined) {
        this.gameState[deadline] = value + duration;
      }
    }
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
    if (
      this.gameState.revealDeadline !== undefined &&
      this.gameState.challengeRevealStartedAt === undefined
    ) {
      this.gameState.challengeRevealStartedAt = Date.now();
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
      this.gameState.gamePaused ||
      !!this.challengeResultMessage ||
      this.gameState.revealDeadline !== undefined ||
      this.isLocalTurnLocked
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
      !this.gameState.gameId ||
      !this.gameState.profileId
    ) {
      return;
    }

    const mode = this.hasAiOpponents ? 'computer' : 'human';
    const profilePlayerId = this.hasAiOpponents ? 'human' : 'human-1';
    const winnerIds = this.gameState.winnerIds ??
      (this.gameState.winnerId ? [this.gameState.winnerId] : []);
    const outcome = this.gameState.isDraw || winnerIds.length > 1
      ? 'draw'
      : winnerIds.includes(profilePlayerId)
        ? 'win'
        : 'loss';
    try {
      const recorded = await this.userService.recordGameResult(
        this.gameState.profileId,
        this.gameState.gameId,
        outcome,
        mode
      );
      this.gameState.rewardProcessed = true;
      this.rewardMessage = recorded
        ? mode === 'computer' && outcome === 'win'
          ? 'A győzelemért 15 érme került a profilodra.'
          : `A játék eredménye (${this.outcomeLabel(outcome)}) rögzítve lett a profilodon.`
        : 'A játék eredménye már korábban rögzítve lett.';
      this.persistGameState();
    } catch (error) {
      console.error('Nem sikerült rögzíteni a játék eredményét.', error);
      this.rewardMessage =
        'A játék véget ért, de az eredményt nem sikerült a profilhoz menteni.';
    }
  }

  private outcomeLabel(outcome: 'win' | 'loss' | 'draw'): string {
    switch (outcome) {
      case 'win':
        return 'győzelem';
      case 'draw':
        return 'döntetlen';
      case 'loss':
        return 'vereség';
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

    if (
      !this.isBrowser ||
      this.gameState.gamePaused ||
      !!this.challengeResultMessage ||
      this.isLocalTurnLocked
    ) {
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

    const revealStartedAt = this.gameState.challengeRevealStartedAt;
    if (revealStartedAt !== undefined) {
      this.shiftGameDeadlines(Math.max(0, Date.now() - revealStartedAt));
      this.gameState.challengeRevealStartedAt = undefined;
    }
    this.clearChallengeTimer();
    this.challengeResultMessage = wasBluff
      ? `Sikeres leleplezés! A blöffölő felvette a dobóhalmot. ` +
        `${this.currentPlayer.name} következik, a bemondás: ` +
        `${this.gameState.nextCardValue}.`
      : this.gameState.gameFinished
        ? `Téves kihívás! ${this.winnerName} megnyerte a játékot.`
        : `Téves kihívás! A kihívó felvette a dobóhalmot. ` +
          `${this.currentPlayer.name} következik, a bemondás: ` +
          `${this.gameState.nextCardValue}.`;
    this.challengeResultShownAt = this.gameState.gameFinished
      ? undefined
      : Date.now();
    this.persistGameState();
    if (this.gameState.gameFinished) {
      this.clearGameTimer();
      void this.processCompletedGame();
    } else {
      this.startGameTimer();
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
      !!this.challengeResultMessage ||
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
      !!this.challengeResultMessage ||
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