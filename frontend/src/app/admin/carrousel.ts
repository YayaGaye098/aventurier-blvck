import { HttpEvent, HttpEventType } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, concatMap, filter, forkJoin, map, of, tap } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Slide, SlideInput } from '../core/models';
import { MAX_VIDEO_MO, AdminUi } from './ui';

const VIDE = (): SlideInput => ({ titre: '', accent: '', texte: '', ordre: 0, actif: true });

@Component({
  selector: 'app-admin-carrousel',
  imports: [FormsModule],
  template: `
    <div class="adm-head">
      <div><h1>Page d’accueil</h1>
        <p><strong>Carrousel</strong> : les photos et vidéos qui défilent en haut du site, avec leur message. Les photos changent toutes les 2 secondes, les vidéos passent jusqu’au bout.</p></div>
      <button class="btn btn-primary" type="button" (click)="ouvrir()"><i class="fas fa-plus"></i> Nouvelle diapo</button>
    </div>

    <div class="adm-list">
      @for (s of slides(); track s.id; let i = $index; let dernier = $last) {
        <div class="adm-row" [class.off]="!s.actif">
          @if (s.media_type === 'video') {
            <video class="adm-thumb car-thumb" [src]="s.media" muted playsinline preload="metadata"></video>
          } @else if (s.media) {
            <img class="adm-thumb car-thumb" [src]="s.media" alt="">
          } @else {
            <div class="adm-thumb car-thumb"><i class="fas fa-image"></i></div>
          }
          <div class="adm-row-main">
            <h3>{{ i + 1 }}. {{ s.titre }} <span class="car-accent">{{ s.accent }}</span>
              @if (s.media_type === 'video') { <span class="adm-pill"><i class="fas fa-video"></i> Vidéo</span> }
              @if (!s.media) { <span class="adm-pill sun">Sans photo</span> }
              @if (!s.actif) { <span class="adm-pill off">Masquée</span> }
            </h3>
            <p>{{ s.texte || '—' }}</p>
          </div>
          <div class="adm-row-actions">
            <button class="btn btn-ghost btn-icon" type="button" (click)="deplacer(i, -1)" [disabled]="i === 0" title="Monter"><i class="fas fa-arrow-up"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="deplacer(i, 1)" [disabled]="dernier" title="Descendre"><i class="fas fa-arrow-down"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="basculer(s)" [title]="s.actif ? 'Masquer du site' : 'Afficher sur le site'">
              <i [class]="s.actif ? 'fas fa-eye' : 'fas fa-eye-slash'"></i></button>
            <button class="btn btn-ghost btn-icon" type="button" (click)="ouvrir(s)" title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(s)" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-photo-film"></i>Aucune diapo : la photo par défaut est affichée. Ajoutez vos plus belles images !</div>
      }
    </div>

    <section class="adm-card apropos">
      <h2>Vidéo du bloc « Qui sommes-nous »</h2>
      <p>Une vidéo de présentation (vous, vos sorties, l’ambiance) affichée à côté du texte « Un guide passionné, pas une agence anonyme ». Elle se lance sans le son ; le visiteur peut activer le son.</p>
      <div class="apropos-row">
        @if (aproposVideo(); as v) { <video [src]="v" muted playsinline controls preload="metadata"></video> }
        @else { <div class="apropos-vide"><i class="fas fa-video"></i><span>Pas de vidéo : les 2 images actuelles sont affichées.</span></div> }
        <div class="apropos-actions">
          <label class="btn btn-primary" [class.disabled]="aproposEnvoi() !== null">
            @if (aproposEnvoi() !== null) { <i class="fas fa-spinner fa-spin"></i> Envoi : {{ aproposEnvoi() }} % }
            @else { <i class="fas fa-upload"></i> {{ aproposVideo() ? 'Remplacer la vidéo' : 'Ajouter une vidéo' }} }
            <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden (change)="choisirApropos($event)" [disabled]="aproposEnvoi() !== null">
          </label>
          @if (aproposVideo()) {
            <button class="btn btn-ghost" type="button" (click)="retirerApropos()"><i class="fas fa-trash"></i> Retirer</button>
          }
          <small>MP4 ou MOV, 200 Mo max. Format vertical ou carré idéal.</small>
        </div>
      </div>
    </section>

    @if (edit(); as e) {
      <div class="adm-overlay" (click)="fermer()">
        <aside class="adm-drawer" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header>
            <h2>{{ e.id ? 'Modifier la diapo' : 'Nouvelle diapo' }}</h2>
            <button class="btn btn-ghost btn-icon" type="button" (click)="fermer()" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
          </header>
          <form (ngSubmit)="enregistrer()" #f="ngForm">
            <div class="adm-drawer-body">
              <div class="field">
                <label>Photo ou vidéo {{ e.id ? '' : '*' }}</label>
                <label class="adm-drop">
                  @if (apercu(); as a) {
                    @if (apercuVideo()) { <video [src]="a" muted playsinline class="car-prev"></video> }
                    @else { <img [src]="a" alt=""> }
                  } @else { <div class="ph"><i class="fas fa-photo-film"></i></div> }
                  <p><strong>Choisir une photo ou une vidéo</strong><br>Format paysage de préférence. Vidéo : 200 Mo max, courte (10 à 20 s).</p>
                  <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" hidden (change)="choisir($event)">
                </label>
              </div>
              <div class="field"><label for="titre">Message principal</label>
                <input id="titre" name="titre" class="input" maxlength="120" [(ngModel)]="e.data.titre" placeholder="Ex. : Cap sur le"></div>
              <div class="field"><label for="accent">Suite du message, en couleur</label>
                <input id="accent" name="accent" class="input" maxlength="120" [(ngModel)]="e.data.accent" placeholder="Ex. : Sine Saloum"></div>
              <div class="field"><label for="texte">Petit texte en dessous</label>
                <textarea id="texte" name="texte" class="input" rows="3" maxlength="300" [(ngModel)]="e.data.texte"
                          placeholder="Ex. : Mangroves, pirogue et îles secrètes : une journée hors du temps."></textarea></div>
              <label class="check"><input type="checkbox" name="actif" [(ngModel)]="e.data.actif"> Visible sur le site</label>
            </div>
            <footer>
              @if (progression() !== null) { <span class="car-progress">Envoi : {{ progression() }} %</span> }
              <button class="btn btn-ghost" type="button" (click)="fermer()" [disabled]="saving()">Annuler</button>
              <button class="btn btn-primary" type="submit" [disabled]="saving() || (!e.id && !fichier)">
                @if (saving()) { <i class="fas fa-spinner fa-spin"></i> } Enregistrer</button>
            </footer>
          </form>
        </aside>
      </div>
    }
  `,
  styles: `
    .car-thumb { width: 112px; height: 64px; object-fit: cover; background: #0b2f32; }
    .car-accent { color: var(--teal); }
    .car-prev { width: 84px; height: 64px; border-radius: 10px; object-fit: cover; background: #000; }
    .car-progress { margin-right: auto; font-size: .85rem; color: var(--teal-dark); font-weight: 600; }
    .adm-pill i { margin-right: .2rem; }
    .apropos { margin-top: 2rem; display: grid; gap: .7rem; }
    .apropos h2 { font-size: 1.15rem; }
    .apropos > p { color: var(--muted); font-size: .9rem; }
    .apropos-row { display: flex; gap: 1.2rem; align-items: flex-start; flex-wrap: wrap; }
    .apropos-row video, .apropos-vide { width: 220px; aspect-ratio: 4 / 5; border-radius: 14px; background: #0b2f32; object-fit: cover; }
    .apropos-vide { display: grid; place-content: center; gap: .5rem; text-align: center; color: var(--muted); background: var(--teal-mist); padding: 1rem; font-size: .85rem; }
    .apropos-vide i { font-size: 1.8rem; color: var(--teal); }
    .apropos-actions { display: grid; gap: .6rem; justify-items: start; }
    .apropos-actions small { color: var(--muted); }
    .btn.disabled { opacity: .7; pointer-events: none; }
  `,
})
export class AdminCarrousel {
  private api = inject(ApiService);
  private ui = inject(AdminUi);

