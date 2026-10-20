import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, User as FirebaseUser } from '@angular/fire/auth';
import { firstValueFrom, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = isPlatformBrowser(inject(PLATFORM_ID)) ? inject(Auth) : null;
  readonly user$: Observable<FirebaseUser | null> = this.auth ? authState(this.auth) : of(null);

  async getCurrentUserId(): Promise<string> {
    const user = await firstValueFrom(this.user$);
    if (!user) {
      throw new Error('No user is currently signed in.');
    }
    return user.uid;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.requireAuth(), email, password);
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.requireAuth(), email, password);
    await updateProfile(credential.user, { displayName: name });
  }

  async logout(): Promise<void> {
    await signOut(this.requireAuth());
  }

  private requireAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase Authentication is only available in the browser.');
    }
    return this.auth;
  }
}
