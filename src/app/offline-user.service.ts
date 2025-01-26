import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { User } from './user/user.model';

@Injectable({
  providedIn: 'root',
})
export class OfflineUserService {
  private readonly databaseName = 'svindli-db';
  private readonly objectStoreName = 'user';
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

  public saveUser(user: User): Observable<User> {
    return from(
      new Promise<User>((resolve, reject) => {
        this.openObjectStore('readwrite').then((store) => {
          const request = store.add({ ...user, synced: false });
          request.onsuccess = () => resolve(user);
          request.onerror = (event) => reject(event);
        });
      })
    );
  }

  public updateUser(user: User): Observable<User> {
    return from(
      new Promise<User>((resolve, reject) => {
        this.openObjectStore('readwrite').then((store) => {
          const request = store.put({ ...user, synced: true });
          request.onsuccess = () => resolve(user);
          request.onerror = (event) => reject(event);
        });
      })
    );
  }

  public getUsers(): Observable<User[]> {
    return from(
      new Promise<User[]>((resolve, reject) => {
        this.openObjectStore('readonly').then((store) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = (event) => reject(event);
        });
      })
    );
  }

  public getUnsyncedUsers(): Observable<User[]> {
    return from(
      new Promise<User[]>((resolve) => {
        this.openObjectStore('readonly').then((store) => {
          const unsynced: User[] = [];
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