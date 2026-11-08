import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { ContactMessage } from '../core/models';
import { AdminUi } from './ui';

@Component({
  selector: 'app-admin-messages',
  imports: [DatePipe],
  template: `
    <div class="adm-head">
      <div><h1>Messages</h1><p>{{ nonLus() }} non lu(s) sur {{ messages().length }}.</p></div>
      @if (nonLus()) {
        <button class="btn btn-ghost btn-sm" type="button" (click)="toutLu()"><i class="fas fa-check-double"></i> Tout marquer comme lu</button>
      }
    </div>

    <div class="adm-toolbar">
      <button class="chip" type="button" [class.on]="filtre() === 'tous'" (click)="filtre.set('tous')">Tous</button>
      <button class="chip" type="button" [class.on]="filtre() === 'non-lus'" (click)="filtre.set('non-lus')">Non lus</button>
    </div>

    <div class="adm-list">
      @for (m of affiches(); track m.id) {
        <article class="adm-card msg" [class.unread]="!m.lu">
          <header (click)="ouvrir(m)">
            <div>
              <h3>{{ m.nom }} @if (!m.lu) { <span class="adm-pill sun">Nouveau</span> }</h3>
              <p class="meta">{{ m.email }} @if (m.telephone) { · {{ m.telephone }} } · {{ m.created_at | date:'d MMMM y, HH:mm' }}</p>
            </div>
            <i class="fas" [class.fa-chevron-down]="ouvert() !== m.id" [class.fa-chevron-up]="ouvert() === m.id"></i>
          </header>
          @if (ouvert() === m.id) {
            <p class="body">{{ m.message }}</p>
            <div class="acts">
              <a class="btn btn-primary btn-sm" [href]="'mailto:' + m.email + '?subject=' + sujet"><i class="fas fa-reply"></i> Répondre par email</a>
              @if (wa(m.telephone); as lien) {
                <a class="btn btn-ghost btn-sm" [href]="lien" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>
              }
              <button class="btn btn-ghost btn-sm" type="button" (click)="marquer(m, !m.lu)">{{ m.lu ? 'Marquer non lu' : 'Marquer lu' }}</button>
              <button class="btn btn-danger btn-sm" type="button" (click)="supprimer(m)"><i class="fas fa-trash"></i> Supprimer</button>
            </div>
          } @else {
            <p class="preview">{{ m.message }}</p>
          }
        </article>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-inbox"></i>Aucun message.</div>
      }
    </div>
  `,
  styles: `
    .chip { border: 1.5px solid var(--line); background: #fff; padding: .4rem .9rem; border-radius: 999px; font-weight: 600; font-size: .85rem; cursor: pointer; }
    .chip.on { background: var(--teal); color: #fff; border-color: var(--teal); }
    .msg { padding: 1rem 1.2rem; }
    .msg.unread { border-left: 4px solid var(--orange); }
    .msg header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; cursor: pointer; }
    .msg h3 { font-family: var(--font-body); font-size: 1rem; font-weight: 700; }
    .meta { color: var(--muted); font-size: .82rem; }
    .preview { color: var(--muted); font-size: .9rem; margin-top: .4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .body { margin: 1rem 0; white-space: pre-wrap; background: var(--teal-mist); padding: 1rem; border-radius: 12px; }
    .acts { display: flex; flex-wrap: wrap; gap: .5rem; }
  `,
})
export class AdminMessages {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  readonly sujet = encodeURIComponent('Votre demande – Aventurier Blvck');

  messages = signal<ContactMessage[]>([]);
  filtre = signal<'tous' | 'non-lus'>('tous');
  ouvert = signal<number | null>(null);
  nonLus = computed(() => this.messages().filter((m) => !m.lu).length);
  affiches = computed(() => this.filtre() === 'tous' ? this.messages() : this.messages().filter((m) => !m.lu));

  constructor() { this.charger(); }

  charger() {
    this.api.contacts().subscribe((m) => {
      this.messages.set(m);
      this.ui.nonLus.set(m.filter((x) => !x.lu).length);
    });
  }

  ouvrir(m: ContactMessage) {
    this.ouvert.set(this.ouvert() === m.id ? null : m.id);
    if (!m.lu) this.marquer(m, true);
  }

  marquer(m: ContactMessage, lu: boolean) {
    this.api.markContact(m.id, lu).subscribe(() => this.charger());
  }

  toutLu() { this.api.markAllRead().subscribe(() => this.charger()); }

  supprimer(m: ContactMessage) {
    if (!confirm(`Supprimer le message de ${m.nom} ?`)) return;
    this.api.deleteContact(m.id).subscribe(() => { this.ui.notify('Message supprimé.'); this.charger(); });
  }

  /** Lien WhatsApp à partir d'un numéro sénégalais (ajoute l'indicatif 221 si besoin). */
  wa(tel: string | null) {
    if (!tel) return null;
    let n = tel.replace(/\D/g, '');
    if (n.startsWith('00')) n = n.slice(2);
    if (n.length === 9) n = '221' + n;
    return n.length >= 11 ? `https://wa.me/${n}` : null;
  }
}
