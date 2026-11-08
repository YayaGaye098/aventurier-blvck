import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, of } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Hotel, HotelInput, VILLES } from '../core/models';
import { AdminUi, preview } from './ui';

const VIDE: HotelInput = {
  nom: '', ville: 'Dakar', description: '', adresse: '', telephone: '', email: '', site_web: '',
  etoiles: 3, prix_nuit: null, actif: true, featured: false,
};

@Component({
  selector: 'app-admin-hotels',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="adm-head">
      <div><h1>Hôtels partenaires</h1><p>{{ hotels().length }} hôtel(s) · affichés sur le site s'ils sont actifs.</p></div>
      <button class="btn btn-primary" type="button" (click)="ouvrir()"><i class="fas fa-plus"></i> Ajouter un hôtel</button>
    </div>

    <div class="adm-toolbar">
      <input class="input" placeholder="Rechercher…" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Rechercher">
      <select class="input" style="max-width:200px" [ngModel]="ville()" (ngModelChange)="ville.set($event)" aria-label="Ville">
        <option value="">Toutes les villes</option>
        @for (v of villesUtilisees(); track v) { <option [value]="v">{{ v }}</option> }
      </select>
    </div>

    <div class="adm-list">
      @for (h of filtres(); track h.id) {
        <div class="adm-row" [class.off]="!h.actif">
          @if (h.image) { <img class="adm-thumb" [src]="h.image" alt=""> } @else { <div class="adm-thumb"><i class="fas fa-hotel"></i></div> }
          <div class="adm-row-main">
            <h3>{{ h.nom }}
              @if (h.featured) { <span class="adm-pill sun">Coup de cœur</span> }
              @if (!h.actif) { <span class="adm-pill off">Masqué</span> }
            </h3>
            <p><span class="stars">{{ '★'.repeat(h.etoiles) }}</span> · {{ h.ville }}
              · @if (h.prix_nuit) { {{ h.prix_nuit | number:'1.0-0' }} FCFA / nuit } @else { prix sur demande }</p>
          </div>
          <div class="adm-row-actions">
            <button class="btn btn-ghost btn-icon" type="button" (click)="basculer(h, 'featured')" [title]="h.featured ? 'Retirer des coups de cœur' : 'Mettre en coup de cœur'">
              <i [class]="h.featured ? 'fas fa-star' : 'far fa-star'"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="basculer(h, 'actif')" [title]="h.actif ? 'Masquer du site' : 'Afficher sur le site'">
              <i [class]="h.actif ? 'fas fa-eye' : 'fas fa-eye-slash'"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="ouvrir(h)" title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(h)" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-hotel"></i>Aucun hôtel. Ajoutez votre premier partenaire.</div>
      }
    </div>

    @if (edit(); as e) {
      <div class="adm-overlay" (click)="fermer()">
        <aside class="adm-drawer" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header>
            <h2>{{ e.id ? 'Modifier l’hôtel' : 'Nouvel hôtel' }}</h2>
            <button class="btn btn-ghost btn-icon" type="button" (click)="fermer()" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
          </header>
          <form (ngSubmit)="enregistrer()" #f="ngForm">
            <div class="adm-drawer-body">
              <label class="adm-drop" [class.over]="over()" (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="drop($event)">
                @if (apercu()) { <img [src]="apercu()" alt=""> } @else { <div class="ph"><i class="fas fa-image"></i></div> }
                <p><strong>Choisir une photo</strong><br>ou la glisser ici · JPG, PNG, WEBP · 5 Mo max</p>
                <input type="file" accept="image/*" hidden (change)="choisir($event)">
              </label>
              <div class="field"><label for="nom">Nom de l'hôtel *</label>
                <input id="nom" name="nom" class="input" required [(ngModel)]="e.data.nom"></div>
              <div class="adm-grid2">
                <div class="field"><label for="ville">Ville *</label>
                  <select id="ville" name="ville" class="input" required [(ngModel)]="e.data.ville">
                    @for (v of villes; track v) { <option [value]="v">{{ v }}</option> }
                  </select></div>
                <div class="field"><label for="etoiles">Étoiles</label>
                  <select id="etoiles" name="etoiles" class="input" [(ngModel)]="e.data.etoiles">
                    @for (n of [1,2,3,4,5]; track n) { <option [ngValue]="n">{{ '★'.repeat(n) }}</option> }
                  </select></div>
              </div>
              <div class="field"><label for="desc">Description</label>
                <textarea id="desc" name="desc" class="input" rows="4" [(ngModel)]="e.data.description"></textarea></div>
              <div class="field"><label for="adresse">Adresse</label>
                <input id="adresse" name="adresse" class="input" [(ngModel)]="e.data.adresse"></div>
              <div class="adm-grid2">
                <div class="field"><label for="tel">Téléphone</label>
                  <input id="tel" name="tel" class="input" type="tel" [(ngModel)]="e.data.telephone"></div>
                <div class="field"><label for="email">Email</label>
                  <input id="email" name="email" class="input" type="email" [(ngModel)]="e.data.email"></div>
              </div>
              <div class="adm-grid2">
                <div class="field"><label for="site">Site web</label>
                  <input id="site" name="site" class="input" type="url" placeholder="https://…" [(ngModel)]="e.data.site_web"></div>
                <div class="field"><label for="prix">Prix / nuit (FCFA)</label>
                  <input id="prix" name="prix" class="input" type="number" min="0" step="500" placeholder="Sur demande" [(ngModel)]="e.data.prix_nuit"></div>
              </div>
              <div class="adm-checks">
                <label class="check"><input type="checkbox" name="actif" [(ngModel)]="e.data.actif"> Visible sur le site</label>
                <label class="check"><input type="checkbox" name="featured" [(ngModel)]="e.data.featured"> Coup de cœur</label>
              </div>
            </div>
            <footer>
              <button class="btn btn-ghost" type="button" (click)="fermer()">Annuler</button>
              <button class="btn btn-primary" type="submit" [disabled]="saving() || f.invalid">
                @if (saving()) { <i class="fas fa-spinner fa-spin"></i> } Enregistrer</button>
            </footer>
          </form>
        </aside>
      </div>
    }
  `,
})
export class AdminHotels {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  readonly villes = VILLES;

  hotels = signal<Hotel[]>([]);
  q = signal('');
  ville = signal('');
  villesUtilisees = computed(() => [...new Set(this.hotels().map((h) => h.ville))].sort());
  filtres = computed(() => {
    const q = this.q().toLowerCase();
    return this.hotels().filter((h) =>
      (!this.ville() || h.ville === this.ville()) && (!q || h.nom.toLowerCase().includes(q)));
  });

  edit = signal<{ id?: number; data: HotelInput } | null>(null);
  fichier: File | null = null;
  apercu = signal<string | null>(null);
  over = signal(false);
  saving = signal(false);

  constructor() { this.charger(); }

  charger() { this.api.adminHotels().subscribe((h) => this.hotels.set(h)); }

  ouvrir(h?: Hotel) {
    this.fichier = null;
    this.apercu.set(h?.image ?? null);
    const data: HotelInput = h ? { ...h } : { ...VIDE };
    if (h && !this.villes.includes(h.ville)) this.villes.push(h.ville);
    this.edit.set({ id: h?.id, data });
  }

  fermer() { this.edit.set(null); }

  async choisir(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) { this.fichier = file; this.apercu.set(await preview(file)); }
  }

  async drop(ev: DragEvent) {
    ev.preventDefault();
    this.over.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) { this.fichier = file; this.apercu.set(await preview(file)); }
  }

  enregistrer() {
    const e = this.edit();
    if (!e) return;
    this.saving.set(true);
    const data = { ...e.data, prix_nuit: e.data.prix_nuit || null };
    this.api.saveHotel(data, e.id).pipe(
      concatMap((h) => (this.fichier ? this.api.hotelImage(h.id, this.fichier) : of(h))),
    ).subscribe({
      next: () => {
        this.ui.notify(e.id ? 'Hôtel mis à jour.' : 'Hôtel ajouté.');
        this.saving.set(false);
        this.fermer();
        this.charger();
      },
      error: (err) => { this.ui.notify(errorMessage(err), true); this.saving.set(false); this.charger(); },
    });
  }

  basculer(h: Hotel, champ: 'actif' | 'featured') {
    const { id, image, ...data } = h;
    this.api.saveHotel({ ...data, [champ]: !h[champ] }, id).subscribe({
      next: () => this.charger(),
      error: (err) => this.ui.notify(errorMessage(err), true),
    });
  }

  supprimer(h: Hotel) {
    if (!confirm(`Supprimer définitivement « ${h.nom} » ?`)) return;
    this.api.deleteHotel(h.id).subscribe(() => { this.ui.notify('Hôtel supprimé.'); this.charger(); });
  }
}
