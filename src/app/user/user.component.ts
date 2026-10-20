import { Component } from '@angular/core';
import { UserService } from './user.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent {
  readonly user$: UserService['currentUser$'];
  readonly loading$: UserService['loading$'];
  readonly error$: UserService['error$'];

  constructor(private readonly userService: UserService, private readonly router: Router) {
    this.user$ = this.userService.currentUser$;
    this.loading$ = this.userService.loading$;
    this.error$ = this.userService.error$;
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}
