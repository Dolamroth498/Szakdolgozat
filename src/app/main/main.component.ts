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
  readonly user$: AuthService['user$'];

  constructor(private readonly authService: AuthService, private readonly router: Router) {
    this.user$ = this.authService.user$;
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

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      await this.router.navigateByUrl('/main');
    } catch (error) {
      console.error('Firebase sign-out failed.', error);
      alert('A kijelentkezés nem sikerült. Próbáld újra.');
    }
  }
}
