import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { marked } from 'marked';
import { ApiService } from '../core/api.service';
import { AGENCE, Article, ArticleCard, Embed } from '../core/models';
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

        <!-- Photos & vidéos de l'article (ou, à défaut, les dernières de la galerie) -->
        @if (illustrations().length) {
          <section class="container illus" aria-label="En images">
            <h2 class="illus-title"><i class="fas fa-camera"></i> {{ a.medias.length ? 'En images' : 'Nos dernières sorties en images' }}</h2>
            <div class="illus-grid">
              @for (m of illustrations(); track m.fichier; let i = $index) {
                <button type="button" class="illus-item" [class.big]="i === 0 && illustrations().length > 2" (click)="ouverte.set(i)"
                        [attr.aria-label]="(m.media_type === 'video' ? 'Lire la vidéo ' : 'Agrandir la photo ') + (i + 1)">
                  @if (m.media_type === 'video') {
                    <video [src]="m.fichier + '#t=0.5'" muted playsinline preload="metadata"></video>
                    <span class="illus-play"><i class="fas fa-play"></i></span>
                  } @else {
                    <img [src]="m.fichier" alt="" loading="lazy">
                  }
                </button>
              }
            </div>
          </section>
        }

        <!-- Vidéos TikTok / publications Instagram (lecteurs officiels) -->
        @if (a.embeds.length) {
          <section class="container illus" aria-label="En vidéo">
            <h2 class="illus-title"><i class="fas fa-circle-play"></i> En vidéo</h2>
            <div class="embeds">
              @for (e of a.embeds; track e.url) {
                <figure class="embed" [class.tiktok]="e.plateforme === 'tiktok'">
                  <iframe [src]="lecteur(e)" [title]="(e.plateforme === 'tiktok' ? 'Vidéo TikTok' : 'Publication Instagram') + ' – Aventurier Blvck'"
                          loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
                  <figcaption><a [href]="e.url" target="_blank" rel="noopener">
                    <i class="fab" [class.fa-tiktok]="e.plateforme === 'tiktok'" [class.fa-instagram]="e.plateforme === 'instagram'"></i>
                    Voir sur {{ e.plateforme === 'tiktok' ? 'TikTok' : 'Instagram' }}</a></figcaption>
                </figure>
              }
            </div>
            <p class="follow">Plus de vidéos de nos sorties sur
              <a [href]="agence.tiktok" target="_blank" rel="noopener"><i class="fab fa-tiktok"></i> TikTok</a> et
              <a [href]="agence.instagram" target="_blank" rel="noopener"><i class="fab fa-instagram"></i> Instagram</a>.</p>
          </section>
        }

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

    @if (ouverte() !== null && illustrations()[ouverte()!]; as m) {
      <div class="lb" role="dialog" aria-modal="true" (click)="ouverte.set(null)">
        <button type="button" class="lb-btn lb-close" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
        @if (illustrations().length > 1) {
          <button type="button" class="lb-btn lb-prev" aria-label="Précédente" (click)="$event.stopPropagation(); pas(-1)"><i class="fas fa-chevron-left"></i></button>
          <button type="button" class="lb-btn lb-next" aria-label="Suivante" (click)="$event.stopPropagation(); pas(1)"><i class="fas fa-chevron-right"></i></button>
        }
        @if (m.media_type === 'video') {
          <video [src]="m.fichier" controls autoplay playsinline (click)="$event.stopPropagation()"></video>
        } @else {
          <img [src]="m.fichier" alt="" (click)="$event.stopPropagation()">
        }
      </div>
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

    .illus { margin-top: 2.5rem; }
    .illus-title { font-size: 1.35rem; margin-bottom: 1rem; display: flex; align-items: center; gap: .5rem; }
    .illus-title i { color: var(--orange); }
    .illus-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); grid-auto-rows: 200px; gap: .6rem; }
    .illus-item { position: relative; padding: 0; border: 0; border-radius: 14px; overflow: hidden; cursor: zoom-in; background: #0b2f32; }
    .illus-item.big { grid-column: span 2; grid-row: span 2; }
    .illus-item img, .illus-item video { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
    .illus-item:hover img, .illus-item:hover video { transform: scale(1.05); }
    .illus-play { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
    .illus-play i { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.92);
      color: var(--teal-dark); padding-left: 4px; box-shadow: 0 8px 20px rgba(0,0,0,.3); }
    .embeds { display: flex; flex-wrap: wrap; gap: 1.2rem; justify-content: center; }
    .embed { margin: 0; width: min(100%, 340px); display: grid; gap: .4rem; }
    .embed iframe { width: 100%; height: 640px; border: 0; border-radius: 14px; background: var(--teal-mist); }
    .embed.tiktok iframe { height: 740px; }
    .embed figcaption { text-align: center; font-size: .85rem; }
    .embed figcaption a, .follow a { color: var(--teal); font-weight: 600; text-decoration: none; }
    .follow { text-align: center; color: var(--muted); margin-top: 1.2rem; }
    .lb { position: fixed; inset: 0; z-index: 100; background: rgba(6, 30, 32, .94); display: grid; place-items: center; padding: 3rem 4.5rem; }
    .lb img, .lb video { max-height: 86vh; max-width: 100%; border-radius: 10px; object-fit: contain; background: #000; }
    .lb-btn { position: absolute; background: rgba(255,255,255,.14); color: #fff; border: 0; width: 46px; height: 46px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; }
    .lb-btn:hover { background: rgba(255,255,255,.28); }
    .lb-close { top: 1.2rem; right: 1.2rem; }
    .lb-prev, .lb-next { top: calc(50% - 23px); }
    .lb-prev { left: 1rem; }
    .lb-next { right: 1rem; }
    @media (max-width: 640px) {
      .illus-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 150px; }
      .lb { padding: 3.5rem .5rem; }
      .lb-prev, .lb-next { top: auto; bottom: 1rem; }
      .lb-prev { left: calc(50% - 56px); }
      .lb-next { right: calc(50% - 56px); }
    }
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
  private sanitizer = inject(DomSanitizer);
  readonly agence = AGENCE;

  article = signal<Article | null>(null);
  autres = signal<ArticleCard[]>([]);
  notFound = signal(false);
  copie = signal(false);
  /** Photos/vidéos de la galerie, utilisées si l'article n'a pas ses propres illustrations. */
  galerie = signal<{ fichier: string; media_type: 'image' | 'video' }[]>([]);
  illustrations = computed(() => {
    const a = this.article();
    if (!a) return [];
    if (a.medias.length) return a.medias;
    return a.embeds.length ? [] : this.galerie();
  });
  ouverte = signal<number | null>(null);
  private lecteurs = new Map<string, SafeResourceUrl>();
  html = computed(() => marked.parse(this.article()?.contenu ?? '', { async: false }) as string);
  url = '';

  constructor() {
    inject(ActivatedRoute).paramMap.subscribe((p) => this.charger(p.get('slug') ?? ''));
    this.api.photos(6).subscribe({
      next: (ps) => this.galerie.set(ps.map((p) => ({ fichier: p.image, media_type: p.media_type }))),
      error: () => {},
    });
  }

  charger(slug: string) {
    this.article.set(null);
    this.ouverte.set(null);
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

  /** Adresse du lecteur officiel (construite uniquement à partir d'un identifiant vérifié). */
  lecteur(e: Embed): SafeResourceUrl {
    let url = this.lecteurs.get(e.url);
    if (!url) {
      const src = e.plateforme === 'tiktok' && /^\d+$/.test(e.id)
        ? `https://www.tiktok.com/embed/v2/${e.id}`
        : /^(p|reel|tv)\/[\w-]+$/.test(e.id) ? `https://www.instagram.com/${e.id}/embed/` : 'about:blank';
      url = this.sanitizer.bypassSecurityTrustResourceUrl(src);
      this.lecteurs.set(e.url, url);
    }
    return url;
  }

  pas(d: number) {
    const n = this.illustrations().length;
    this.ouverte.update((i) => (i === null ? null : (i + d + n) % n));
  }

  @HostListener('document:keydown', ['$event'])
  clavier(e: KeyboardEvent) {
    if (this.ouverte() === null) return;
    if (e.key === 'Escape') this.ouverte.set(null);
    if (e.key === 'ArrowRight') this.pas(1);
    if (e.key === 'ArrowLeft') this.pas(-1);
  }

  copier() {
    navigator.clipboard?.writeText(this.url).then(() => {
      this.copie.set(true);
      setTimeout(() => this.copie.set(false), 2000);
    });
  }
}
