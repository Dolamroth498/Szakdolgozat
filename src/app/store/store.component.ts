import { Component, OnInit } from '@angular/core';
import { StoreService } from './store.service';
import { AuthService } from '../auth/auth.service'; // Ha van autentikációs szolgáltatás
import { StoreItem } from './store.item.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss'],
})
export class StoreComponent implements OnInit {

  items: StoreItem[] = [ ];

  userBalance: number = 0;

  constructor(private storeService: StoreService, private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Call a Firestore-dependent method from StoreService
    this.storeService.getItems().subscribe(
      (data) => {
        this.items = data; // Bind the received data to the component
        console.log('Store items:', this.items);
      },
      (error) => {
        console.error('Error fetching store items:', error);
      }
    );
    this.loadUserBalance();
  }

  async loadUserBalance() {
    // Az aktuális felhasználó ID-ja aszinkron lekérése
    const userId = await this.authService.getCurrentUserId(); 
    if (userId) {
      const userDoc = await this.storeService.getUserData(userId); // Feltételezve, hogy van getUserData metódus
      if (userDoc) {
        this.userBalance = userDoc.balance; // Frissítjük az egyenleget
      }
    } else {
      console.error('Nem sikerült lekérni a felhasználó ID-ját');
    }
  }
  
  async buyItem(item: StoreItem) {
    // Az aktuális felhasználó ID-ja aszinkron lekérése
    const userId = await this.authService.getCurrentUserId(); 
    if (userId) {
      const success = await this.storeService.buyItem(userId, item);
      if (success) {
        alert('Vásárlás sikeres!');
        this.loadUserBalance(); // Új egyenleg betöltése
      } else {
        alert('Nincs elég pénzed a vásárláshoz!');
      }
    } else {
      console.error('Nem sikerült lekérni a felhasználó ID-ját');
    }
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}
