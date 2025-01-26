import { Component, OnInit } from '@angular/core';
import { UserService } from './user.service';
import { User } from './user.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SaveUserService } from '../saveuser.service';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
  user: User | null = null;

  constructor(private userService: UserService, private router: Router/*, private saveUserService: SaveUserService*/) {}

  /*saveNewUser(id: string, name: string, email: string, password: string, balance: number, backgrounds: string[], cardBacks: string[], leaderboardPosition: number, points: number) {
    const newUser : User ={
      id: '',
      name: '',
      email: '',
      password: '',
      balance: 0,
      backgrounds: [],
      cardBacks: [],
      leaderboardPosition: 0,
      points: 0
    }

    this.saveUserService.saveUser(newUser).subscribe({
      next: (response) => console.log('User saved successfully:', response),
      error: (err) => console.error('Error saving user:', err),
    });
  }*/

  ngOnInit() {
    // Felhasználói adatokat töltünk be
    this.userService.currentUser$.subscribe((user) => {
      this.user = user;
    });
  }

  // Vásárlás metódus
  buyItem(item: string,type: 'background' | 'cardBack', price: number) {
    const success = this.userService.buyItem(item, type, price);
    if (success) {
      alert('Vásárlás sikeres!');
    } else {
      alert('Nincs elég pénzed a vásárláshoz!');
    }
  }

  // Pontok frissítése
  updatePoints(points: number) {
    this.userService.updatePoints(points);
  }

  // Ranglista hely frissítése
  updateLeaderboardPosition(position: number) {
    this.userService.updateLeaderboardPosition(position);
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}

