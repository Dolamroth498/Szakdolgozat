import { CanDeactivateFn } from '@angular/router';

export interface GameExitGuard {
  canLeaveGame(): boolean;
}

export const gameExitGuard: CanDeactivateFn<GameExitGuard> = component =>
  component.canLeaveGame();
