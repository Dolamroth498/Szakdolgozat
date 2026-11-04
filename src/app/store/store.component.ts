import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { UserService } from '../user/user.service';
import { STORE_ITEMS, StoreCategory, StoreItem } from './store.catalog';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss'],
})
export class StoreComponent {
  readonly items = STORE_ITEMS;
  readonly user$: UserService['currentUser$'];
  activeCategory: StoreCategory = 'background';
  busyItemId: string | null = null;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly userService: UserService
  ) {
    this.user$ = this.userService.currentUser$;
  }

  get visibleItems(): StoreItem[] {
    return this.items.filter(item => item.category === this.activeCategory);
  }

  isOwned(item: StoreItem, ownedBackgrounds: string[], ownedCardBacks: string[]): boolean {
    return item.price === 0 ||
      (item.category === 'background' ? ownedBackgrounds : ownedCardBacks)
        .includes(item.id);
  }

  isEquipped(item: StoreItem, selectedBackground: string | null, selectedCardBack: string | null): boolean {
    return item.category === 'background'
      ? selectedBackground === item.id
      : selectedCardBack === item.id;
  }

  async purchase(item: StoreItem): Promise<void> {
    this.busyItemId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.userService.purchaseStoreItem(item.id);
      this.successMessage = `${item.name} megvásárolva. Most már felszerelheted.`;
    } catch (error) {
      console.error('Nem sikerült megvásárolni a bolti tárgyat.', error);
      this.errorMessage = error instanceof Error && error.message === 'INSUFFICIENT_COINS'
        ? 'Nincs elég érméd ehhez a tárgyhoz.'
        : error instanceof Error && error.message === 'ALREADY_OWNED'
          ? 'Ezt a tárgyat már feloldottad.'
          : 'A vásárlás nem sikerült. Próbáld újra.';
    } finally {
      this.busyItemId = null;
    }
  }

  async equip(item: StoreItem): Promise<void> {
    this.busyItemId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.userService.equipStoreItem(item.id);
      this.successMessage = `${item.name} használatban van.`;
    } catch (error) {
      console.error('Nem sikerült felszerelni a bolti tárgyat.', error);
      this.errorMessage = 'A tárgy használatba vétele nem sikerült. Próbáld újra.';
    } finally {
      this.busyItemId = null;
    }
  }
}
