import { Component } from '@angular/core';
import { Router, RouterOutlet} from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent {
  constructor(private authService: AuthService, private router: Router) {}

  get isLoggedIn() {
    return this.authService.isLoggedIn();
  }

  startGame(opponent: string) {
    this.router.navigate(['/game'], { queryParams: { opponent } });
  }

  public openStore(): void{
    this.router.navigateByUrl('store');
  }

  public goLeaderboard(): void{
    this.router.navigateByUrl('leaderboard');
  }

  public goUser(): void {
    this.router.navigateByUrl('user');
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
