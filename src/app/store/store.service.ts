import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, getDoc, collection, collectionData} from '@angular/fire/firestore';
import { User } from '../user/user.model'; // Felhasználói adatmodell
import { StoreItem } from './store.item.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  getUserData(_userId: String): Promise<User>{
    throw new Error('Method not implemented.');
  }
  constructor(private firestore: Firestore) {}

  getItems(): Observable<any[]> {
    // Replace 'items' with your Firestore collection name
    const collectionRef = collection(this.firestore, 'items');
    return collectionData(collectionRef, { idField: 'id' }); // Include IDs if needed
  }

  async buyItem(userId: string, item: StoreItem): Promise<boolean> {
    const userRef = doc(this.firestore, `users/${userId}`);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      const userData: User = userSnapshot.data() as User;
      const currentBalance = userData.balance || 0;

      // Ellenőrizzük, hogy van elég pénze a felhasználónak a vásárláshoz
      if (currentBalance >= item.price) {
        // Levonjuk a pénzt
        const newBalance = currentBalance - item.price;

        // Hozzáadjuk a vásárolt elem típusát a megfelelő listához
        const updatedUser = { ...userData };
        if (item.type === 'background') {
          updatedUser.backgrounds.push(item.name); // Háttér hozzáadása
        } else if (item.type === 'cardBack') {
          updatedUser.cardBacks.push(item.name); // Kártya hátlap hozzáadása
        }

        // Frissítjük a felhasználói adatokat a Firestore-ban
        await updateDoc(userRef, {
          balance: newBalance,
          backgrounds: updatedUser.backgrounds,
          cardBacks: updatedUser.cardBacks,
        });

        return true; // Vásárlás sikeres
      } else {
        return false; // Nincs elég pénz
      }
    }
    return false; // Felhasználó nem található
  }
}
