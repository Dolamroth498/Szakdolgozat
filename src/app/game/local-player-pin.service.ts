import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface PinCredential {
  salt: string;
  hash: string;
}

interface StoredPinCredentials {
  gameId: string;
  players: Record<string, PinCredential>;
}

@Injectable({
  providedIn: 'root',
})
export class LocalPlayerPinService {
  private readonly storageKey = 'svindli-local-player-pins-v1';
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  hasPin(gameId: string, playerId: string): boolean {
    return !!this.readCredentials(gameId)?.players[playerId];
  }

  async savePins(gameId: string, pins: Record<string, string>): Promise<void> {
    const players: Record<string, PinCredential> = {};
    for (const [playerId, pin] of Object.entries(pins)) {
      players[playerId] = await this.createCredential(pin);
    }

    this.writeCredentials({ gameId, players });
  }

  async setPin(gameId: string, playerId: string, pin: string): Promise<void> {
    const stored = this.readCredentials(gameId) ?? { gameId, players: {} };
    stored.players[playerId] = await this.createCredential(pin);
    this.writeCredentials(stored);
  }

  async verifyPin(
    gameId: string,
    playerId: string,
    pin: string
  ): Promise<boolean> {
    const credential = this.readCredentials(gameId)?.players[playerId];
    if (!credential) {
      return false;
    }

    return (await this.hashPin(credential.salt, pin)) === credential.hash;
  }

  private async createCredential(pin: string): Promise<PinCredential> {
    if (!this.isBrowser || !globalThis.crypto?.subtle) {
      throw new Error('A PIN-védelemhez biztonságos böngészőkörnyezet szükséges.');
    }

    const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const salt = Array.from(saltBytes, byte =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    return { salt, hash: await this.hashPin(salt, pin) };
  }

  private async hashPin(salt: string, pin: string): Promise<string> {
    if (!globalThis.crypto?.subtle) {
      throw new Error('A PIN ellenőrzéséhez biztonságos böngészőkörnyezet szükséges.');
    }

    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${salt}:${pin}`)
    );
    return Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  private readCredentials(gameId: string): StoredPinCredentials | null {
    if (!this.isBrowser) {
      return null;
    }

    const serialized = window.localStorage.getItem(this.storageKey);
    if (serialized === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('gameId' in parsed) ||
      !('players' in parsed) ||
      typeof parsed.gameId !== 'string' ||
      typeof parsed.players !== 'object' ||
      parsed.players === null
    ) {
      throw new Error('A helyi játékos-PIN-ek mentett formátuma érvénytelen.');
    }

    const credentials = parsed as StoredPinCredentials;
    return credentials.gameId === gameId ? credentials : null;
  }

  private writeCredentials(credentials: StoredPinCredentials): void {
    if (!this.isBrowser) {
      throw new Error('A helyi játékos-PIN-ek csak böngészőben menthetők.');
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(credentials));
  }
}
