import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { StoreComponent } from './store.component';
import { User } from '../user/user.model';
import { UserService } from '../user/user.service';

describe('StoreComponent', () => {
  const user: User = {
    id: 'user-1',
    name: 'Teszt Játékos',
    email: 'test@example.com',
    backgrounds: ['felt-green'],
    cardBacks: ['back-red'],
    selectedBackground: 'felt-green',
    selectedCardBack: 'back-red',
    coins: 20,
    points: 0,
    wins: 0,
    draws: 0,
    gamesPlayed: 0,
  };
  let userSubject: BehaviorSubject<User | null>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    userSubject = new BehaviorSubject<User | null>(user);
    userService = jasmine.createSpyObj<UserService>(
      'UserService',
      ['purchaseStoreItem', 'equipStoreItem'],
      { currentUser$: userSubject.asObservable() }
    );
    TestBed.configureTestingModule({
      imports: [StoreComponent],
      providers: [{ provide: UserService, useValue: userService }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('purchases an item and shows success feedback', async () => {
    userService.purchaseStoreItem.and.resolveTo();
    const fixture = TestBed.createComponent(StoreComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const item = component.items.find(candidate => candidate.id === 'felt-blue')!;

    await component.purchase(item);
    fixture.detectChanges();

    expect(userService.purchaseStoreItem).toHaveBeenCalledOnceWith('felt-blue');
    expect(component.successMessage).toContain('megvásárolva');
    expect(component.busyItemId).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('megvásárolva');
    fixture.destroy();
  });

  it('shows a clear message when the purchase is rejected for insufficient coins', async () => {
    userService.purchaseStoreItem.and.rejectWith(new Error('INSUFFICIENT_COINS'));
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(StoreComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const item = component.items.find(candidate => candidate.id === 'felt-night')!;

    await component.purchase(item);
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Nincs elég érméd ehhez a tárgyhoz.');
    expect(component.busyItemId).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Nincs elég érméd');
    fixture.destroy();
  });

  it('shows an already-owned purchase error without displaying success', async () => {
    userService.purchaseStoreItem.and.rejectWith(new Error('ALREADY_OWNED'));
    spyOn(console, 'error');
    const fixture = TestBed.createComponent(StoreComponent);
    const component = fixture.componentInstance;
    const item = component.items.find(candidate => candidate.id === 'felt-blue')!;

    await component.purchase(item);

    expect(component.errorMessage).toContain('már feloldottad');
    expect(component.successMessage).toBe('');
    fixture.destroy();
  });

  it('equips an owned item and shows success feedback', async () => {
    userService.equipStoreItem.and.resolveTo();
    const fixture = TestBed.createComponent(StoreComponent);
    const component = fixture.componentInstance;
    const item = component.items.find(candidate => candidate.id === 'felt-green')!;

    await component.equip(item);

    expect(userService.equipStoreItem).toHaveBeenCalledOnceWith('felt-green');
    expect(component.successMessage).toContain('használatban van');
    expect(component.busyItemId).toBeNull();
    fixture.destroy();
  });
});
