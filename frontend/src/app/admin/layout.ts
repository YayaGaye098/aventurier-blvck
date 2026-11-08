import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth';
import { AdminUi } from './ui';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './admin.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="adm-shell">
      <aside class="adm-side" [class.open]="menu()">
        <a class="adm-brand" routerLink="/admin">
          <img src="/images/logo-icon.png" alt="">
          <span>Aventurier Blvck<small>Espace admin</small></span>
        </a>
        <nav class="adm-nav" (click)="menu.set(false)">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><i class="fas fa-gauge"></i> Tableau de bord</a>
          <a routerLink="/admin/carrousel" routerLinkActive="active"><i class="fas fa-photo-film"></i> Page d’accueil</a>
          <a routerLink="/admin/evenements" routerLinkActive="active"><i class="fas fa-calendar-day"></i> Événements</a>
          <a routerLink="/admin/aventures" routerLinkActive="active"><i class="fas fa-compass"></i> Aventures</a>
          <a routerLink="/admin/hotels" routerLinkActive="active"><i class="fas fa-hotel"></i> Hôtels</a>
          <a routerLink="/admin/avis" routerLinkActive="active"><i class="fas fa-star"></i> Avis clients</a>
          <a routerLink="/admin/galerie" routerLinkActive="active"><i class="fas fa-images"></i> Galerie</a>
          <a routerLink="/admin/blog" routerLinkActive="active"><i class="fas fa-feather-pointed"></i> Blog</a>
          <a routerLink="/admin/messages" routerLinkActive="active"><i class="fas fa-envelope"></i> Messages
            @if (ui.nonLus()) { <span class="adm-badge">{{ ui.nonLus() }}</span> }
          </a>
        </nav>
        <div class="adm-side-foot">
          <a routerLink="/" target="_blank"><i class="fas fa-arrow-up-right-from-square"></i> Voir le site</a>
          <a routerLink="/admin/compte" (click)="menu.set(false)"><i class="fas fa-user-gear"></i> {{ user() || 'Mon compte' }}</a>
          <button type="button" (click)="auth.logout()"><i class="fas fa-right-from-bracket"></i> Déconnexion</button>
        </div>
      </aside>

      <div>
        <div class="adm-mobilebar">
          <button type="button" (click)="menu.set(!menu())" aria-label="Menu"><i class="fas fa-bars"></i></button>
          <strong>Aventurier Blvck</strong>
          <span style="width:1.3rem"></span>
        </div>
        <main class="adm-main"><router-outlet /></main>
      </div>
    </div>

    @if (ui.toast(); as t) {
      <div class="adm-toast" [class.err]="t.err" role="status">{{ t.text }}</div>
    }
  `,
})
export class AdminLayout {
  auth = inject(AuthService);
  ui = inject(AdminUi);
  private api = inject(ApiService);
  menu = signal(false);
  user = signal('');

  constructor() {
    this.api.me().subscribe((u) => this.user.set(u.username));
    this.refresh();
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.refresh());
  }

  private refresh() {
    this.api.stats().subscribe((s) => this.ui.nonLus.set(s.non_lus));
  }
}
