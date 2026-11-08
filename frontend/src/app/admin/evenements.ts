import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, concatMap, filter, map, of, tap } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Evenement, EvenementInput } from '../core/models';
import { MAX_VIDEO_MO, AdminUi, preview } from './ui';

const VIDE = (): EvenementInput => ({
  titre: '', lieu: '', description: '', date_debut: '', prix_adulte: null, prix_enfant: null, telephone: '', actif: true,
});

@Component({
  selector: 'app-admin-evenements',
  imports: [FormsModule, DecimalPipe, DatePipe],
  template: `
    <div class="adm-head">
      <div><h1>Événements</h1><p>Sorties datées mises en avant en haut du site, avec photo et vidéo.</p></div>
      <button class="btn btn-primary" type="button" (click)="ouvrir()"><i class="fas fa-plus"></i> Nouvel événement</button>
    </div>

    <div class="adm-list">
      @for (e of evenements(); track e.id) {
        <div class="adm-row" [class.off]="!e.actif || passe(e)">
          @if (e.image) { <img class="adm-thumb" [src]="e.image" alt=""> }
          @else { <div class="adm-thumb"><i class="fas fa-calendar-day"></i></div> }
          <div class="adm-row-main">
            <h3>{{ e.titre }}
              @if (!e.actif) { <span class="adm-pill off">Masqué</span> }
              @else if (passe(e)) { <span class="adm-pill off">Passé</span> }
              @if (e.video) { <span class="adm-pill"><i class="fas fa-video"></i> Vidéo</span> }
            </h3>
            <p>{{ e.date_debut | date:'EEEE d MMMM y, HH:mm' }} · {{ e.lieu || 'Lieu à préciser' }}
              @if (e.prix_adulte) { · Adulte {{ e.prix_adulte | number:'1.0-0' }} FCFA }
              @if (e.prix_enfant) { · Enfant {{ e.prix_enfant | number:'1.0-0' }} FCFA }</p>
          </div>
          <div class="adm-row-actions">
            <button class="btn btn-ghost btn-icon" type="button" (click)="dupliquer(e)" title="Dupliquer (nouvelle date)"><i class="fas fa-copy"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="basculer(e)" [title]="e.actif ? 'Masquer du site' : 'Afficher sur le site'">
              <i [class]="e.actif ? 'fas fa-eye' : 'fas fa-eye-slash'"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="ouvrir(e)" title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(e)" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-calendar-day"></i>Aucun événement. Annoncez votre prochaine sortie !</div>
      }
    </div>

    @if (edit(); as e) {
      <div class="adm-overlay" (click)="fermer()">
        <aside class="adm-drawer" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header>
            <h2>{{ e.id ? 'Modifier l’événement' : 'Nouvel événement' }}</h2>
            <button class="btn btn-ghost btn-icon" type="button" (click)="fermer()" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
          </header>
          <form (ngSubmit)="enregistrer()" #f="ngForm">
            <div class="adm-drawer-body">
              <div class="field"><label for="titre">Titre *</label>
                <input id="titre" name="titre" class="input" required [(ngModel)]="e.data.titre" placeholder="Ex. : Cap sur le Sine Saloum"></div>
              <div class="adm-grid2">
                <div class="field"><label for="date">Date et heure de départ *</label>
                  <input id="date" name="date" class="input" type="datetime-local" required [(ngModel)]="e.data.date_debut"></div>
                <div class="field"><label for="lieu">Lieu</label>
                  <input id="lieu" name="lieu" class="input" [(ngModel)]="e.data.lieu" placeholder="Ex. : Sine Saloum"></div>
              </div>
              <div class="field"><label for="desc">Programme / description</label>
                <textarea id="desc" name="desc" class="input" rows="4" [(ngModel)]="e.data.description"
                          placeholder="Mangroves, pirogue, découvertes et détente…"></textarea></div>
              <div class="adm-grid2">
                <div class="field"><label for="pa">Prix adulte (FCFA)</label>
                  <input id="pa" name="pa" class="input" type="number" min="0" step="100" placeholder="Sur demande" [(ngModel)]="e.data.prix_adulte"></div>
                <div class="field"><label for="pe">Prix enfant (FCFA)</label>
                  <input id="pe" name="pe" class="input" type="number" min="0" step="100" placeholder="—" [(ngModel)]="e.data.prix_enfant"></div>
              </div>
              <div class="field"><label for="tel">Téléphone / WhatsApp de réservation</label>
                <input id="tel" name="tel" class="input" type="tel" [(ngModel)]="e.data.telephone" placeholder="Ex. : 77 103 41 49"></div>

              <div class="field">
                <label>Affiche / photo</label>
                <label class="adm-drop">
                  @if (apercu()) { <img [src]="apercu()" alt=""> } @else { <div class="ph"><i class="fas fa-image"></i></div> }
                  <p><strong>Choisir une photo</strong><br>Affichée avant le lancement de la vidéo.</p>
                  <input type="file" accept="image/*" hidden (change)="choisirImage($event)">
                </label>
              </div>

              <div class="field">
                <label>Vidéo (MP4, MOV ou WEBM, 200 Mo max)</label>
                <label class="adm-drop">
                  @if (videoApercu()) { <video [src]="videoApercu()" muted playsinline class="adm-video"></video> }
                  @else { <div class="ph"><i class="fas fa-video"></i></div> }
                  <p><strong>{{ videoApercu() ? 'Changer la vidéo' : 'Choisir une vidéo' }}</strong><br>
                    @if (videoNom()) { {{ videoNom() }} } @else { Courte et verticale, comme pour Instagram ou TikTok. }</p>
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden (change)="choisirVideo($event)">
                </label>
                @if (e.id && videoActuelle() && !videoFichier) {
                  <button class="btn btn-ghost btn-sm" type="button" (click)="retirerVideo(e.id)"><i class="fas fa-trash"></i> Retirer la vidéo</button>
                }
              </div>
              <label class="check"><input type="checkbox" name="actif" [(ngModel)]="e.data.actif"> Visible sur le site</label>
            </div>
            <footer>
              @if (progression() !== null) {
                <span class="adm-progress">Envoi de la vidéo : {{ progression() }} %</span>
              }
              <button class="btn btn-ghost" type="button" (click)="fermer()" [disabled]="saving()">Annuler</button>
              <button class="btn btn-primary" type="submit" [disabled]="saving() || f.invalid">
                @if (saving()) { <i class="fas fa-spinner fa-spin"></i> } Enregistrer</button>
            </footer>
          </form>
        </aside>
      </div>
    }
  `,
  styles: `
    .adm-video { width: 84px; height: 64px; border-radius: 10px; object-fit: cover; background: #000; }
    .adm-progress { margin-right: auto; font-size: .85rem; color: var(--teal-dark); font-weight: 600; }
    .adm-pill i { margin-right: .2rem; }
  `,
})
export class AdminEvenements {
  private api = inject(ApiService);
  private ui = inject(AdminUi);

