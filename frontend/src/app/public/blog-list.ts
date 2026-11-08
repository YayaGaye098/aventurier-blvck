import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { ApiService } from '../core/api.service';
import { ArticlePage } from '../core/models';
import { PostCard } from './post-card';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-blog-list',
  imports: [SiteHeader, SiteFooter, PostCard, RouterLink],
  template: `
    <app-site-header />
    <section class="blog-hero">
      <div class="container">
        <p class="kicker">Le blog</p>
        <h1>Récits, conseils et bons plans pour voyager au Sénégal</h1>
        <p class="sub">Préparer une sortie, choisir sa destination, découvrir les coulisses de nos aventures.</p>
      </div>
    </section>

    <section class="section" style="padding-top:2.5rem">
      <div class="container">
        @if (categories().length) {
          <div class="chips" aria-label="Catégories">
            <a class="chip" routerLink="/blog" [class.on]="!categorie()">Tous</a>
            @for (c of categories(); track c) {
              <a class="chip" routerLink="/blog" [queryParams]="{ categorie: c }" [class.on]="categorie() === c">{{ c }}</a>
            }
          </div>
        }

        @if (loading()) {
          <div class="posts">@for (i of [1,2,3]; track i) { <div class="skeleton" style="height:360px"></div> }</div>
        } @else if (data(); as d) {
          @if (d.items.length === 0) {
            <p class="empty">Aucun article pour le moment. Revenez bientôt !</p>
          }
          <div class="posts">
            @for (a of d.items; track a.id) { <app-post-card [article]="a" /> }
          </div>
          @if (d.pages > 1) {
            <nav class="pager" aria-label="Pagination">
              <a class="btn btn-ghost btn-sm" [class.disabled]="d.page <= 1" routerLink="/blog"
                 [queryParams]="{ page: d.page - 1, categorie: categorie() || null }"><i class="fas fa-arrow-left"></i> Précédents</a>
              <span>Page {{ d.page }} / {{ d.pages }}</span>
              <a class="btn btn-ghost btn-sm" [class.disabled]="d.page >= d.pages" routerLink="/blog"
                 [queryParams]="{ page: d.page + 1, categorie: categorie() || null }">Suivants <i class="fas fa-arrow-right"></i></a>
            </nav>
          }
        }
      </div>
    </section>
    <app-site-footer />
  `,
  styles: `
    .blog-hero { background: linear-gradient(180deg, var(--teal-soft), #fff); padding: 4rem 0 1rem; }
    .blog-hero h1 { font-size: clamp(2rem, 4.5vw, 3.2rem); font-weight: 800; max-width: 820px; }
    .blog-hero .kicker { color: var(--teal); font-weight: 700; font-size: .82rem; text-transform: uppercase; letter-spacing: .14em; margin-bottom: .6rem; }
    .chips a { text-decoration: none; color: inherit; }
    .chips a.on { color: #fff; }
    .posts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .pager { display: flex; justify-content: center; align-items: center; gap: 1.2rem; margin-top: 3rem; color: var(--muted); }
    .pager .disabled { pointer-events: none; opacity: .4; }
  `,
})
export class BlogList {
  private api = inject(ApiService);
  data = signal<ArticlePage | null>(null);
  categories = signal<string[]>([]);
  categorie = signal('');
  loading = signal(true);

  constructor() {
    inject(Meta).updateTag({ name: 'description', content: 'Le blog d\'Aventurier Blvck : conseils, récits et bons plans pour voyager au Sénégal.' });
    this.api.categoriesBlog().subscribe((c) => this.categories.set(c));
    inject(ActivatedRoute).queryParamMap.subscribe((q) => {
      const page = Number(q.get('page')) || 1;
      this.categorie.set(q.get('categorie') ?? '');
      this.loading.set(true);
      this.api.articles(page, 9, this.categorie()).subscribe({
        next: (d) => { this.data.set(d); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    });
  }
}
