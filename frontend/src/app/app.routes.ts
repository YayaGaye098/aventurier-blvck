import { Routes } from '@angular/router';
import { authGuard } from './core/auth';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./public/home').then((m) => m.Home), title: 'Aventurier Blvck – Excursions et séjours au Sénégal' },
  { path: 'blog', loadComponent: () => import('./public/blog-list').then((m) => m.BlogList), title: 'Blog – Aventurier Blvck' },
  { path: 'blog/:slug', loadComponent: () => import('./public/blog-article').then((m) => m.BlogArticle) },
  { path: 'admin/login', loadComponent: () => import('./admin/login').then((m) => m.Login), title: 'Connexion – Aventurier Blvck' },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/layout').then((m) => m.AdminLayout),
    children: [
      { path: '', loadComponent: () => import('./admin/dashboard').then((m) => m.Dashboard), title: 'Tableau de bord' },
      { path: 'hotels', loadComponent: () => import('./admin/hotels').then((m) => m.AdminHotels), title: 'Hôtels' },
      { path: 'carrousel', loadComponent: () => import('./admin/carrousel').then((m) => m.AdminCarrousel), title: 'Carrousel de l’accueil' },
      { path: 'evenements', loadComponent: () => import('./admin/evenements').then((m) => m.AdminEvenements), title: 'Événements' },
      { path: 'avis', loadComponent: () => import('./admin/avis').then((m) => m.AdminAvis), title: 'Avis clients' },
      { path: 'aventures', loadComponent: () => import('./admin/services').then((m) => m.AdminServices), title: 'Aventures' },
      { path: 'galerie', loadComponent: () => import('./admin/galerie').then((m) => m.AdminGalerie), title: 'Galerie' },
      { path: 'blog', loadComponent: () => import('./admin/blog').then((m) => m.AdminBlog), title: 'Blog' },
      { path: 'blog/:id', loadComponent: () => import('./admin/blog-editor').then((m) => m.BlogEditor), title: 'Éditer un article' },
      { path: 'messages', loadComponent: () => import('./admin/messages').then((m) => m.AdminMessages), title: 'Messages' },
      { path: 'compte', loadComponent: () => import('./admin/compte').then((m) => m.Compte), title: 'Mon compte' },
    ],
  },
  { path: '**', redirectTo: '' },
];
