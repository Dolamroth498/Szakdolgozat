import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export const authenticatedGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await firstValueFrom(authService.user$);

  return user
    ? true
    : router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
};
