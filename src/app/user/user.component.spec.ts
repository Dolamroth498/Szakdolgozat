import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { UserComponent } from './user.component';
import { User } from './user.model';
import { UserService } from './user.service';

describe('UserComponent', () => {
  it('renders profile statistics, rewards, and owned customization items', () => {
    const userSubject = new BehaviorSubject<User | null>({
      id: 'user-1',
      name: 'Teszt Játékos',
      email: 'test@example.com',
      backgrounds: ['felt-green', 'felt-blue'],
      cardBacks: ['back-red'],
      selectedBackground: 'felt-blue',
      selectedCardBack: 'back-red',
      coins: 45,
      points: 120,
      wins: 3,
      draws: 1,
      gamesPlayed: 5,
    });
    const loadingSubject = new BehaviorSubject(false);
    const errorSubject = new BehaviorSubject<string | null>(null);
    TestBed.configureTestingModule({
      imports: [UserComponent],
      providers: [{
        provide: UserService,
        useValue: {
          currentUser$: userSubject.asObservable(),
          loading$: loadingSubject.asObservable(),
          error$: errorSubject.asObservable(),
        },
      }],
    });
    const fixture = TestBed.createComponent(UserComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Teszt Játékos');
    expect(text).toContain('45');
    expect(text).toContain('120');
    expect(text).toContain('3');
    expect(text).toContain('felt-blue');
    expect(text).toContain('back-red');
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('renders profile loading and service error states', () => {
    const userSubject = new BehaviorSubject<User | null>(null);
    const loadingSubject = new BehaviorSubject(true);
    const errorSubject = new BehaviorSubject<string | null>('Profilbetöltési hiba.');
    TestBed.configureTestingModule({
      imports: [UserComponent],
      providers: [{
        provide: UserService,
        useValue: {
          currentUser$: userSubject.asObservable(),
          loading$: loadingSubject.asObservable(),
          error$: errorSubject.asObservable(),
        },
      }],
    });
    const fixture = TestBed.createComponent(UserComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Profil betöltése');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Profilbetöltési hiba.');
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
