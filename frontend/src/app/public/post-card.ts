import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleCard } from '../core/models';

@Component({
  selector: 'app-post-card',
  imports: [RouterLink, DatePipe],
  template: `
    <a class="post" [routerLink]="['/blog', article().slug]">
      <div class="media">
        @if (article().image) {
          <img [src]="article().image" [alt]="article().titre" loading="lazy">
        } @else {
          <div class="ph"><i class="fas fa-feather-pointed"></i></div>
        }
        @if (article().categorie) { <span class="cat">{{ article().categorie }}</span> }
      </div>
      <div class="body">
        <p class="meta">{{ article().published_at | date:'d MMMM y' }} · {{ article().temps_lecture }} min de lecture</p>
        <h3>{{ article().titre }}</h3>
        <p class="ex">{{ article().extrait }}</p>
        <span class="more">Lire l'article <i class="fas fa-arrow-right"></i></span>
      </div>
    </a>
  `,
  styles: `
    :host { display: block; }
    .post { display: flex; flex-direction: column; height: 100%; background: #fff; border-radius: var(--radius); overflow: hidden;
      box-shadow: var(--shadow); text-decoration: none; color: inherit; transition: box-shadow .25s, transform .25s; }
    .post:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
    .media { position: relative; aspect-ratio: 16 / 10; background: var(--teal-soft); overflow: hidden; }
    .media img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s; }
    .post:hover .media img { transform: scale(1.05); }
    .ph { height: 100%; display: grid; place-items: center; color: var(--teal-bright); font-size: 2.4rem; }
    .cat { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,.95); color: var(--teal-dark);
      font-size: .75rem; font-weight: 700; padding: .3rem .7rem; border-radius: 999px; }
    .body { padding: 1.2rem 1.3rem 1.4rem; display: flex; flex-direction: column; gap: .5rem; flex: 1; }
    .meta { color: var(--muted); font-size: .8rem; }
    h3 { font-size: 1.2rem; }
    .ex { color: var(--muted); font-size: .92rem; flex: 1; }
    .more { color: var(--teal); font-weight: 700; font-size: .9rem; margin-top: .3rem; }
    .post:hover .more i { transform: translateX(3px); }
    .more i { transition: transform .2s; }
  `,
})
export class PostCard {
  article = input.required<ArticleCard>();
}
