import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';


@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule,FormsModule, MatButtonModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent implements OnInit {
  action: string | null = null;
  name: string = '';
  email: string = '';
  password: string = '';
  errorMessage = '';
  isSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.action = this.route.snapshot.paramMap.get('action');
  }

  async login(): Promise<void> {
    this.errorMessage = '';
    this.isSubmitting = true;

    try {
      await this.authService.login(this.email.trim(), this.password);
      await this.router.navigateByUrl(this.getReturnUrl());
    } catch (error) {
      console.error('Firebase sign-in failed.', error);
      this.errorMessage = this.getAuthErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  async register(): Promise<void> {
    this.errorMessage = '';
    this.isSubmitting = true;

    try {
      await this.authService.register(this.name.trim(), this.email.trim(), this.password);
      await this.router.navigateByUrl(this.getReturnUrl());
    } catch (error) {
      console.error('Firebase registration failed.', error);
      this.errorMessage = this.getAuthErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private getReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
      ? returnUrl
      : '/main';
  }

  private getAuthErrorMessage(error: unknown): string {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;

    switch (code) {
      case 'auth/email-already-in-use':
        return 'Ez az e-mail-cím már használatban van.';
      case 'auth/invalid-email':
        return 'Adj meg egy érvényes e-mail-címet.';
      case 'auth/weak-password':
        return 'A jelszónak legalább 6 karakter hosszúnak kell lennie.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Hibás e-mail-cím vagy jelszó.';
      case 'auth/too-many-requests':
        return 'Túl sok próbálkozás. Próbáld újra később.';
      case 'auth/network-request-failed':
        return 'Hálózati hiba. Ellenőrizd az internetkapcsolatodat.';
      case 'auth/operation-not-allowed':
        return 'Az e-mailes bejelentkezés nincs engedélyezve a Firebase-projektben.';
      case 'auth/unauthorized-domain':
        return 'Ez a webhely nincs engedélyezve a Firebase Authentication beállításaiban. Add hozzá a jelenlegi domaint az Authorized domains listához.';
      case 'auth/api-key-not-valid':
        return 'A Firebase API-kulcs érvénytelen. Ellenőrizd az alkalmazás Firebase webes konfigurációját.';
      case 'auth/configuration-not-found':
        return 'A Firebase Authentication nincs beállítva ehhez a projekthez.';
      default:
        return `A hitelesítés nem sikerült (${code ?? 'ismeretlen hiba'}). Próbáld újra később.`;
    }
  }

  public backToMain(): void  {
    this.router.navigateByUrl("main");
  }
}
