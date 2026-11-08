import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Article, ArticleCard, ArticleInput, ArticlePage, Avis, AvisInput, ContactMessage, Evenement, Reglages, Slide, SlideInput, Statistiques, EvenementInput, Hotel, HotelInput, Photo, Service,
  ServiceInput, Stats,
} from './models';

const API = '/api';
const ADMIN = '/api/admin';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ── Public ─────────────────────────────────────────
  services() { return this.http.get<Service[]>(`${API}/services`); }
  reglages() { return this.http.get<Reglages>(`${API}/reglages`); }
  slides() { return this.http.get<Slide[]>(`${API}/slides`); }
  evenements() { return this.http.get<Evenement[]>(`${API}/evenements`); }
  avis() { return this.http.get<Avis[]>(`${API}/avis`); }
  envoyerAvis(data: { nom: string; origine: string; sortie: string; texte: string; note: number; website: string }) {
    return this.http.post<{ success: boolean; message: string }>(`${API}/avis`, data);
  }
  hotels() { return this.http.get<Hotel[]>(`${API}/hotels`); }
  photos(limit = 12) { return this.http.get<Photo[]>(`${API}/galerie`, { params: { limit } }); }
  contact(data: { nom: string; email: string; telephone: string; message: string; website: string }) {
    return this.http.post<{ success: boolean; message: string }>(`${API}/contact`, data);
  }

  articles(page = 1, parPage = 9, categorie = '') {
    const params: Record<string, string | number> = { page, par_page: parPage };
    if (categorie) params['categorie'] = categorie;
    return this.http.get<ArticlePage>(`${API}/blog`, { params });
  }
  article(slug: string) { return this.http.get<Article>(`${API}/blog/${encodeURIComponent(slug)}`); }
  categoriesBlog() { return this.http.get<string[]>(`${API}/blog/categories`); }

  // ── Admin ──────────────────────────────────────────
  login(username: string, password: string) {
    return this.http.post<{ access_token: string }>(`${ADMIN}/login`, { username, password });
  }
  me() { return this.http.get<{ id: number; username: string }>(`${ADMIN}/me`); }
  changePassword(ancien: string, nouveau: string) {
    return this.http.post(`${ADMIN}/password`, { ancien, nouveau });
  }
  statistiques(jours = 30) { return this.http.get<Statistiques>(`${ADMIN}/statistiques`, { params: { jours } }); }
  sauvegarde() { return this.http.get(`${ADMIN}/sauvegarde`, { responseType: 'blob', observe: 'response' }); }
  stats() { return this.http.get<Stats>(`${ADMIN}/stats`); }

  adminHotels() { return this.http.get<Hotel[]>(`${ADMIN}/hotels`); }
  saveHotel(data: HotelInput, id?: number) {
    return id
      ? this.http.put<Hotel>(`${ADMIN}/hotels/${id}`, data)
      : this.http.post<Hotel>(`${ADMIN}/hotels`, data);
  }
  hotelImage(id: number, file: File) { return this.http.post<Hotel>(`${ADMIN}/hotels/${id}/image`, form(file)); }
  hotelVideo(id: number, file: File) {
    return this.http.post<Hotel>(`${ADMIN}/hotels/${id}/video`, champ('video', file), { reportProgress: true, observe: 'events' });
  }
  deleteHotelVideo(id: number) { return this.http.delete<Hotel>(`${ADMIN}/hotels/${id}/video`); }
  aproposVideo(file: File) {
    return this.http.post<Reglages>(`${ADMIN}/apropos/video`, champ('video', file), { reportProgress: true, observe: 'events' });
  }
  deleteAproposVideo() { return this.http.delete<Reglages>(`${ADMIN}/apropos/video`); }
  deleteHotel(id: number) { return this.http.delete(`${ADMIN}/hotels/${id}`); }

  adminServices() { return this.http.get<Service[]>(`${ADMIN}/services`); }
  saveService(data: ServiceInput, id?: number) {
    return id
      ? this.http.put<Service>(`${ADMIN}/services/${id}`, data)
      : this.http.post<Service>(`${ADMIN}/services`, data);
  }
  serviceImage(id: number, file: File) { return this.http.post<Service>(`${ADMIN}/services/${id}/image`, form(file)); }
  deleteService(id: number) { return this.http.delete(`${ADMIN}/services/${id}`); }

  adminAvis() { return this.http.get<Avis[]>(`${ADMIN}/avis`); }
  saveAvis(data: AvisInput, id?: number) {
    return id ? this.http.put<Avis>(`${ADMIN}/avis/${id}`, data) : this.http.post<Avis>(`${ADMIN}/avis`, data);
  }
  avisImage(id: number, file: File) { return this.http.post<Avis>(`${ADMIN}/avis/${id}/image`, form(file)); }
  deleteAvis(id: number) { return this.http.delete(`${ADMIN}/avis/${id}`); }

  adminSlides() { return this.http.get<Slide[]>(`${ADMIN}/slides`); }
  saveSlide(data: SlideInput, id?: number) {
    return id ? this.http.put<Slide>(`${ADMIN}/slides/${id}`, data) : this.http.post<Slide>(`${ADMIN}/slides`, data);
  }
  slideMedia(id: number, file: File) {
    const f = new FormData();
    f.append('media', file);
    return this.http.post<Slide>(`${ADMIN}/slides/${id}/media`, f, { reportProgress: true, observe: 'events' });
  }
  deleteSlide(id: number) { return this.http.delete(`${ADMIN}/slides/${id}`); }

  adminEvenements() { return this.http.get<Evenement[]>(`${ADMIN}/evenements`); }
  saveEvenement(data: EvenementInput, id?: number) {
    return id
      ? this.http.put<Evenement>(`${ADMIN}/evenements/${id}`, data)
      : this.http.post<Evenement>(`${ADMIN}/evenements`, data);
  }
  evenementImage(id: number, file: File) { return this.http.post<Evenement>(`${ADMIN}/evenements/${id}/image`, form(file)); }
  evenementVideo(id: number, file: File) {
    const f = new FormData();
    f.append('video', file);
    return this.http.post<Evenement>(`${ADMIN}/evenements/${id}/video`, f, { reportProgress: true, observe: 'events' });
  }
  deleteEvenementVideo(id: number) { return this.http.delete<Evenement>(`${ADMIN}/evenements/${id}/video`); }
  deleteEvenement(id: number) { return this.http.delete(`${ADMIN}/evenements/${id}`); }

  adminPhotos() { return this.http.get<Photo[]>(`${ADMIN}/galerie`); }
  addPhoto(file: File, titre: string, categorie: string) {
    const f = form(file);
    f.append('titre', titre);
    f.append('categorie', categorie);
    return this.http.post<Photo>(`${ADMIN}/galerie`, f);
  }
  updatePhoto(p: Photo) {
    return this.http.put<Photo>(`${ADMIN}/galerie/${p.id}`, { titre: p.titre, categorie: p.categorie, actif: p.actif });
  }
  deletePhoto(id: number) { return this.http.delete(`${ADMIN}/galerie/${id}`); }

  adminArticles() { return this.http.get<ArticleCard[]>(`${ADMIN}/blog`); }
  adminArticle(id: number) { return this.http.get<Article>(`${ADMIN}/blog/${id}`); }
  saveArticle(data: ArticleInput, id?: number) {
    return id
      ? this.http.put<Article>(`${ADMIN}/blog/${id}`, data)
      : this.http.post<Article>(`${ADMIN}/blog`, data);
  }
  articleImage(id: number, file: File) { return this.http.post<Article>(`${ADMIN}/blog/${id}/image`, form(file)); }
  uploadInline(file: File) { return this.http.post<{ url: string }>(`${ADMIN}/blog/upload`, form(file)); }
  deleteArticle(id: number) { return this.http.delete(`${ADMIN}/blog/${id}`); }

  contacts() { return this.http.get<ContactMessage[]>(`${ADMIN}/contacts`); }
  markContact(id: number, lu: boolean) {
    return this.http.patch<ContactMessage>(`${ADMIN}/contacts/${id}`, null, { params: { lu } });
  }
  markAllRead() { return this.http.post(`${ADMIN}/contacts/tout-lu`, null); }
  deleteContact(id: number) { return this.http.delete(`${ADMIN}/contacts/${id}`); }
}

function champ(nom: string, file: File) {
  const f = new FormData();
  f.append(nom, file);
  return f;
}

function form(file: File) {
  const f = new FormData();
  f.append('image', file);
  return f;
}

/** Extrait un message d'erreur lisible d'une réponse FastAPI. */
export function errorMessage(err: any): string {
  const d = err?.error?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return 'Vérifiez les champs du formulaire.';
  if (err?.status === 0) return 'Serveur injoignable. Vérifiez votre connexion.';
  return 'Une erreur est survenue. Réessayez.';
}
