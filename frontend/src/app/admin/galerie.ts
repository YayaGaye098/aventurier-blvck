import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { from, concatMap, finalize } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Photo } from '../core/models';
import { MAX_VIDEO_MO, AdminUi } from './ui';

@Component({
  selector: 'app-admin-galerie',
  imports: [FormsModule],
  template: `
    <div class="adm-head">
      <div><h1>Galerie</h1><p>Les 12 photos ou vidéos actives les plus récentes s'affichent sur le site.</p></div>
    </div>

    <label class="adm-card adm-drop" style="margin-bottom:1.5rem" [class.over]="over()"
           (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="drop($event)">
      <div class="ph">@if (envoi()) { <i class="fas fa-spinner fa-spin"></i> } @else { <i class="fas fa-cloud-arrow-up"></i> }</div>
      <p>@if (envoi()) { Envoi de {{ envoi() }} fichier(s)… }
         @else { <strong>Ajouter des photos ou des vidéos</strong><br>Cliquez ou glissez-en plusieurs ici · photo 20 Mo max · vidéo 200 Mo max (MP4, MOV) }</p>
      <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden (change)="choisir($event)">
    </label>

    <div class="grid">
      @for (p of photos(); track p.id) {
        <figure class="adm-card ph-card" [class.off]="!p.actif">
          @if (p.media_type === 'video') {
            <div class="vid"><video [src]="p.image + '#t=0.5'" muted playsinline preload="metadata"></video><span><i class="fas fa-play"></i></span></div>
          } @else {
            <img [src]="p.image" [alt]="p.titre || ''" loading="lazy">
          }
          <figcaption>
            <input class="input" [(ngModel)]="p.titre" (blur)="maj(p)" placeholder="Légende (facultative)" [attr.aria-label]="'Légende photo ' + p.id">
            <div class="acts">
              <button class="btn btn-ghost btn-icon" type="button" (click)="p.actif = !p.actif; maj(p)" [title]="p.actif ? 'Masquer' : 'Afficher'">
                <i [class]="p.actif ? 'fas fa-eye' : 'fas fa-eye-slash'"></i></button>
              <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(p)" title="Supprimer"><i class="fas fa-trash"></i></button>
            </div>
          </figcaption>
        </figure>
      } @empty {
        <div class="adm-card adm-empty" style="grid-column:1/-1"><i class="fas fa-images"></i>Aucune photo pour l'instant.</div>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .ph-card { padding: 0; margin: 0; overflow: hidden; }
    .ph-card.off img, .ph-card.off video { opacity: .4; }
    .ph-card img, .ph-card video { display: block; width: 100%; height: 170px; object-fit: cover; background: #0b2f32; }
    .vid { position: relative; }
    .vid span { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-size: 1.4rem; pointer-events: none; text-shadow: 0 2px 8px rgba(0,0,0,.5); }
    figcaption { padding: .7rem; display: flex; gap: .4rem; align-items: center; }
    figcaption .input { padding: .45rem .6rem; font-size: .85rem; }
    .acts { display: flex; gap: .3rem; }
  `,
})
export class AdminGalerie {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  photos = signal<Photo[]>([]);
  over = signal(false);
  envoi = signal(0);

  constructor() { this.charger(); }

  charger() { this.api.adminPhotos().subscribe((p) => this.photos.set(p)); }

  choisir(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.envoyer([...(input.files ?? [])]);
    input.value = '';
  }

  drop(ev: DragEvent) {
    ev.preventDefault();
    this.over.set(false);
    this.envoyer([...(ev.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/')));
  }

  envoyer(files: File[]) {
    const tropLourdes = files.filter((f) => f.type.startsWith('video/') && f.size > MAX_VIDEO_MO * 1024 * 1024);
    if (tropLourdes.length) this.ui.notify(`${tropLourdes.length} vidéo(s) de plus de 200 Mo ignorée(s) : compressez-les d'abord.`, true);
    files = files.filter((f) => !tropLourdes.includes(f));
    if (!files.length) return;
    this.envoi.set(files.length);
    let ok = 0;
    from(files).pipe(
      concatMap((f) => this.api.addPhoto(f, '', '')),
      finalize(() => { this.envoi.set(0); this.charger(); }),
    ).subscribe({
      next: () => { ok++; this.ui.notify(`${ok} fichier(s) ajouté(s).`); },
      error: (e) => this.ui.notify(errorMessage(e), true),
    });
  }

  maj(p: Photo) {
    this.api.updatePhoto(p).subscribe({ error: (e) => this.ui.notify(errorMessage(e), true) });
  }

  supprimer(p: Photo) {
    if (!confirm(p.media_type === 'video' ? 'Supprimer cette vidéo ?' : 'Supprimer cette photo ?')) return;
    this.api.deletePhoto(p.id).subscribe(() => { this.ui.notify('Supprimé de la galerie.'); this.charger(); });
  }
}
