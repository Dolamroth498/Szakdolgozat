import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { GameState } from './game/game.state.model';

@Injectable({
  providedIn: 'root',
})
export class OfflineService {
  private readonly databaseName = 'svindli-db';
  private readonly objectStoreName = 'game-states';
  private db!: IDBDatabase;

  constructor() {
    this.initIndexedDB().then((db) => (this.db = db));
  }

  private initIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.objectStoreName)) {
          const objectStore = db.createObjectStore(this.objectStoreName, {
            keyPath: 'id',
          });
          objectStore.createIndex('synced', 'synced', { unique: false });
        }
      };

      request.onsuccess = (event: any) => resolve(event.target.result);
      request.onerror = (event) => reject(event);
    });
  }

  public saveGameState(gameState: GameState): Observable<GameState> {
    return from(
      new Promise<GameState>((resolve, reject) => {
        this.openObjectStore('readwrite').then((store) => {
          const request = store.add({ ...gameState, synced: false });
          request.onsuccess = () => resolve(gameState);
          request.onerror = (event) => reject(event);
        });
      })
    );
  }

  public updateGameState(gameState: GameState): Observable<GameState> {
    return from(
      new Promise<GameState>((resolve, reject) => {
        this.openObjectStore('readwrite').then((store) => {
          const request = store.put({ ...gameState, synced: true });
          request.onsuccess = () => resolve(gameState);
          request.onerror = (event) => reject(event);
        });
      })
    );
  }

  public getGameStates(): Observable<GameState[]> {
    return from(
      new Promise<GameState[]>((resolve, reject) => {
        this.openObjectStore('readonly').then((store) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = (event) => reject(event);
        });
      })
    );
  }

  public getUnsyncedGameStates(): Observable<GameState[]> {
    return from(
      new Promise<GameState[]>((resolve) => {
        this.openObjectStore('readonly').then((store) => {
          const unsynced: GameState[] = [];
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = function (event: any) {
            const cursor = event.target.result;
            if (cursor) {
              if (!cursor.value.synced) {
                unsynced.push(cursor.value);
              }
              cursor.continue();
            } else {
              resolve(unsynced);
            }
          };
        });
      })
    );
  }

  private openObjectStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return new Promise<IDBObjectStore>((resolve, reject) => {
      if (!this.db) {
        this.initIndexedDB().then(() => {
          const transaction = this.db.transaction(this.objectStoreName, mode);
          resolve(transaction.objectStore(this.objectStoreName));
        });
      } else {
        const transaction = this.db.transaction(this.objectStoreName, mode);
        resolve(transaction.objectStore(this.objectStoreName));
      }
    });
  }
}
