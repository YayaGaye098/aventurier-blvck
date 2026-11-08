import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { from, concatMap, finalize } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { Photo } from '../core/models';
import { AdminUi } from './ui';

@Component({
  selector: 'app-admin-galerie',
  imports: [FormsModule],
  template: `
    <div class="adm-head">
      <div><h1>Galerie</h1><p>Les 12 photos actives les plus récentes s'affichent sur le site.</p></div>
    </div>

    <label class="adm-card adm-drop" style="margin-bottom:1.5rem" [class.over]="over()"
           (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="drop($event)">
      <div class="ph">@if (envoi()) { <i class="fas fa-spinner fa-spin"></i> } @else { <i class="fas fa-cloud-arrow-up"></i> }</div>
      <p>@if (envoi()) { Envoi de {{ envoi() }} photo(s)… }
         @else { <strong>Ajouter des photos</strong><br>Cliquez ou glissez-en plusieurs ici · 5 Mo max chacune }</p>
      <input type="file" accept="image/*" multiple hidden (change)="choisir($event)">
    </label>

    <div class="grid">
      @for (p of photos(); track p.id) {
        <figure class="adm-card ph-card" [class.off]="!p.actif">
          <img [src]="p.image" [alt]="p.titre || ''" loading="lazy">
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
    .ph-card.off img { opacity: .4; }
    .ph-card img { width: 100%; height: 170px; object-fit: cover; }
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
    this.envoyer([...(ev.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/')));
  }

  envoyer(files: File[]) {
    if (!files.length) return;
    this.envoi.set(files.length);
    let ok = 0;
    from(files).pipe(
      concatMap((f) => this.api.addPhoto(f, '', '')),
      finalize(() => { this.envoi.set(0); this.charger(); }),
    ).subscribe({
      next: () => { ok++; this.ui.notify(`${ok} photo(s) ajoutée(s).`); },
      error: (e) => this.ui.notify(errorMessage(e), true),
    });
  }

  maj(p: Photo) {
    this.api.updatePhoto(p).subscribe({ error: (e) => this.ui.notify(errorMessage(e), true) });
  }

  supprimer(p: Photo) {
    if (!confirm('Supprimer cette photo ?')) return;
    this.api.deletePhoto(p.id).subscribe(() => { this.ui.notify('Photo supprimée.'); this.charger(); });
  }
}
