import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LeaderboardComponent } from './leaderboard.component';
import { LeaderboardEntry } from '../user/user.model';
import { UserService } from '../user/user.service';

describe('LeaderboardComponent', () => {
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    userService = jasmine.createSpyObj<UserService>(
      'UserService',
      ['loadLeaderboard']
    );
    TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads and renders leaderboard entries', async () => {
    const entries: LeaderboardEntry[] = [{
      id: 'user-1',
      name: 'Teszt Játékos',
      points: 120,
      wins: 3,
      gamesPlayed: 4,
      winRate: 75,
    }];
    userService.loadLeaderboard.and.resolveTo(entries);
    const fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(userService.loadLeaderboard).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('tbody').textContent)
      .toContain('Teszt Játékos');
    expect(fixture.nativeElement.querySelector('tbody').textContent)
      .toContain('75%');
    expect(fixture.componentInstance.loading).toBeFalse();
    fixture.destroy();
  });

  it('shows an error when loading the leaderboard fails', async () => {
    userService.loadLeaderboard.and.rejectWith(new Error('offline'));
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(LeaderboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.error).toContain('nem sikerült');
    expect(fixture.componentInstance.loading).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    fixture.destroy();
  });

  it('does not request leaderboard data during server rendering', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const fixture = TestBed.createComponent(LeaderboardComponent);

    await fixture.componentInstance.ngOnInit();

    expect(userService.loadLeaderboard).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading).toBeFalse();
    fixture.destroy();
  });
});
