import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  Firestore,
  getDocs,
  query,
} from '@angular/fire/firestore';
import { catchError, from, map, Observable, of } from 'rxjs';
import { User } from './user/user.model';

@Injectable({
  providedIn: 'root',
})
export class SaveUserService {
  private readonly collectionName = 'users';

  constructor(private readonly fireStore: Firestore) {}

  public saveUser(user: User): Observable<any> {
    return from(addDoc(collection(this.fireStore, this.collectionName), user));
  }
}