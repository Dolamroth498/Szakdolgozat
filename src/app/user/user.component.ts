import { Component } from '@angular/core';
import { UserService } from './user.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent {
  readonly user$: UserService['currentUser$'];
  readonly loading$: UserService['loading$'];
  readonly error$: UserService['error$'];

  constructor(private readonly userService: UserService) {
    this.user$ = this.userService.currentUser$;
    this.loading$ = this.userService.loading$;
    this.error$ = this.userService.error$;
  }
}
