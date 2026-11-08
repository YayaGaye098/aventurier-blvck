import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ArticleCard } from '../core/models';
import { AdminUi } from './ui';

@Component({
  selector: 'app-admin-blog',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="adm-head">
      <div><h1>Blog</h1><p>{{ publies() }} publié(s) · {{ articles().length - publies() }} brouillon(s)</p></div>
      <a class="btn btn-primary" routerLink="/admin/blog/nouveau"><i class="fas fa-pen-nib"></i> Écrire un article</a>
    </div>

    <div class="adm-list">
      @for (a of articles(); track a.id) {
        <div class="adm-row" [class.off]="!a.publie">
          @if (a.image) { <img class="adm-thumb" [src]="a.image" alt=""> }
          @else { <div class="adm-thumb"><i class="fas fa-feather-pointed"></i></div> }
          <div class="adm-row-main">
            <h3>{{ a.titre }}
              @if (a.publie) { <span class="adm-pill">Publié</span> } @else { <span class="adm-pill off">Brouillon</span> }
              @if (a.categorie) { <span class="adm-pill sun">{{ a.categorie }}</span> }
            </h3>
            <p>@if (a.published_at) { {{ a.published_at | date:'d MMM y' }} · } {{ a.temps_lecture }} min · {{ a.extrait || 'Pas de résumé' }}</p>
          </div>
          <div class="adm-row-actions">
            @if (a.publie) {
              <a class="btn btn-ghost btn-icon" [routerLink]="['/blog', a.slug]" target="_blank" title="Voir sur le site"><i class="fas fa-arrow-up-right-from-square"></i></a>
            }
            <a class="btn btn-ghost btn-icon" [routerLink]="['/admin/blog', a.id]" title="Modifier"><i class="fas fa-pen"></i></a>
            <button class="btn btn-danger btn-icon" type="button" (click)="supprimer(a)" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      } @empty {
        <div class="adm-card adm-empty"><i class="fas fa-feather-pointed"></i>Aucun article. Racontez votre dernière sortie !</div>
      }
    </div>
  `,
})
export class AdminBlog {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  articles = signal<ArticleCard[]>([]);
  publies = computed(() => this.articles().filter((a) => a.publie).length);

  constructor() { this.charger(); }

  charger() { this.api.adminArticles().subscribe((a) => this.articles.set(a)); }

  supprimer(a: ArticleCard) {
    if (!confirm(`Supprimer définitivement l'article « ${a.titre} » ?`)) return;
    this.api.deleteArticle(a.id).subscribe(() => { this.ui.notify('Article supprimé.'); this.charger(); });
  }
}
