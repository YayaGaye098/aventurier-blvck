import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { marked } from 'marked';
import { concatMap, of } from 'rxjs';
import { ApiService, errorMessage } from '../core/api.service';
import { ArticleInput } from '../core/models';
import { AdminUi, preview } from './ui';

const VIDE: ArticleInput = { titre: '', slug: '', extrait: '', contenu: '', categorie: '', publie: false };

@Component({
  selector: 'app-blog-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="adm-head">
      <div>
        <a routerLink="/admin/blog" class="back"><i class="fas fa-arrow-left"></i> Tous les articles</a>
        <h1>{{ id() ? 'Modifier l’article' : 'Nouvel article' }}</h1>
      </div>
      <div class="top-actions">
        @if (id() && data.publie && slugActuel()) {
          <a class="btn btn-ghost btn-sm" [routerLink]="['/blog', slugActuel()]" target="_blank"><i class="fas fa-eye"></i> Voir</a>
        }
        <button class="btn btn-ghost btn-sm" type="button" (click)="enregistrer(false)" [disabled]="saving() || !data.titre">
          {{ data.publie ? 'Repasser en brouillon' : 'Enregistrer le brouillon' }}</button>
        <button class="btn btn-primary btn-sm" type="button" (click)="enregistrer(true)" [disabled]="saving() || !data.titre">
          @if (saving()) { <i class="fas fa-spinner fa-spin"></i> } @else { <i class="fas fa-paper-plane"></i> }
          {{ data.publie ? 'Mettre à jour' : 'Publier' }}</button>
      </div>
    </div>

    <div class="layout">
      <div class="adm-card main">
        <input class="title-input" name="titre" [(ngModel)]="data.titre" placeholder="Titre de l'article" aria-label="Titre">
        <div class="field">
          <label for="extrait">Résumé <span class="hint">(affiché sur les cartes et dans Google · {{ data.extrait.length }}/300)</span></label>
          <textarea id="extrait" class="input" rows="2" maxlength="300" [(ngModel)]="data.extrait"
                    placeholder="Une ou deux phrases qui donnent envie de lire."></textarea>
        </div>

        <div class="tabs" role="tablist">
          <button type="button" role="tab" [class.on]="onglet() === 'ecrire'" (click)="onglet.set('ecrire')"><i class="fas fa-pen"></i> Écrire</button>
          <button type="button" role="tab" [class.on]="onglet() === 'apercu'" (click)="onglet.set('apercu')"><i class="fas fa-eye"></i> Aperçu</button>
        </div>

        @if (onglet() === 'ecrire') {
          <div class="toolbar" aria-label="Mise en forme">
            <button type="button" (click)="ligne('## ')" title="Titre"><i class="fas fa-heading"></i></button>
            <button type="button" (click)="entourer('**')" title="Gras"><i class="fas fa-bold"></i></button>
            <button type="button" (click)="entourer('*')" title="Italique"><i class="fas fa-italic"></i></button>
            <button type="button" (click)="ligne('- ')" title="Liste"><i class="fas fa-list-ul"></i></button>
            <button type="button" (click)="ligne('1. ')" title="Liste numérotée"><i class="fas fa-list-ol"></i></button>
            <button type="button" (click)="ligne('> ')" title="Encadré / citation"><i class="fas fa-quote-left"></i></button>
            <button type="button" (click)="lien()" title="Lien"><i class="fas fa-link"></i></button>
            <label class="tb-file" title="Insérer une photo">
              @if (envoiImage()) { <i class="fas fa-spinner fa-spin"></i> } @else { <i class="fas fa-image"></i> }
              <input type="file" accept="image/*" hidden (change)="insererImage($event)">
            </label>
          </div>
          <textarea #editeur class="input editor" [(ngModel)]="data.contenu" (ngModelChange)="contenu.set($event)"
                    placeholder="Racontez votre aventure…&#10;&#10;Astuce : ## pour un intertitre, **gras**, - pour une liste."></textarea>
        } @else {
          <div class="preview" [innerHTML]="html()"></div>
        }
      </div>

      <aside class="side">
        <div class="adm-card">
          <h2>Image de couverture</h2>
          <label class="cover">
            @if (apercu()) { <img [src]="apercu()" alt=""> }
            @else { <div class="ph"><i class="fas fa-image"></i><span>Choisir une photo</span></div> }
            <input type="file" accept="image/*" hidden (change)="choisirCouverture($event)">
          </label>
          @if (apercu()) { <p class="hint">Cliquez sur l'image pour la changer.</p> }
        </div>
        <div class="adm-card fields">
          <h2>Réglages</h2>
          <div class="field">
            <label for="cat">Catégorie</label>
            <input id="cat" class="input" list="cats" [(ngModel)]="data.categorie" placeholder="Ex. : Conseils, Destinations">
            <datalist id="cats">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist>
          </div>
          <div class="field">
            <label for="slug">Adresse de l'article</label>
            <input id="slug" class="input" [(ngModel)]="data.slug" placeholder="générée depuis le titre">
            <span class="hint">/blog/{{ data.slug || 'titre-de-l-article' }}</span>
          </div>
          <p class="status">Statut :
            @if (data.publie) { <span class="adm-pill">Publié</span> } @else { <span class="adm-pill off">Brouillon</span> }
          </p>
        </div>
      </aside>
    </div>
  `,
  styles: `
    .back { color: var(--muted); text-decoration: none; font-size: .88rem; font-weight: 600; display: inline-flex; gap: .4rem; align-items: center; margin-bottom: .3rem; }
    .back:hover { color: var(--teal); }
    .top-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.2rem; align-items: start; }
    .main { display: grid; gap: 1rem; }
    .title-input { border: 0; font-family: var(--font-display); font-size: 1.9rem; font-weight: 800; padding: .2rem 0; width: 100%; }
    .title-input:focus { outline: none; }
    .tabs { display: flex; gap: .3rem; border-bottom: 1px solid var(--line); }
    .tabs button { background: none; border: 0; padding: .6rem .9rem; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    .tabs button.on { color: var(--teal); border-color: var(--teal); }
    .toolbar { display: flex; flex-wrap: wrap; gap: .25rem; }
    .toolbar button, .tb-file { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid var(--line); background: #fff; border-radius: 9px; cursor: pointer; color: var(--ink); }
    .toolbar button:hover, .tb-file:hover { background: var(--teal-soft); color: var(--teal); }
    .editor { min-height: 460px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .92rem; line-height: 1.7; }
    .preview { min-height: 460px; font-size: 1.02rem; line-height: 1.75; }
    .preview ::ng-deep h2 { font-size: 1.5rem; margin: 1.5rem 0 .6rem; }
    .preview ::ng-deep h3 { font-size: 1.2rem; margin: 1.2rem 0 .5rem; }
    .preview ::ng-deep :is(p, ul, ol) { margin: 0 0 1rem; }
    .preview ::ng-deep img { border-radius: 12px; margin: 1rem 0; }
    .preview ::ng-deep blockquote { margin: 1rem 0; padding: .8rem 1rem; background: var(--teal-mist); border-left: 4px solid var(--teal-bright); border-radius: 0 10px 10px 0; }
    .side { display: grid; gap: 1.2rem; position: sticky; top: 1rem; }
    .side h2 { font-family: var(--font-body); font-size: .95rem; font-weight: 700; margin-bottom: .8rem; }
    .fields { display: grid; gap: 1rem; }
    .fields h2 { margin: 0; }
    .cover { display: block; cursor: pointer; border-radius: 12px; overflow: hidden; }
    .cover img { width: 100%; aspect-ratio: 16/10; object-fit: cover; }
    .cover .ph { aspect-ratio: 16/10; border: 2px dashed var(--line); border-radius: 12px; display: grid; place-content: center; justify-items: center; gap: .4rem; color: var(--teal); font-weight: 600; font-size: .9rem; }
    .cover .ph i { font-size: 1.6rem; }
    .cover:hover .ph { border-color: var(--teal); background: var(--teal-mist); }
    .hint { color: var(--muted); font-size: .78rem; font-weight: 400; }
    .status { font-size: .9rem; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
  `,
})
export class BlogEditor {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  private router = inject(Router);
  private editeur = viewChild<ElementRef<HTMLTextAreaElement>>('editeur');

  id = signal<number | null>(null);
  data: ArticleInput = { ...VIDE };
  contenu = signal('');
  html = computed(() => marked.parse(this.contenu(), { async: false }) as string);
  onglet = signal<'ecrire' | 'apercu'>('ecrire');
  apercu = signal<string | null>(null);
  slugActuel = signal('');
  categories = signal<string[]>([]);
  couverture: File | null = null;
  saving = signal(false);
  envoiImage = signal(false);

  constructor() {
    this.api.adminArticles().subscribe((all) =>
      this.categories.set([...new Set(all.map((a) => a.categorie).filter((c): c is string => !!c))].sort()));
    const param = inject(ActivatedRoute).snapshot.paramMap.get('id');
    const id = Number(param);
    if (param !== 'nouveau' && id) {
      this.api.adminArticle(id).subscribe({
        next: (a) => {
          this.id.set(a.id);
          this.data = { titre: a.titre, slug: a.slug, extrait: a.extrait, contenu: a.contenu, categorie: a.categorie ?? '', publie: a.publie };
          this.contenu.set(a.contenu);
          this.apercu.set(a.image);
          this.slugActuel.set(a.slug);
        },
        error: () => this.router.navigate(['/admin/blog']),
      });
    }
  }

  async choisirCouverture(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) { this.couverture = file; this.apercu.set(await preview(file)); }
  }

  enregistrer(publier: boolean) {
    // « Publier » publie ; le bouton secondaire enregistre en brouillon (ou dépublie).
    const data: ArticleInput = { ...this.data, publie: publier, slug: this.data.slug || null, categorie: this.data.categorie || null };
    const etaitPublie = this.data.publie;
    this.saving.set(true);
    this.api.saveArticle(data, this.id() ?? undefined).pipe(
      concatMap((a) => (this.couverture ? this.api.articleImage(a.id, this.couverture) : of(a))),
    ).subscribe({
      next: (a) => {
        this.couverture = null;
        this.saving.set(false);
        this.data = { ...this.data, slug: a.slug, publie: a.publie };
        this.slugActuel.set(a.slug);
        this.ui.notify(a.publie ? (etaitPublie ? 'Article mis à jour.' : 'Article publié !') : 'Brouillon enregistré.');
        if (!this.id()) {
          this.id.set(a.id);
          this.router.navigate(['/admin/blog', a.id], { replaceUrl: true });
        }
      },
      error: (e) => { this.ui.notify(errorMessage(e), true); this.saving.set(false); },
    });
  }

  // ── Barre d'outils Markdown ─────────────────────────
  private remplacer(debut: number, fin: number, texte: string, curseur: number) {
    const t = this.editeur()?.nativeElement;
    this.data.contenu = this.data.contenu.slice(0, debut) + texte + this.data.contenu.slice(fin);
    this.contenu.set(this.data.contenu);
    if (t) {
      t.value = this.data.contenu;
      t.focus();
      t.setSelectionRange(curseur, curseur);
    }
  }

  entourer(marque: string) {
    const t = this.editeur()?.nativeElement;
    if (!t) return;
    const { selectionStart: a, selectionEnd: b } = t;
    const sel = this.data.contenu.slice(a, b) || 'texte';
    this.remplacer(a, b, marque + sel + marque, a + marque.length + sel.length + marque.length);
  }

  ligne(prefixe: string) {
    const t = this.editeur()?.nativeElement;
    if (!t) return;
    const debut = this.data.contenu.lastIndexOf('\n', t.selectionStart - 1) + 1;
    this.remplacer(debut, debut, prefixe, t.selectionStart + prefixe.length);
  }

  lien() {
    const t = this.editeur()?.nativeElement;
    if (!t) return;
    const url = prompt('Adresse du lien (https://…)');
    if (!url) return;
    const { selectionStart: a, selectionEnd: b } = t;
    const sel = this.data.contenu.slice(a, b) || 'texte du lien';
    const md = `[${sel}](${url})`;
    this.remplacer(a, b, md, a + md.length);
  }

  insererImage(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const pos = this.editeur()?.nativeElement.selectionStart ?? this.data.contenu.length;
    this.envoiImage.set(true);
    this.api.uploadInline(file).subscribe({
      next: ({ url }) => {
        const md = `\n![Photo](${url})\n`;
        this.remplacer(pos, pos, md, pos + md.length);
        this.envoiImage.set(false);
      },
      error: (e) => { this.ui.notify(errorMessage(e), true); this.envoiImage.set(false); },
    });
  }
}
