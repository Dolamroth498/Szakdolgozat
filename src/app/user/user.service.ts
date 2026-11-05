import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, isDevMode, PLATFORM_ID } from '@angular/core';
import { User as FirebaseUser } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import {
  BehaviorSubject,
  catchError,
  defer,
  filter,
  finalize,
  firstValueFrom,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { LeaderboardEntry, User } from './user.model';
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_CARD_BACK_ID,
  STORE_ITEMS,
} from '../store/store.catalog';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly firestore = isPlatformBrowser(inject(PLATFORM_ID)) ? inject(Firestore) : null;

  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject(true);
  readonly loading$ = this.loadingSubject.asObservable();

  private readonly errorSubject = new BehaviorSubject<string | null>(null);
  readonly error$ = this.errorSubject.asObservable();

  get currentUserSnapshot(): User | null {
    return this.userSubject.value;
  }

  async getCurrentUserIdWhenReady(): Promise<string | undefined> {
    await firstValueFrom(
      this.loading$.pipe(
        filter(loading => !loading),
        take(1)
      )
    );
    return this.currentUserSnapshot?.id;
  }

  constructor(authService: AuthService) {
    authService.user$
      .pipe(
        tap(() => this.errorSubject.next(null)),
        switchMap(authUser => {
          if (!authUser) {
            this.loadingSubject.next(false);
            return of(null);
          }

          if (!this.firestore) {
            this.loadingSubject.next(false);
            return of(null);
          }

          this.loadingSubject.next(true);
          const firestore = this.firestore;
          return defer(() => this.loadOrCreateProfile(authUser, firestore)).pipe(
            catchError(error => {
              console.error('Failed to load the signed-in user profile.', error);
              this.errorSubject.next(this.profileLoadErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loadingSubject.next(false))
          );
        })
      )
      .subscribe(user => this.userSubject.next(user));
  }

  private async loadOrCreateProfile(authUser: FirebaseUser, firestore: Firestore): Promise<User> {
    const profileRef = doc(firestore, 'users', authUser.uid);
    const profileSnapshot = await getDoc(profileRef);

    if (profileSnapshot.exists()) {
      const profile = profileSnapshot.data();
      const storedBackgrounds = this.isStringArray(profile['backgrounds'])
        ? profile['backgrounds']
        : [];
      const storedCardBacks = this.isStringArray(profile['cardBacks'])
        ? profile['cardBacks']
        : [];
      const backgrounds = [...new Set([DEFAULT_BACKGROUND_ID, ...storedBackgrounds])];
      const cardBacks = [...new Set([DEFAULT_CARD_BACK_ID, ...storedCardBacks])];
      const selectedBackground = this.getSelectedStoreItemId(
        profile['selectedBackground'],
        'background',
        backgrounds
      );
      const selectedCardBack = this.getSelectedStoreItemId(
        profile['selectedCardBack'],
        'cardBack',
        cardBacks
      );
      const missingStats = ['coins', 'points', 'wins', 'draws', 'gamesPlayed']
        .filter(field => profile[field] === undefined);
      const hasInvalidStats = ['coins', 'points', 'wins', 'draws', 'gamesPlayed']
        .some(field => profile[field] !== undefined && !this.isValidStat(profile[field]));

      if (
        typeof profile['name'] !== 'string' ||
        typeof profile['email'] !== 'string' ||
        (profile['backgrounds'] !== undefined && !this.isStringArray(profile['backgrounds'])) ||
        (profile['cardBacks'] !== undefined && !this.isStringArray(profile['cardBacks'])) ||
        hasInvalidStats
      ) {
        if (hasInvalidStats) {
          throw new Error(`Invalid profile statistics for user ${authUser.uid}.`);
        }

        if (
          typeof profile['name'] !== 'string' ||
          typeof profile['email'] !== 'string' ||
          (profile['backgrounds'] !== undefined && !this.isStringArray(profile['backgrounds'])) ||
          (profile['cardBacks'] !== undefined && !this.isStringArray(profile['cardBacks']))
        ) {
          throw new Error(`Invalid profile document for user ${authUser.uid}.`);
        }
      }

      if (
        missingStats.length > 0 ||
        JSON.stringify(profile['backgrounds']) !== JSON.stringify(backgrounds) ||
        JSON.stringify(profile['cardBacks']) !== JSON.stringify(cardBacks) ||
        profile['selectedBackground'] !== selectedBackground ||
        profile['selectedCardBack'] !== selectedCardBack
      ) {
        await updateDoc(profileRef, {
          ...Object.fromEntries(missingStats.map(field => [field, 0])),
          backgrounds,
          cardBacks,
          selectedBackground,
          selectedCardBack,
          updatedAt: serverTimestamp(),
        });
      }

      const loadedProfile: User = {
        id: authUser.uid,
        name: profile['name'],
        email: profile['email'],
        backgrounds,
        cardBacks,
        selectedBackground,
        selectedCardBack,
        coins: this.statOrZero(profile['coins']),
        points: this.statOrZero(profile['points']),
        wins: this.statOrZero(profile['wins']),
        draws: this.statOrZero(profile['draws']),
        gamesPlayed: this.statOrZero(profile['gamesPlayed']),
      };
      await this.ensureLeaderboardEntrySafely(loadedProfile, firestore);
      return loadedProfile;
    }

    const profile: User = {
      id: authUser.uid,
      name: authUser.displayName?.trim() || 'Játékos',
      email: authUser.email ?? '',
      backgrounds: [DEFAULT_BACKGROUND_ID],
      cardBacks: [DEFAULT_CARD_BACK_ID],
      selectedBackground: DEFAULT_BACKGROUND_ID,
      selectedCardBack: DEFAULT_CARD_BACK_ID,
      coins: 0,
      points: 0,
      wins: 0,
      draws: 0,
      gamesPlayed: 0,
    };

    await setDoc(profileRef, {
      name: profile.name,
      email: profile.email,
      backgrounds: profile.backgrounds,
      cardBacks: profile.cardBacks,
      selectedBackground: profile.selectedBackground,
      selectedCardBack: profile.selectedCardBack,
      coins: profile.coins,
      points: profile.points,
      wins: profile.wins,
      draws: profile.draws,
      gamesPlayed: profile.gamesPlayed,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.ensureLeaderboardEntrySafely(profile, firestore);

    return profile;
  }

  async recordAiGameResult(
    userId: string,
    gameId: string,
    outcome: 'win' | 'loss' | 'draw'
  ): Promise<boolean> {
    return this.recordGameResult(userId, gameId, outcome, 'computer');
  }

  async recordGameResult(
    userId: string,
    gameId: string,
    outcome: 'win' | 'loss' | 'draw',
    mode: 'computer' | 'human'
  ): Promise<boolean> {
    if (!this.firestore) {
      throw new Error('Firestore is unavailable outside the browser.');
    }

    const firestore = this.firestore;
    const profileRef = doc(firestore, 'users', userId);
    const resultRef = doc(firestore, 'users', userId, 'completedGames', gameId);
    const leaderboardRef = doc(firestore, 'leaderboard', userId);

    const updatedUser = await runTransaction(firestore, async transaction => {
      const [profileSnapshot, resultSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(resultRef),
      ]);
      if (!profileSnapshot.exists()) {
        throw new Error('The player profile no longer exists.');
      }
      if (resultSnapshot.exists()) {
        return null;
      }

      const profile = profileSnapshot.data();
      const won = outcome === 'win';
      const draw = outcome === 'draw';
      const coinReward = mode === 'computer' && won ? 15 : 0;
      const coins = this.statOrZero(profile['coins']) + coinReward;
      const points = this.statOrZero(profile['points']);
      const wins = this.statOrZero(profile['wins']) + (won ? 1 : 0);
      const draws = this.statOrZero(profile['draws']) + (draw ? 1 : 0);
      const gamesPlayed = this.statOrZero(profile['gamesPlayed']) + 1;

      transaction.update(profileRef, {
        coins: increment(coinReward),
        points: increment(0),
        wins: increment(won ? 1 : 0),
        draws: increment(draw ? 1 : 0),
        gamesPlayed: increment(1),
        updatedAt: serverTimestamp(),
      });
      transaction.set(resultRef, {
        outcome,
        mode,
        createdAt: serverTimestamp(),
      });
      transaction.set(leaderboardRef, {
        name: profile['name'],
        points,
        wins,
        gamesPlayed,
        updatedAt: serverTimestamp(),
      });

      return {
        id: userId,
        name: typeof profile['name'] === 'string' ? profile['name'] : 'Játékos',
        email: typeof profile['email'] === 'string' ? profile['email'] : '',
        backgrounds: this.isStringArray(profile['backgrounds'])
          ? profile['backgrounds']
          : [],
        cardBacks: this.isStringArray(profile['cardBacks'])
          ? profile['cardBacks']
          : [],
        selectedBackground: typeof profile['selectedBackground'] === 'string'
          ? profile['selectedBackground']
          : null,
        selectedCardBack: typeof profile['selectedCardBack'] === 'string'
          ? profile['selectedCardBack']
          : null,
        coins,
        points,
        wins,
        draws,
        gamesPlayed,
      };
    });

    if (updatedUser) {
      this.userSubject.next(updatedUser);
      return true;
    }
    return false;
  }

  async purchaseStoreItem(itemId: string): Promise<void> {
    const item = STORE_ITEMS.find(entry => entry.id === itemId);
    if (!item) {
      throw new Error('Unknown store item.');
    }
    if (item.price === 0) {
      throw new Error('ALREADY_OWNED');
    }
    if (!this.firestore) {
      throw new Error('Firestore is unavailable outside the browser.');
    }

    const profileRef = doc(this.firestore, 'users', this.requireCurrentUserId());
    const updatedUser = await runTransaction(this.firestore, async transaction => {
      const profileSnapshot = await transaction.get(profileRef);
      if (!profileSnapshot.exists()) {
        throw new Error('The player profile no longer exists.');
      }

      const profile = profileSnapshot.data();
      const field = item.category === 'background' ? 'backgrounds' : 'cardBacks';
      const inventory = this.isStringArray(profile[field]) ? profile[field] : [];
      if (inventory.includes(item.id)) {
        throw new Error('ALREADY_OWNED');
      }
      const coins = this.statOrZero(profile['coins']);
      if (coins < item.price) {
        throw new Error('INSUFFICIENT_COINS');
      }

      const updatedInventory = [...inventory, item.id];
      transaction.update(profileRef, {
        coins: coins - item.price,
        [field]: updatedInventory,
        updatedAt: serverTimestamp(),
      });

      return this.profileWithChanges(profileSnapshot.data(), {
        [field]: updatedInventory,
        coins: coins - item.price,
      });
    });
    this.userSubject.next(updatedUser);
  }

  async equipStoreItem(itemId: string): Promise<void> {
    const item = STORE_ITEMS.find(entry => entry.id === itemId);
    if (!item) {
      throw new Error('Unknown store item.');
    }
    if (!this.firestore) {
      throw new Error('Firestore is unavailable outside the browser.');
    }

    const profileRef = doc(this.firestore, 'users', this.requireCurrentUserId());
    const updatedUser = await runTransaction(this.firestore, async transaction => {
      const profileSnapshot = await transaction.get(profileRef);
      if (!profileSnapshot.exists()) {
        throw new Error('The player profile no longer exists.');
      }

      const profile = profileSnapshot.data();
      const inventoryField = item.category === 'background' ? 'backgrounds' : 'cardBacks';
      const inventory = this.isStringArray(profile[inventoryField])
        ? profile[inventoryField]
        : [];
      if (!inventory.includes(item.id) && item.price !== 0) {
        throw new Error('The store item has not been purchased.');
      }

      const selectedField = item.category === 'background'
        ? 'selectedBackground'
        : 'selectedCardBack';
      transaction.update(profileRef, {
        [selectedField]: item.id,
        updatedAt: serverTimestamp(),
      });

      return this.profileWithChanges(profile, { [selectedField]: item.id });
    });
    this.userSubject.next(updatedUser);
  }

  async loadLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!this.firestore) {
      throw new Error('Firestore is unavailable outside the browser.');
    }

    const leaderboardQuery = query(
      collection(this.firestore, 'leaderboard'),
      orderBy('points', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(leaderboardQuery);
    return snapshot.docs.map(entry => {
      const data = entry.data();
      const wins = this.statOrZero(data['wins']);
      const gamesPlayed = this.statOrZero(data['gamesPlayed']);
      return {
        id: entry.id,
        name: typeof data['name'] === 'string' ? data['name'] : 'Játékos',
        points: this.statOrZero(data['points']),
        wins,
        gamesPlayed,
        winRate: gamesPlayed === 0 ? 0 : (wins / gamesPlayed) * 100,
      };
    });
  }

  private async ensureLeaderboardEntry(
    profile: User,
    firestore: Firestore
  ): Promise<void> {
    const leaderboardRef = doc(firestore, 'leaderboard', profile.id);
    const existing = await getDoc(leaderboardRef);
    if (!existing.exists()) {
      await setDoc(leaderboardRef, {
        name: profile.name,
        points: profile.points,
        wins: profile.wins,
        gamesPlayed: profile.gamesPlayed,
        updatedAt: serverTimestamp(),
      });
    }
  }

  private async ensureLeaderboardEntrySafely(
    profile: User,
    firestore: Firestore
  ): Promise<void> {
    try {
      await this.ensureLeaderboardEntry(profile, firestore);
    } catch (error) {
      console.error('Failed to create the user leaderboard entry.', error);
      this.errorSubject.next(
        'A profil betöltődött, de a ranglista-bejegyzés mentése nem sikerült. Ellenőrizd az éles Firestore-szabályokat.'
      );
    }
  }

  private isValidStat(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  private statOrZero(value: unknown): number {
    return this.isValidStat(value) ? value : 0;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
  }

  private getSelectedStoreItemId(
    selectedId: unknown,
    category: 'background' | 'cardBack',
    ownedItems: string[]
  ): string {
    const defaultId = category === 'background'
      ? DEFAULT_BACKGROUND_ID
      : DEFAULT_CARD_BACK_ID;
    const item = typeof selectedId === 'string'
      ? STORE_ITEMS.find(entry => entry.id === selectedId && entry.category === category)
      : undefined;
    return item && (item.price === 0 || ownedItems.includes(item.id))
      ? item.id
      : defaultId;
  }

  private profileLoadErrorMessage(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
    if (code === 'permission-denied') {
      return isDevMode()
        ? 'A Firestore megtagadta a profil elérését. Ellenőrizd, hogy fut-e az emulátor a 8080-as porton, majd jelentkezz ki és vissza a friss hitelesítéshez.'
        : 'A Firestore megtagadta a profil elérését. Ellenőrizd, hogy az éles Firebase-projekten telepítve vannak-e a legfrissebb Firestore-szabályok, és jelentkezz ki, majd vissza.';
    }
    if (code === 'unavailable' || code === 'failed-precondition') {
      return isDevMode()
        ? 'A Firestore nem érhető el. Fejlesztői módban indítsd el az emulátort: npm run emulator:firestore.'
        : 'A Firestore nem érhető el. Ellenőrizd a hálózati kapcsolatot és a Firebase-projekt állapotát.';
    }
    return 'Nem sikerült betölteni a profilodat. Ellenőrizd a Firebase-kapcsolatot, majd próbáld újra.';
  }

  private requireCurrentUserId(): string {
    const userId = this.currentUserSnapshot?.id;
    if (!userId) {
      throw new Error('A bejelentkezett profil nem érhető el.');
    }
    return userId;
  }

  private profileWithChanges(
    profile: Record<string, unknown>,
    changes: Record<string, unknown>
  ): User {
    const data = { ...profile, ...changes };
    const userId = this.requireCurrentUserId();
    return {
      id: userId,
      name: typeof data['name'] === 'string' ? data['name'] : 'Játékos',
      email: typeof data['email'] === 'string' ? data['email'] : '',
      backgrounds: this.isStringArray(data['backgrounds']) ? data['backgrounds'] : [],
      cardBacks: this.isStringArray(data['cardBacks']) ? data['cardBacks'] : [],
      selectedBackground: typeof data['selectedBackground'] === 'string'
        ? data['selectedBackground']
        : null,
      selectedCardBack: typeof data['selectedCardBack'] === 'string'
        ? data['selectedCardBack']
        : null,
      coins: this.statOrZero(data['coins']),
      points: this.statOrZero(data['points']),
      wins: this.statOrZero(data['wins']),
      draws: this.statOrZero(data['draws']),
      gamesPlayed: this.statOrZero(data['gamesPlayed']),
    };
  }
}
