import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="wrap">
      <form class="card" (ngSubmit)="submit()">
        <img src="/images/logo.webp" alt="Aventurier Blvck" width="150" height="124">
        <h1>Espace admin</h1>
        <p class="sub">Connectez-vous pour gérer le site.</p>
        <div class="field">
          <label for="u">Identifiant</label>
          <input id="u" name="u" class="input" [(ngModel)]="username" required autocomplete="username">
        </div>
        <div class="field">
          <label for="p">Mot de passe</label>
          <div class="pw">
            <input id="p" name="p" class="input" [type]="show() ? 'text' : 'password'" [(ngModel)]="password" required autocomplete="current-password">
            <button type="button" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Masquer' : 'Afficher'">
              <i class="fas" [class.fa-eye]="!show()" [class.fa-eye-slash]="show()"></i>
            </button>
          </div>
        </div>
        @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
        <button class="btn btn-primary" type="submit" [disabled]="loading() || !username || !password">
          @if (loading()) { <i class="fas fa-spinner fa-spin"></i> } Se connecter
        </button>
        <a routerLink="/" class="back"><i class="fas fa-arrow-left"></i> Retour au site</a>
      </form>
    </main>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
      background: radial-gradient(circle at 20% 10%, var(--teal-soft), transparent 50%),
                  radial-gradient(circle at 90% 90%, var(--orange-soft), transparent 45%), var(--teal-mist); }
    .card { width: min(400px, 100%); background: #fff; border: 1px solid var(--line); border-radius: 24px;
      padding: 2.2rem; display: grid; gap: 1rem; box-shadow: var(--shadow-lg); }
    img { margin: 0 auto .5rem; }
    h1 { text-align: center; font-size: 1.6rem; }
    .sub { text-align: center; color: var(--muted); margin-top: -.6rem; }
    .pw { position: relative; }
    .pw button { position: absolute; right: .4rem; top: 50%; transform: translateY(-50%); background: none; border: 0; color: var(--muted); cursor: pointer; padding: .4rem; }
    .back { text-align: center; font-size: .88rem; color: var(--muted); text-decoration: none; }
    .back:hover { color: var(--teal); }
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  username = '';
  password = '';
  show = signal(false);
  loading = signal(false);
  error = signal('');

  constructor() {
    if (this.auth.token()) this.router.navigate(['/admin']);
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (e) => { this.error.set(errorMessage(e)); this.loading.set(false); },
    });
  }
}
