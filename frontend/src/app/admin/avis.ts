import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, of } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Avis, AvisInput } from '../core/models';
import { AdminUi, preview } from './ui';

const VIDE = (): AvisInput => ({ nom: '', origine: '', sortie: '', texte: '', note: 5, actif: true });

@Component({
  selector: 'app-admin-avis',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="adm-head">
      <div><h1>Avis clients</h1><p>Témoignages affichés sur le site. Les avis envoyés par les visiteurs attendent votre validation.</p></div>
      <button class="btn btn-primary" type="button" (click)="ouvrir()"><i class="fas fa-plus"></i> Ajouter un avis</button>
    </div>

    @if (enAttente() > 0) {
      <p class="adm-card avis-alerte"><i class="fas fa-hourglass-half"></i>
        {{ enAttente() }} avis en attente de validation : relisez-les puis cliquez sur <strong>Publier</strong>.</p>
    }

    <div class="adm-list">
      @for (a of avis(); track a.id) {
        <div class="adm-row">
          @if (a.image) { <img class="adm-thumb avis-photo" [src]="a.image" alt=""> }
          @else { <div class="adm-thumb avis-photo">{{ initiale(a.nom) }}</div> }
          <div class="adm-row-main">
            <h3>{{ a.nom }} <span class="avis-stars">{{ etoiles(a.note) }}</span>
              @if (!a.actif) { <span class="adm-pill sun">En attente</span> }</h3>
            <p>{{ a.created_at | date:'d MMM y' }} @if (a.sortie) { · {{ a.sortie }} } · « {{ a.texte }} »</p>
          </div>
          <div class="adm-row-actions">
            @if (!a.actif) {
              <button class="btn btn-primary btn-sm" type="button" (click)="basculer(a)"><i class="fas fa-check"></i> Publier</button>
            } @else {
              <button class="btn btn-ghost btn-icon" type="button" (click)="basculer(a)" title="Masquer du site"><i class="fas fa-eye"></i></button>
            }
            <button class="btn btn-ghost btn-icon" type="button" (click)="ouvrir(a)" title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(a)" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-star"></i>Aucun avis pour l'instant. Ajoutez ceux reçus sur WhatsApp ou Instagram !</div>
      }
    </div>

    @if (edit(); as e) {
      <div class="adm-overlay" (click)="edit.set(null)">
        <aside class="adm-drawer" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header>
            <h2>{{ e.id ? 'Modifier l’avis' : 'Nouvel avis' }}</h2>
            <button class="btn btn-ghost btn-icon" type="button" (click)="edit.set(null)" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
          </header>
          <form (ngSubmit)="enregistrer()" #f="ngForm">
            <div class="adm-drawer-body">
              <div class="adm-grid2">
                <div class="field"><label for="nom">Prénom / nom *</label>
                  <input id="nom" name="nom" class="input" required [(ngModel)]="e.data.nom" placeholder="Ex. : Awa D."></div>
                <div class="field"><label for="origine">Ville / pays</label>
                  <input id="origine" name="origine" class="input" [(ngModel)]="e.data.origine" placeholder="Ex. : Dakar"></div>
              </div>
              <div class="field"><label for="sortie">Sortie concernée</label>
                <input id="sortie" name="sortie" class="input" [(ngModel)]="e.data.sortie" placeholder="Ex. : Sine Saloum, novembre 2026"></div>
              <div class="field"><label for="texte">Témoignage *</label>
                <textarea id="texte" name="texte" class="input" rows="5" required [(ngModel)]="e.data.texte"></textarea></div>
              <div class="field">
                <label>Note</label>
                <div class="avis-note">
                  @for (n of [1,2,3,4,5]; track n) {
                    <button type="button" [class.on]="n <= e.data.note" (click)="e.data.note = n" [attr.aria-label]="n + ' étoile(s)'">★</button>
                  }
                </div>
              </div>
              <div class="field">
                <label>Photo du client (facultative)</label>
                <label class="adm-drop">
                  @if (apercu()) { <img [src]="apercu()" alt=""> } @else { <div class="ph"><i class="fas fa-user"></i></div> }
                  <p><strong>Choisir une photo</strong><br>Avec l'accord de la personne.</p>
                  <input type="file" accept="image/*" hidden (change)="choisir($event)">
                </label>
              </div>
              <label class="check"><input type="checkbox" name="actif" [(ngModel)]="e.data.actif"> Publié sur le site</label>
            </div>
            <footer>
              <button class="btn btn-ghost" type="button" (click)="edit.set(null)">Annuler</button>
              <button class="btn btn-primary" type="submit" [disabled]="saving() || f.invalid">
                @if (saving()) { <i class="fas fa-spinner fa-spin"></i> } Enregistrer</button>
            </footer>
          </form>
        </aside>
      </div>
    }
  `,
  styles: `
    .avis-alerte { display: flex; gap: .6rem; align-items: center; margin-bottom: 1rem; background: var(--orange-soft); color: #8a4b00; }
    .avis-photo { width: 52px; height: 52px; border-radius: 50%; font-weight: 800; font-size: 1.2rem; }
    .avis-stars { color: var(--orange); font-size: .9rem; letter-spacing: .05em; margin-left: .3rem; }
    .avis-note { display: flex; gap: .2rem; }
    .avis-note button { border: 0; background: none; font-size: 1.8rem; line-height: 1; cursor: pointer; color: #d6dcdc; padding: 0 .1rem; }
    .avis-note button.on { color: var(--orange); }
  `,
})
export class AdminAvis {
  private api = inject(ApiService);
  private ui = inject(AdminUi);

  avis = signal<Avis[]>([]);
  enAttente = computed(() => this.avis().filter((a) => !a.actif).length);
  edit = signal<{ id?: number; data: AvisInput } | null>(null);
  apercu = signal<string | null>(null);
  fichier: File | null = null;
  saving = signal(false);

  constructor() { this.charger(); }

  charger() { this.api.adminAvis().subscribe((a) => this.avis.set(a)); }

  etoiles(n: number) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
  initiale(nom: string) { return nom.trim().charAt(0).toUpperCase(); }

  ouvrir(a?: Avis) {
    this.fichier = null;
    this.apercu.set(a?.image ?? null);
    const data: AvisInput = a
      ? { nom: a.nom, origine: a.origine ?? '', sortie: a.sortie ?? '', texte: a.texte, note: a.note, actif: a.actif }
      : VIDE();
    this.edit.set({ id: a?.id, data });
  }

  async choisir(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file?.type.startsWith('image/')) { this.fichier = file; this.apercu.set(await preview(file)); }
  }

  enregistrer() {
    const e = this.edit();
    if (!e) return;
    this.saving.set(true);
    const data = { ...e.data, origine: e.data.origine || null, sortie: e.data.sortie || null };
    this.api.saveAvis(data, e.id).pipe(
      concatMap((a) => (this.fichier ? this.api.avisImage(a.id, this.fichier) : of(a))),
    ).subscribe({
      next: () => {
        this.ui.notify(e.id ? 'Avis mis à jour.' : 'Avis ajouté.');
        this.saving.set(false);
        this.edit.set(null);
        this.charger();
      },
      error: (err) => { this.ui.notify(errorMessage(err), true); this.saving.set(false); this.charger(); },
    });
  }

  basculer(a: Avis) {
    const { nom, origine, sortie, texte, note } = a;
    this.api.saveAvis({ nom, origine, sortie, texte, note, actif: !a.actif }, a.id).subscribe(() => {
      this.ui.notify(a.actif ? 'Avis masqué.' : 'Avis publié sur le site.');
      this.charger();
    });
  }

  supprimer(a: Avis) {
    if (!confirm(`Supprimer l'avis de « ${a.nom} » ?`)) return;
    this.api.deleteAvis(a.id).subscribe(() => { this.ui.notify('Avis supprimé.'); this.charger(); });
  }
}
