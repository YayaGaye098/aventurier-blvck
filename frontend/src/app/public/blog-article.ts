import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { marked } from 'marked';
import { ApiService } from '../core/api.service';
import { Article, ArticleCard } from '../core/models';
import { PostCard } from './post-card';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-blog-article',
  imports: [SiteHeader, SiteFooter, PostCard, RouterLink, DatePipe],
  template: `
    <app-site-header />

    @if (notFound()) {
      <section class="section container nf">
        <h1>Article introuvable</h1>
        <p class="sub">Il a peut-être été déplacé ou supprimé.</p>
        <a routerLink="/blog" class="btn btn-primary">Retour au blog</a>
      </section>
    } @else if (article(); as a) {
      <article>
        <header class="head container-narrow">
          <a routerLink="/blog" class="back"><i class="fas fa-arrow-left"></i> Blog</a>
          @if (a.categorie) {
            <a class="cat" routerLink="/blog" [queryParams]="{ categorie: a.categorie }">{{ a.categorie }}</a>
          }
          <h1>{{ a.titre }}</h1>
          @if (a.extrait) { <p class="lead">{{ a.extrait }}</p> }
          <p class="meta">
            <img src="/images/logo-icon.png" alt="" width="34">
            <span>Aventurier Blvck · {{ a.published_at | date:'d MMMM y' }} · {{ a.temps_lecture }} min de lecture</span>
          </p>
        </header>

        @if (a.image) {
          <div class="cover container"><img [src]="a.image" [alt]="a.titre"></div>
        }

        <div class="prose container-narrow" [innerHTML]="html()"></div>

        <div class="container-narrow share">
          <span>Partager :</span>
          <a class="btn btn-ghost btn-icon" [href]="'https://wa.me/?text=' + enc(a.titre + ' ' + url)" target="_blank" rel="noopener" aria-label="Partager sur WhatsApp"><i class="fab fa-whatsapp"></i></a>
          <a class="btn btn-ghost btn-icon" [href]="'https://www.facebook.com/sharer/sharer.php?u=' + enc(url)" target="_blank" rel="noopener" aria-label="Partager sur Facebook"><i class="fab fa-facebook-f"></i></a>
          <button class="btn btn-ghost btn-icon" type="button" (click)="copier()" [attr.aria-label]="copie() ? 'Lien copié' : 'Copier le lien'">
            <i class="fas" [class.fa-link]="!copie()" [class.fa-check]="copie()"></i></button>
        </div>

        <aside class="container-narrow cta">
          <div>
            <h2>Envie de vivre ça ?</h2>
            <p>Dites-nous où et quand : on organise la sortie pour vous.</p>
          </div>
          <a routerLink="/" fragment="contact" class="btn btn-sun">Organiser ma sortie <i class="fas fa-arrow-right"></i></a>
        </aside>
      </article>

      @if (autres().length) {
        <section class="section section-tint">
          <div class="container">
            <div class="section-head"><p class="kicker">À lire aussi</p><h2>Autres articles</h2></div>
            <div class="posts">@for (p of autres(); track p.id) { <app-post-card [article]="p" /> }</div>
          </div>
        </section>
      }
    } @else {
      <div class="container-narrow" style="padding:4rem 0"><div class="skeleton" style="height:320px"></div></div>
    }

    <app-site-footer />
  `,
  styles: `
    .container-narrow { width: min(760px, 100% - 2.5rem); margin-inline: auto; }
    .nf { text-align: center; display: grid; gap: 1rem; justify-items: center; }
    .head { padding: 3rem 0 2rem; }
    .back { display: inline-flex; gap: .4rem; align-items: center; color: var(--muted); text-decoration: none; font-weight: 600; font-size: .9rem; margin-right: 1rem; }
    .back:hover { color: var(--teal); }
    .cat { display: inline-block; background: var(--teal-soft); color: var(--teal-dark); font-weight: 700; font-size: .78rem; padding: .3rem .8rem; border-radius: 999px; text-decoration: none; }
    h1 { font-size: clamp(2rem, 5vw, 3.1rem); font-weight: 800; margin: 1.2rem 0 1rem; }
    .lead { font-size: 1.2rem; color: var(--muted); }
    .meta { display: flex; align-items: center; gap: .7rem; margin-top: 1.5rem; color: var(--muted); font-size: .9rem; }
    .meta img { width: 34px; height: auto; }
    .cover { margin-bottom: 2.5rem; }
    .cover img { width: 100%; max-height: 560px; object-fit: cover; border-radius: 22px; }

    .prose { font-size: 1.1rem; line-height: 1.8; }
    .prose ::ng-deep h2 { font-size: 1.7rem; margin: 2.2rem 0 .8rem; }
    .prose ::ng-deep h3 { font-size: 1.3rem; margin: 1.8rem 0 .6rem; }
    .prose ::ng-deep p { margin: 0 0 1.2rem; }
    .prose ::ng-deep ul, .prose ::ng-deep ol { padding-left: 1.4rem; margin: 0 0 1.2rem; }
    .prose ::ng-deep li { margin-bottom: .4rem; }
    .prose ::ng-deep li::marker { color: var(--teal); font-weight: 700; }
    .prose ::ng-deep a { color: var(--teal); font-weight: 600; }
    .prose ::ng-deep img { border-radius: 16px; margin: 1.5rem 0; width: 100%; }
    .prose ::ng-deep blockquote { margin: 1.5rem 0; padding: 1rem 1.3rem; background: var(--teal-mist); border-left: 4px solid var(--teal-bright); border-radius: 0 12px 12px 0; }
    .prose ::ng-deep blockquote p:last-child { margin: 0; }
    .prose ::ng-deep em { color: var(--muted); }
    .prose ::ng-deep hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }

    .share { display: flex; align-items: center; gap: .5rem; padding: 1.5rem 0; border-top: 1px solid var(--line); margin-top: 2rem; color: var(--muted); font-weight: 600; }
    .cta { display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap;
      background: linear-gradient(135deg, var(--teal), var(--teal-dark)); color: #fff; padding: 2rem; border-radius: 22px; margin: 1rem auto 5rem; }
    .cta h2 { font-size: 1.5rem; }
    .cta p { opacity: .9; }
    .posts { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
  `,
})
export class BlogArticle {
  private api = inject(ApiService);
  private title = inject(Title);
  private meta = inject(Meta);

