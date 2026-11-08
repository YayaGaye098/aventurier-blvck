import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, of } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Service, ServiceInput } from '../core/models';
import { AdminUi, ICONES, preview } from './ui';

const VIDE: ServiceInput = { titre: '', description: '', icone: 'fa-compass', prix: null, duree: '', actif: true };

@Component({
  selector: 'app-admin-services',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="adm-head">
      <div><h1>Aventures</h1><p>Balades, excursions et séjours proposés sur le site.</p></div>
      <button class="btn btn-primary" type="button" (click)="ouvrir()"><i class="fas fa-plus"></i> Nouvelle aventure</button>
    </div>

    <div class="adm-list">
      @for (s of services(); track s.id) {
        <div class="adm-row" [class.off]="!s.actif">
          @if (s.image) { <img class="adm-thumb" [src]="s.image" alt=""> }
          @else { <div class="adm-thumb"><i [class]="'fas ' + s.icone"></i></div> }
          <div class="adm-row-main">
            <h3>{{ s.titre }} @if (!s.actif) { <span class="adm-pill off">Masquée</span> }</h3>
            <p>{{ s.duree || 'Durée libre' }} · @if (s.prix) { {{ s.prix | number:'1.0-0' }} FCFA } @else { prix sur demande } · {{ s.description }}</p>
          </div>
          <div class="adm-row-actions">
            <button class="btn btn-ghost btn-icon" type="button" (click)="basculer(s)" [title]="s.actif ? 'Masquer du site' : 'Afficher sur le site'">
              <i [class]="s.actif ? 'fas fa-eye' : 'fas fa-eye-slash'"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="ouvrir(s)" title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(s)" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-compass"></i>Aucune aventure. Créez la première !</div>
      }
    </div>

    @if (edit(); as e) {
      <div class="adm-overlay" (click)="edit.set(null)">
        <aside class="adm-drawer" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header>
            <h2>{{ e.id ? 'Modifier l’aventure' : 'Nouvelle aventure' }}</h2>
            <button class="btn btn-ghost btn-icon" type="button" (click)="edit.set(null)" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
          </header>
          <form (ngSubmit)="enregistrer()" #f="ngForm">
            <div class="adm-drawer-body">
              <div class="field"><label for="titre">Titre *</label>
                <input id="titre" name="titre" class="input" required [(ngModel)]="e.data.titre" placeholder="Ex. : Balade au Lac Rose"></div>
              <div class="field"><label for="desc">Description</label>
                <textarea id="desc" name="desc" class="input" rows="4" [(ngModel)]="e.data.description"></textarea></div>
              <div class="adm-grid2">
                <div class="field"><label for="duree">Durée</label>
                  <input id="duree" name="duree" class="input" [(ngModel)]="e.data.duree" placeholder="Ex. : Journée, 2 jours"></div>
                <div class="field"><label for="prix">Prix (FCFA)</label>
                  <input id="prix" name="prix" class="input" type="number" min="0" step="500" placeholder="Sur demande" [(ngModel)]="e.data.prix"></div>
              </div>
              <div class="field">
                <label>Photo (facultative)</label>
                <label class="adm-drop">
                  @if (apercu()) { <img [src]="apercu()" alt=""> } @else { <div class="ph"><i [class]="'fas ' + e.data.icone"></i></div> }
                  <p><strong>Choisir une photo</strong><br>Sans photo, l'icône ci-dessous est affichée.</p>
                  <input type="file" accept="image/*" hidden (change)="choisir($event)">
                </label>
              </div>
              <div class="field">
                <label>Icône</label>
                <div class="adm-icons">
                  @for (ic of icones; track ic) {
                    <button type="button" [class.on]="e.data.icone === ic" (click)="e.data.icone = ic" [attr.aria-label]="ic"><i [class]="'fas ' + ic"></i></button>
                  }
                </div>
              </div>
              <label class="check"><input type="checkbox" name="actif" [(ngModel)]="e.data.actif"> Visible sur le site</label>
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
})
export class AdminServices {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  readonly icones = [...ICONES];

  services = signal<Service[]>([]);
  edit = signal<{ id?: number; data: ServiceInput } | null>(null);
  apercu = signal<string | null>(null);
  fichier: File | null = null;
  saving = signal(false);

  constructor() { this.charger(); }

  charger() { this.api.adminServices().subscribe((s) => this.services.set(s)); }

  ouvrir(s?: Service) {
    this.fichier = null;
    this.apercu.set(s?.image ?? null);
    if (s && !this.icones.includes(s.icone)) this.icones.push(s.icone);
    this.edit.set({ id: s?.id, data: s ? { ...s } : { ...VIDE } });
  }

  async choisir(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) { this.fichier = file; this.apercu.set(await preview(file)); }
  }

  enregistrer() {
    const e = this.edit();
    if (!e) return;
    this.saving.set(true);
    const { titre, description, icone, prix, duree, actif } = e.data;
    this.api.saveService({ titre, description, icone, prix: prix || null, duree: duree || null, actif }, e.id).pipe(
      concatMap((s) => (this.fichier ? this.api.serviceImage(s.id, this.fichier) : of(s))),
    ).subscribe({
      next: () => {
        this.ui.notify(e.id ? 'Aventure mise à jour.' : 'Aventure ajoutée.');
        this.saving.set(false);
        this.edit.set(null);
        this.charger();
      },
      error: (err) => { this.ui.notify(errorMessage(err), true); this.saving.set(false); this.charger(); },
    });
  }

  basculer(s: Service) {
    const { titre, description, icone, prix, duree } = s;
    this.api.saveService({ titre, description, icone, prix, duree, actif: !s.actif }, s.id)
      .subscribe(() => this.charger());
  }

  supprimer(s: Service) {
    if (!confirm(`Supprimer définitivement « ${s.titre} » ?`)) return;
    this.api.deleteService(s.id).subscribe(() => { this.ui.notify('Aventure supprimée.'); this.charger(); });
  }
}