  slides = signal<Slide[]>([]);
  edit = signal<{ id?: number; data: SlideInput } | null>(null);
  apercu = signal<string | null>(null);
  apercuVideo = signal(false);
  progression = signal<number | null>(null);
  saving = signal(false);
  fichier: File | null = null;

  aproposVideo = signal<string | null>(null);
  aproposEnvoi = signal<number | null>(null);

  constructor() {
    this.charger();
    this.api.reglages().subscribe((r) => this.aproposVideo.set(r.apropos_video));
  }

  charger() { this.api.adminSlides().subscribe((s) => this.slides.set(s)); }

  choisirApropos(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_VIDEO_MO * 1024 * 1024) {
      this.ui.notify('Vidéo trop lourde (200 Mo max). Compressez-la avant de l’envoyer.', true);
      return;
    }
    this.aproposEnvoi.set(0);
    this.api.aproposVideo(file).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) this.aproposEnvoi.set(Math.round((100 * ev.loaded) / ev.total));
        if (ev.type === HttpEventType.Response) {
          this.aproposVideo.set(ev.body?.apropos_video ?? null);
          this.aproposEnvoi.set(null);
          this.ui.notify('Vidéo « Qui sommes-nous » en ligne.');
        }
      },
      error: (err) => { this.ui.notify(errorMessage(err), true); this.aproposEnvoi.set(null); },
    });
  }

  retirerApropos() {
    if (!confirm('Retirer la vidéo du bloc « Qui sommes-nous » ?')) return;
    this.api.deleteAproposVideo().subscribe(() => { this.aproposVideo.set(null); this.ui.notify('Vidéo retirée.'); });
  }

  ouvrir(s?: Slide) {
    this.liberer();
    this.fichier = null;
    this.progression.set(null);
    this.apercu.set(s?.media ?? null);
    this.apercuVideo.set(s?.media_type === 'video');
    const data: SlideInput = s
      ? { titre: s.titre, accent: s.accent ?? '', texte: s.texte ?? '', ordre: s.ordre, actif: s.actif }
      : VIDE();
    this.edit.set({ id: s?.id, data });
  }

  fermer() {
    if (this.saving()) return;
    this.liberer();
    this.edit.set(null);
  }

  choisir(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const video = file.type.startsWith('video/');
    if (!video && !file.type.startsWith('image/')) return;
    if (video && file.size > MAX_VIDEO_MO * 1024 * 1024) {
      this.ui.notify('Vidéo trop lourde (200 Mo max). Compressez-la avant de l’envoyer.', true);
      return;
    }
    this.liberer();
    this.fichier = file;
    this.apercuVideo.set(video);
    this.apercu.set(URL.createObjectURL(file));
  }

  enregistrer() {
    const e = this.edit();
    if (!e) return;
    this.saving.set(true);
    const data: SlideInput = { ...e.data, accent: e.data.accent || null, texte: e.data.texte || null };
    this.api.saveSlide(data, e.id).pipe(
      concatMap((s) => (this.fichier ? this.envoyerMedia(s.id, this.fichier) : of(s))),
    ).subscribe({
      next: () => {
        this.ui.notify(e.id ? 'Diapo mise à jour.' : 'Diapo ajoutée au carrousel.');
        this.saving.set(false);
        this.progression.set(null);
        this.liberer();
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

  private envoyerMedia(id: number, file: File): Observable<Slide> {
    this.progression.set(0);
    return this.api.slideMedia(id, file).pipe(
      tap((ev: HttpEvent<Slide>) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) this.progression.set(Math.round((100 * ev.loaded) / ev.total));
      }),
      filter((ev) => ev.type === HttpEventType.Response),
      map((ev) => (ev as { body: Slide }).body),
    );
  }

  /** Échange la place de la diapo avec sa voisine (renumérote tout pour éviter les égalités). */
  deplacer(i: number, sens: -1 | 1) {
    const liste = [...this.slides()];
    const j = i + sens;
    if (j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
    this.slides.set(liste);
    forkJoin(liste.map((s, k) => this.api.saveSlide(this.donnees(s, { ordre: k + 1 }), s.id)))
      .subscribe({ next: () => this.charger(), error: (err) => { this.ui.notify(errorMessage(err), true); this.charger(); } });
  }

  basculer(s: Slide) {
    this.api.saveSlide(this.donnees(s, { actif: !s.actif }), s.id).subscribe(() => this.charger());
  }

  supprimer(s: Slide) {
    if (!confirm(`Supprimer la diapo « ${s.titre} ${s.accent ?? ''} » (photo ou vidéo comprise) ?`)) return;
    this.api.deleteSlide(s.id).subscribe(() => { this.ui.notify('Diapo supprimée.'); this.charger(); });
  }

  private donnees(s: Slide, changement: Partial<SlideInput>): SlideInput {
    const { titre, accent, texte, ordre, actif } = s;
    return { titre, accent, texte, ordre, actif, ...changement };
  }

  private liberer() {
    const a = this.apercu();
    if (a?.startsWith('blob:')) URL.revokeObjectURL(a);
  }
}
