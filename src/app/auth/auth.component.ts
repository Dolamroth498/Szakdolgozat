import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { UserService } from '../user/user.service';


@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule,FormsModule, MatButtonModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent implements OnInit {
  action: string | null = null;
  id: string = '';
  name: string = '';
  email: string = '';
  password: string = '';
  /*balance: number = 0;
  backgrounds: string[] = [];
  cardBacks: string[] = [];
  leaderboardPosition: number = 0;
  points: number = 0;*/

  constructor(private route: ActivatedRoute, private authService: AuthService, private router: Router/*, private saveUserService: UserService*/) {}

  ngOnInit() {
    this.action = this.route.snapshot.paramMap.get('action');
  }

  login() {
    if (this.name && this.password) {
      this.authService.login();
      this.router.navigate(['/']);
    }
  }

  register() {
    if (this.name && this.email && this.password) {
      //this.saveUserService.saveNewUser(this.id, this.name, this.email, this.password, this.balance, this.backgrounds, this.cardBacks, this.leaderboardPosition, this.points);
      this.authService.login();
      this.router.navigate(['/']);
    }
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}