  article = signal<Article | null>(null);
  autres = signal<ArticleCard[]>([]);
  notFound = signal(false);
  copie = signal(false);
  html = computed(() => marked.parse(this.article()?.contenu ?? '', { async: false }) as string);
  url = '';

  constructor() {
    inject(ActivatedRoute).paramMap.subscribe((p) => this.charger(p.get('slug') ?? ''));
  }

  charger(slug: string) {
    this.article.set(null);
    this.notFound.set(false);
    this.url = location.href;
    this.api.article(slug).subscribe({
      next: (a) => {
        this.article.set(a);
        this.title.setTitle(`${a.titre} – Aventurier Blvck`);
        this.meta.updateTag({ name: 'description', content: a.extrait });
        this.meta.updateTag({ property: 'og:title', content: a.titre });
        if (a.image) this.meta.updateTag({ property: 'og:image', content: location.origin + a.image });
        this.api.articles(1, 4).subscribe((p) => this.autres.set(p.items.filter((x) => x.id !== a.id).slice(0, 3)));
      },
      error: () => { this.notFound.set(true); this.title.setTitle('Article introuvable – Aventurier Blvck'); },
    });
  }

  enc(s: string) { return encodeURIComponent(s); }

  copier() {
    navigator.clipboard?.writeText(this.url).then(() => {
      this.copie.set(true);
      setTimeout(() => this.copie.set(false), 2000);
    });
  }
}