  evenements = signal<Evenement[]>([]);
  edit = signal<{ id?: number; data: EvenementInput } | null>(null);
  apercu = signal<string | null>(null);
  videoApercu = signal<string | null>(null);
  videoActuelle = signal<string | null>(null);
  videoNom = signal<string | null>(null);
  progression = signal<number | null>(null);
  saving = signal(false);
  imageFichier: File | null = null;
  videoFichier: File | null = null;

  constructor() { this.charger(); }

  charger() { this.api.adminEvenements().subscribe((e) => this.evenements.set(e)); }

  passe(e: Evenement) {
    const fin = new Date(e.date_debut);
    fin.setHours(23, 59, 59);
    return fin.getTime() < Date.now();
  }

  ouvrir(e?: Evenement, copie = false) {
    this.libererApercu();
    this.imageFichier = null;
    this.videoFichier = null;
    this.videoNom.set(null);
    this.progression.set(null);
    this.apercu.set(copie ? null : e?.image ?? null);
    this.videoActuelle.set(copie ? null : e?.video ?? null);
    this.videoApercu.set(copie ? null : e?.video ?? null);
    const data: EvenementInput = e
      ? {
          titre: e.titre, lieu: e.lieu ?? '', description: e.description, date_debut: copie ? '' : e.date_debut.slice(0, 16),
          prix_adulte: e.prix_adulte, prix_enfant: e.prix_enfant, telephone: e.telephone ?? '', actif: e.actif,
        }
      : VIDE();
    this.edit.set({ id: copie ? undefined : e?.id, data });
  }

