import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { LeaderboardEntry } from '../user/user.model';
import { UserService } from '../user/user.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss'],
})
export class LeaderboardComponent implements OnInit {
  entries: LeaderboardEntry[] = [];
  loading = true;
  error = '';

  private readonly isBrowser: boolean;

  constructor(
    private readonly userService: UserService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) {
      this.loading = false;
      return;
    }

    try {
      this.entries = await this.userService.loadLeaderboard();
    } catch (error) {
      console.error('Nem sikerült betölteni a ranglistát.', error);
      this.error = 'A ranglista betöltése nem sikerült. Próbáld újra később.';
    } finally {
      this.loading = false;
    }
  }
}
