import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ContactMessage, Statistiques, Stats } from '../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="adm-head">
      <div>
        <h1>Tableau de bord</h1>
        <p>Vue d'ensemble du site Aventurier Blvck.</p>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <a routerLink="/admin/blog/nouveau" class="btn btn-primary btn-sm"><i class="fas fa-pen-nib"></i> Écrire un article</a>
        <a routerLink="/" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-eye"></i> Voir le site</a>
      </div>
    </div>

    @if (stats(); as s) {
      <div class="adm-stats">
        <a routerLink="/admin/messages" class="adm-card adm-stat">
          <div class="ic sun"><i class="fas fa-envelope"></i></div>
          <div><strong>{{ s.non_lus }}</strong><span>message(s) non lu(s) sur {{ s.messages }}</span></div>
        </a>
        <a routerLink="/admin/evenements" class="adm-card adm-stat">
          <div class="ic sun"><i class="fas fa-calendar-day"></i></div>
          <div><strong>{{ s.evenements }}</strong><span>événements</span></div>
        </a>
        @if (s.avis_attente) {
          <a routerLink="/admin/avis" class="adm-card adm-stat">
            <div class="ic sun"><i class="fas fa-star"></i></div>
            <div><strong>{{ s.avis_attente }}</strong><span>avis à valider</span></div>
          </a>
        }
        <a routerLink="/admin/aventures" class="adm-card adm-stat">
          <div class="ic"><i class="fas fa-compass"></i></div>
          <div><strong>{{ s.services }}</strong><span>aventures</span></div>
        </a>
        <a routerLink="/admin/hotels" class="adm-card adm-stat">
          <div class="ic"><i class="fas fa-hotel"></i></div>
          <div><strong>{{ s.hotels }}</strong><span>hôtels partenaires</span></div>
        </a>
        <a routerLink="/admin/blog" class="adm-card adm-stat">
          <div class="ic"><i class="fas fa-feather-pointed"></i></div>
          <div><strong>{{ s.articles }}</strong><span>articles de blog</span></div>
        </a>
        <a routerLink="/admin/galerie" class="adm-card adm-stat">
          <div class="ic"><i class="fas fa-images"></i></div>
          <div><strong>{{ s.photos }}</strong><span>photos</span></div>
        </a>
      </div>
    }

    <section class="adm-card audience">
      <div class="aud-head">
        <div>
          <h2>Audience du site</h2>
          <p>Compteurs anonymes, sans cookie ni donnée personnelle.</p>
        </div>
        <div class="aud-range" role="group" aria-label="Période">
          @for (p of periodes; track p) {
            <button type="button" [class.on]="jours() === p" (click)="changerPeriode(p)">{{ p }} j</button>
          }
        </div>
      </div>

      @if (audience(); as a) {
        <div class="aud-tiles">
          <div><span>Visites aujourd’hui</span><strong>{{ a.aujourdhui }}</strong></div>
          <div><span>Visites ({{ a.jours }} j)</span><strong>{{ a.totaux['visite'] || 0 }}</strong></div>
          <div><span>Clics WhatsApp</span><strong>{{ a.totaux['whatsapp'] || 0 }}</strong></div>
          <div><span>Demandes de réservation</span><strong>{{ a.totaux['reservation'] || 0 }}</strong></div>
          <div><span>Partages</span><strong>{{ a.totaux['partage'] || 0 }}</strong></div>
          <div><span>Appels</span><strong>{{ a.totaux['appel'] || 0 }}</strong></div>
        </div>

        <h3 class="aud-title">Visites par jour</h3>
        <div class="aud-chart">
          <div class="aud-grid" aria-hidden="true">
            <span>{{ maxVisites() }}</span><span>{{ demiMax() }}</span><span>0</span>
          </div>
          <div class="aud-bars" role="img" [attr.aria-label]="'Visites par jour sur ' + a.jours + ' jours'">
            @for (j of a.visites_par_jour; track j.jour) {
              <div class="aud-bar" tabindex="0" [attr.aria-label]="(j.jour | date:'EEEE d MMMM') + ' : ' + j.visites + ' visite(s)'">
                <i [style.height.%]="hauteur(j.visites)"></i>
                <span class="aud-tip"><strong>{{ j.visites }}</strong> visite{{ j.visites > 1 ? 's' : '' }}<br>{{ j.jour | date:'EEE d MMM' }}</span>
              </div>
            }
          </div>
          <div class="aud-axis" aria-hidden="true">
            <span>{{ a.visites_par_jour[0].jour | date:'d MMM' }}</span>
            <span>{{ a.visites_par_jour[a.visites_par_jour.length - 1].jour | date:'d MMM' }}</span>
          </div>
        </div>

        <h3 class="aud-title">Clics « Réserver sur WhatsApp »</h3>
        @if (a.whatsapp_par_cible.length) {
          <ul class="aud-list">
            @for (c of a.whatsapp_par_cible; track c.cible) {
              <li>
                <span class="aud-label">{{ c.cible }}</span>
                <span class="aud-track"><i [style.width.%]="(100 * c.total) / a.whatsapp_par_cible[0].total"></i></span>
                <strong>{{ c.total }}</strong>
              </li>
            }
          </ul>
        } @else {
          <p class="aud-empty">Aucun clic WhatsApp sur la période.</p>
        }
      } @else {
        <p class="aud-empty">Chargement…</p>
      }
    </section>

    <section class="adm-card">
      <div class="adm-head" style="margin-bottom:1rem">
        <h2 style="font-size:1.2rem">Derniers messages</h2>
        <a routerLink="/admin/messages" class="btn btn-ghost btn-sm">Tout voir</a>
      </div>
      @if (messages().length === 0) {
        <p class="adm-empty"><i class="fas fa-inbox"></i>Aucun message pour l'instant.</p>
      }
      <div class="adm-list">
        @for (m of messages(); track m.id) {
          <a routerLink="/admin/messages" class="adm-row" style="text-decoration:none;color:inherit">
            <div class="adm-thumb" style="width:44px;height:44px;border-radius:50%"><i class="fas fa-user"></i></div>
            <div class="adm-row-main">
              <h3>{{ m.nom }} @if (!m.lu) { <span class="adm-pill sun">Nouveau</span> }</h3>
              <p>{{ m.message }}</p>
            </div>
            <small style="color:var(--muted)">{{ m.created_at | date:'d MMM, HH:mm' }}</small>
          </a>
        }
      </div>
    </section>
  `,
  styles: `
    .audience { margin-bottom: 1.5rem; }
    .aud-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.2rem; }
    .aud-head h2 { font-size: 1.2rem; }
    .aud-head p { color: var(--muted); font-size: .85rem; margin-top: .2rem; }
    .aud-range { display: inline-flex; background: var(--teal-mist); border-radius: 999px; padding: 3px; }
    .aud-range button { border: 0; background: none; padding: .35rem .8rem; border-radius: 999px; font: inherit; font-size: .82rem; font-weight: 600; color: var(--muted); cursor: pointer; }
    .aud-range button.on { background: #fff; color: var(--teal-dark); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .aud-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .7rem; margin-bottom: 1.6rem; }
    .aud-tiles div { border: 1px solid var(--line); border-radius: 14px; padding: .8rem 1rem; }
    .aud-tiles span { display: block; color: var(--muted); font-size: .78rem; font-weight: 600; }
    .aud-tiles strong { font-family: var(--font-display); font-size: 1.6rem; color: var(--ink); }
    .aud-title { font-family: var(--font-body); font-size: .9rem; font-weight: 700; margin: 0 0 .7rem; color: var(--ink); }
    .aud-chart { position: relative; padding-left: 2.2rem; margin-bottom: 1.8rem; }
    .aud-grid { position: absolute; left: 0; right: 0; top: 0; height: 160px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
    .aud-grid span { font-size: .7rem; color: var(--muted); border-bottom: 1px solid var(--line); line-height: 1; padding-bottom: 2px; width: 100%; }
    .aud-grid span:last-child { border-bottom: 0; transform: translateY(50%); }
    .aud-bars { position: relative; height: 160px; display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--muted); }
    .aud-bar { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; outline: none; }
    .aud-bar i { display: block; width: 100%; background: var(--teal); border-radius: 4px 4px 0 0; transition: opacity .15s; }
    .aud-bars:hover .aud-bar i { opacity: .45; }
    .aud-bars .aud-bar:hover i, .aud-bar:focus-visible i { opacity: 1; }
    .aud-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 2; white-space: nowrap;
      background: var(--ink); color: #fff; font-size: .75rem; padding: .35rem .55rem; border-radius: 8px; line-height: 1.35; text-align: center;
      opacity: 0; pointer-events: none; transition: opacity .12s; }
    .aud-bar:hover .aud-tip, .aud-bar:focus-visible .aud-tip { opacity: 1; }
    .aud-axis { display: flex; justify-content: space-between; font-size: .72rem; color: var(--muted); margin-top: .4rem; }
    .aud-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
    .aud-list li { display: grid; grid-template-columns: minmax(0, 14rem) 1fr 2.5rem; align-items: center; gap: .8rem; font-size: .88rem; }
    .aud-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .aud-track { height: 10px; background: var(--teal-mist); border-radius: 999px; overflow: hidden; }
    .aud-track i { display: block; height: 100%; background: var(--teal); border-radius: 999px; }
    .aud-list strong { text-align: right; }
    .aud-empty { color: var(--muted); font-size: .88rem; }
    @media (max-width: 560px) {
      .aud-list li { grid-template-columns: minmax(0, 1fr) 2.5rem; }
      .aud-track { grid-column: 1 / -1; grid-row: 2; }
    }
  `,
})
export class Dashboard {
  private api = inject(ApiService);
  stats = signal<Stats | null>(null);
  messages = signal<ContactMessage[]>([]);

  readonly periodes = [7, 30, 90];
  jours = signal(30);
  audience = signal<Statistiques | null>(null);
  /** Haut de l'échelle arrondi (pair) pour que la ligne du milieu tombe sur un entier. */
  maxVisites = computed(() => {
    const m = Math.max(0, ...(this.audience()?.visites_par_jour.map((j) => j.visites) ?? [0]));
    return m <= 4 ? 4 : Math.ceil(m / 2) * 2;
  });
  demiMax = computed(() => this.maxVisites() / 2);

  hauteur(v: number) { return (100 * v) / this.maxVisites(); }

  changerPeriode(p: number) {
    this.jours.set(p);
    this.audience.set(null);
    this.api.statistiques(p).subscribe((a) => this.audience.set(a));
  }

  constructor() {
    this.changerPeriode(30);
    this.api.stats().subscribe((s) => this.stats.set(s));
    this.api.contacts().subscribe((m) => this.messages.set(m.slice(0, 5)));
  }
}