  /** Reprend un événement passé pour annoncer une nouvelle date (photo et vidéo à remettre). */
  dupliquer(e: Evenement) {
    this.ouvrir(e, true);
    this.ui.notify('Copie prête : choisissez la nouvelle date.');
  }

  fermer() {
    if (this.saving()) return;
    this.libererApercu();
    this.edit.set(null);
  }

  async choisirImage(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file?.type.startsWith('image/')) { this.imageFichier = file; this.apercu.set(await preview(file)); }
  }

  choisirVideo(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_MO * 1024 * 1024) {
      this.ui.notify('Vidéo trop lourde (200 Mo max). Compressez-la avant de l’envoyer.', true);
      return;
    }
    this.libererApercu();
    this.videoFichier = file;
    this.videoNom.set(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} Mo)`);
    this.videoApercu.set(URL.createObjectURL(file));
  }

  retirerVideo(id: number) {
    if (!confirm('Retirer la vidéo de cet événement ?')) return;
    this.api.deleteEvenementVideo(id).subscribe(() => {
      this.videoActuelle.set(null);
      this.videoApercu.set(null);
      this.ui.notify('Vidéo retirée.');
      this.charger();
    });
  }

  enregistrer() {
    const e = this.edit();
    if (!e) return;
    this.saving.set(true);
    const d = e.data;
    const data: EvenementInput = {
      ...d, lieu: d.lieu || null, telephone: d.telephone || null,
      prix_adulte: d.prix_adulte || null, prix_enfant: d.prix_enfant || null,
    };
    this.api.saveEvenement(data, e.id).pipe(
      concatMap((ev) => (this.imageFichier ? this.api.evenementImage(ev.id, this.imageFichier) : of(ev))),
      concatMap((ev) => (this.videoFichier ? this.envoyerVideo(ev.id, this.videoFichier) : of(ev))),
    ).subscribe({
      next: () => {
        this.ui.notify(e.id ? 'Événement mis à jour.' : 'Événement publié.');
        this.saving.set(false);
        this.progression.set(null);
        this.libererApercu();
        this.edit.set(null);
        this.charger();
      },
      error: (err) => {
        this.ui.notify(errorMessage(err), true);
        this.saving.set(false);
        this.progression.set(null);
        this.charger();
      },
    });
  }

  private envoyerVideo(id: number, file: File): Observable<Evenement> {
    this.progression.set(0);
    return this.api.evenementVideo(id, file).pipe(
      tap((ev: HttpEvent<Evenement>) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) this.progression.set(Math.round((100 * ev.loaded) / ev.total));
      }),
      filter((ev) => ev.type === HttpEventType.Response),
      map((ev) => (ev as { body: Evenement }).body),
    );
  }

  basculer(e: Evenement) {
    const { id, image, video, ...data } = e;
    this.api.saveEvenement({ ...data, actif: !e.actif }, id).subscribe(() => this.charger());
  }

  supprimer(e: Evenement) {
    if (!confirm(`Supprimer définitivement « ${e.titre} » (photo et vidéo comprises) ?`)) return;
    this.api.deleteEvenement(e.id).subscribe(() => { this.ui.notify('Événement supprimé.'); this.charger(); });
  }

  private libererApercu() {
    const v = this.videoApercu();
    if (v?.startsWith('blob:')) URL.revokeObjectURL(v);
  }
}
