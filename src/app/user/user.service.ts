import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { User as FirebaseUser } from '@angular/fire/auth';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, catchError, defer, finalize, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { User } from './user.model';

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
              this.errorSubject.next('Nem sikerült betölteni a profilodat. Próbáld újra később.');
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
      if (typeof profile['name'] !== 'string' || typeof profile['email'] !== 'string') {
        throw new Error(`Invalid profile document for user ${authUser.uid}.`);
      }

      return {
        id: authUser.uid,
        name: profile['name'],
        email: profile['email'],
      };
    }

    const profile: User = {
      id: authUser.uid,
      name: authUser.displayName?.trim() || 'Játékos',
      email: authUser.email ?? '',
    };

    await setDoc(profileRef, {
      name: profile.name,
      email: profile.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return profile;
  }
}
