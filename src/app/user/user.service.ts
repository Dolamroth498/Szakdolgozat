import { Injectable } from '@angular/core';
import { User } from './user.model';
import { BehaviorSubject, forkJoin, Observable, switchMap, tap } from 'rxjs';
import { SaveUserService } from '../saveuser.service';
import { OfflineUserService } from '../offline-user.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  /*constructor(private readonly saveUserService: SaveUserService, private readonly offlineUserService: OfflineUserService) {}

  public saveNewUser(id: string, name: string, email: string, password: string, balance: number, backgrounds: string[], cardBacks: string[], leaderboardPosition: number, points: number){
    
  }

  public saveUser(user: User): Observable<any> {
    if (navigator.onLine) {
      return this.saveUserService.saveUser(user);
    } else {
      return this.offlineUserService.saveUser(user);
    }
  }*/
  
  // A felhasználó adatainak tárolása
  private userSubject = new BehaviorSubject<User>({
    id: 'user123',
    name: 'John Doe',
    email: 'johndoe@example.com',
    password: 'hashedpassword123', // Jelszót mindig hash-eld!
    balance: 100, // Kezdő egyenleg
    backgrounds: [], // Vásárolt háttér képek
    cardBacks: [], // Vásárolt kártya hátlapok
    leaderboardPosition: 1, // Kezdő ranglista hely
    points: 0, // Kezdő pontszám
  });

  // A felhasználó adatai megfigyelhetők egy Observable segítségével
  currentUser$ = this.userSubject.asObservable();

  // Felhasználó adatainak frissítése
  updateUser(user: User) {
    this.userSubject.next(user); // Új felhasználói adatok beállítása
  }

  // Vásárlás végrehajtása
  buyItem(item: string, type: 'background' | 'cardBack', price: number) {
    const user = this.userSubject.value;

    if (user.balance >= price) {
      user.balance -= price; // Levonjuk a pénzt
      if(type == 'background'){
        user.backgrounds.push(item); // Hozzáadjuk a vásárolt elemet
      } else{
        user.cardBacks.push(item); // Hozzáadjuk a vásárolt elemet
      }
      
      this.updateUser(user); // Frissítjük az adatokat
      return true; // Vásárlás sikeres
    } else {
      return false; // Nincs elég pénz a vásárláshoz
    }
  }

  // A felhasználó pontjainak frissítése
  updatePoints(points: number) {
    const user = this.userSubject.value;
    user.points += points;
    this.updateUser(user); // Frissítjük az adatokat
  }

  // Felhasználó rangjának frissítése
  updateLeaderboardPosition(position: number) {
    const user = this.userSubject.value;
    user.leaderboardPosition = position;
    this.updateUser(user); // Frissítjük az adatokat
  }

  /*private setupOfflineSync(): void {
    window.addEventListener('online', () => {
      this.syncUnsyncedUsers().subscribe(() => this.currentUser$);
    });
  }

  private syncUnsyncedUsers(): Observable<any> {
    return this.offlineUserService
      .getUnsyncedUsers()
      .pipe(
        switchMap((unsyncedUsers) =>
          forkJoin(
            unsyncedUsers.map((unsyncedUser) =>
              this.saveUserService
                .saveUser(unsyncedUser)
                .pipe(
                  tap(() => this.offlineUserService.updateUser(unsyncedUser))
                )
            )
          )
        )
      );
  }*/
}
