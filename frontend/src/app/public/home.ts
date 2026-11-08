import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../core/api.service';
import { track, TrackType } from '../core/track';
import { AGENCE, ArticleCard, Avis, Evenement, Hotel, Photo, Reglages, Service, Slide } from '../core/models';
import { PostCard } from './post-card';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** Durée d'affichage d'une photo du carrousel (les vidéos, elles, vont jusqu'au bout). */
const DUREE_SLIDE_MS = 2000;
/** Une vidéo trop longue passe quand même à la suite au bout de ce délai. */
const DUREE_MAX_VIDEO_MS = 20000;

/** Diapo affichée si aucune n'est encore configurée dans l'admin. */
const SLIDE_PAR_DEFAUT: Slide = {
  id: 0, media: '/images/back1.webp', media_type: 'image', ordre: 0, actif: true,
  titre: 'Explorez le Sénégal', accent: 'autrement.',
  texte: 'Des sorties à vélo entre les baobabs, des balades au bord du fleuve, des week-ends dans les plus beaux coins du pays, avec un guide passionné.',
};

const FALLBACK_PHOTOS = ['1.jpeg', '2.jpeg', '3.jpeg', '4.jpeg', '6.jpeg', '7.jpeg', '8.jpeg'];

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink, DecimalPipe, DatePipe, SiteHeader, SiteFooter, PostCard],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  readonly agence = AGENCE;

  // ── Carrousel de l'accueil ──
  readonly dureeSlide = DUREE_SLIDE_MS;
  slides = signal<Slide[]>([SLIDE_PAR_DEFAUT]);
  slideIndex = signal(0);
  slideCourante = computed(() => [this.slides()[this.slideIndex()] ?? SLIDE_PAR_DEFAUT]);
  /** Diapos dont la photo est déjà chargée (on ne charge que l'actuelle et la suivante). */
  slidesChargees = signal(new Set<number>([0, 1]));
  enPause = signal(false);
  private slideTimer?: ReturnType<typeof setTimeout>;

  reglages = signal<Reglages>({ apropos_video: null });
  sonApropos = signal(false);
  /** Vidéo ouverte en plein écran (vidéo d'un hôtel). */
  videoPlein = signal<string | null>(null);
  readonly rien = () => {};

  services = signal<Service[]>([]);
  evenements = signal<Evenement[]>([]);
  avis = signal<Avis[]>([]);
  noteMoyenne = computed(() => {
    const a = this.avis();
    return a.length ? (a.reduce((s, x) => s + x.note, 0) / a.length).toFixed(1).replace('.', ',') : null;
  });
  avisOuvert = signal(false);
  avisEnvoi = signal(false);
  avisRetour = signal<{ ok: boolean; text: string } | null>(null);
  avisForm = { nom: '', origine: '', sortie: '', texte: '', note: 5, website: '' };
  prochain = computed(() => this.evenements()[0] ?? null);
  sonActif = signal<number | null>(null);
  partage = signal<number | null>(null);
  hotels = signal<Hotel[]>([]);
  photos = signal<Photo[]>([]);
  articles = signal<ArticleCard[]>([]);
  loading = signal(true);

  ville = signal<string>('all');
  villes = computed(() => [...new Set(this.hotels().map((h) => h.ville))].sort());
  hotelsFiltres = computed(() =>
    this.ville() === 'all' ? this.hotels() : this.hotels().filter((h) => h.ville === this.ville()),
  );

  lightbox = signal<number | null>(null);

  form = { nom: '', email: '', telephone: '', message: '', website: '' };
  sending = signal(false);
  feedback = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    this.api.reglages().subscribe({ next: (r) => this.reglages.set(r), error: () => {} });
    this.api.slides().subscribe({
      next: (s) => { if (s.length) { this.slides.set(s); this.allerA(0); } },
      error: () => {},
    });
    let pending = 3;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.api.avis().subscribe({ next: (a) => this.avis.set(a), error: () => {} });
    this.api.evenements().subscribe({
      next: (e) => {
        this.evenements.set(e);
        // Lien partagé « /?depart=12 » : on descend directement jusqu'à l'événement.
        const depart = this.route.snapshot.queryParamMap.get('depart');
        if (depart) setTimeout(() => document.getElementById(`depart-${depart}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      },
      error: () => {},
    });
    this.api.services().subscribe({ next: (s) => this.services.set(s), complete: done, error: done });
    this.api.hotels().subscribe({ next: (h) => this.hotels.set(h), complete: done, error: done });
    this.api.photos(12).subscribe({
      next: (p) => this.photos.set(p.length ? p : FALLBACK_PHOTOS.map((f, i) => fallback(f, i))),
      error: () => { this.photos.set(FALLBACK_PHOTOS.map((f, i) => fallback(f, i))); done(); },
      complete: done,
    });
    this.api.articles(1, 3).subscribe({ next: (p) => this.articles.set(p.items), error: () => {} });
  }

  ngOnDestroy() { clearTimeout(this.slideTimer); }

  allerA(i: number) {
    const n = this.slides().length;
    i = ((i % n) + n) % n;
    this.slideIndex.set(i);
    this.slidesChargees.update((s) => new Set(s).add(i).add((i + 1) % n));
    this.planifier();
  }

  suivant() { this.allerA(this.slideIndex() + 1); }

  basculerPause() {
    this.enPause.update((p) => !p);
    this.planifier();
  }

  private planifier() {
    clearTimeout(this.slideTimer);
    if (this.enPause() || this.slides().length < 2) return;
    const video = this.slides()[this.slideIndex()]?.media_type === 'video';
    // Photo : 2 s. Vidéo : jusqu'à sa fin (événement « ended »), avec un délai de secours.
    this.slideTimer = setTimeout(() => this.suivant(), video ? DUREE_MAX_VIDEO_MS : DUREE_SLIDE_MS);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.videoPlein()) { this.videoPlein.set(null); return; }
    const i = this.lightbox();
    if (i === null) return;
    if (e.key === 'Escape') this.lightbox.set(null);
    if (e.key === 'ArrowRight') this.step(1);
    if (e.key === 'ArrowLeft') this.step(-1);
  }

  step(d: number) {
    const n = this.photos().length;
    this.lightbox.update((i) => (i === null ? null : (i + d + n) % n));
  }

  etoiles(n: number) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  iconClass(icone: string) {
    if (!icone) return 'fas fa-compass';
    return icone.includes(' ') ? icone : `fas ${icone}`;
  }

  whatsappLink(texte: string) {
    return this.agence.whatsapp
      ? `https://wa.me/${this.agence.whatsapp}?text=${encodeURIComponent(texte)}`
      : null;
  }

  /** « Aujourd'hui », « Demain », « Dans 6 jours »… */
  compteARebours(e: Evenement) {
    const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const n = Math.round((jour(new Date(e.date_debut)) - jour(new Date())) / 86_400_000);
    if (n <= 0) return "C'est aujourd'hui !";
    if (n === 1) return 'Demain';
    return `Dans ${n} jours`;
  }

  /** Lien WhatsApp vers le numéro de l'événement (format sénégalais accepté : 77 103 41 49). */
  whatsappEvenement(e: Evenement) {
    let num = (e.telephone ?? '').replace(/\D/g, '');
    if (num.length === 9) num = '221' + num;
    if (!num) num = this.agence.whatsapp;
    if (!num) return null;
    const date = new Date(e.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const texte = `Bonjour, je souhaite réserver pour « ${e.titre} » du ${date}.
Nombre d'adultes : 
Nombre d'enfants : `;
    return `https://wa.me/${num}?text=${encodeURIComponent(texte)}`;
  }

  telHref(tel: string) { return 'tel:' + tel.replace(/[^\d+]/g, ''); }

  reserverEvenement(e: Evenement) {
    const date = new Date(e.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    this.reserver(`${e.titre} (${date})`);
  }

  basculerSonApropos(video: HTMLVideoElement) {
    const actif = !this.sonApropos();
    video.muted = !actif;
    if (actif) video.play().catch(() => {});
    this.sonApropos.set(actif);
  }

  basculerSon(id: number, video: HTMLVideoElement) {
    const actif = this.sonActif() === id;
    video.muted = actif;
    if (!actif) video.play().catch(() => {});
    this.sonActif.set(actif ? null : id);
  }

  suivre(type: TrackType, cible: string) { track(type, cible); }

  async partager(e: Evenement) {
    track('partage', e.titre);
    const url = `${location.origin}/?depart=${e.id}`;
    const date = new Date(e.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const texte = `${e.titre} – ${date}${e.lieu ? ' · ' + e.lieu : ''} avec Aventurier Blvck`;
    if (navigator.share) {
      try { await navigator.share({ title: e.titre, text: texte, url }); } catch { /* partage annulé */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${texte}
${url}`);
      this.partage.set(e.id);
      setTimeout(() => this.partage.set(null), 2500);
    } catch { /* presse-papiers indisponible */ }
  }

  reserver(sujet: string) {
    this.form.message = `Bonjour, je suis intéressé(e) par : ${sujet}.\nDates souhaitées : \nNombre de personnes : `;
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('nom')?.focus({ preventScroll: true }), 600);
  }

  envoyerAvis() {
    if (this.avisEnvoi()) return;
    this.avisEnvoi.set(true);
    this.avisRetour.set(null);
    this.api.envoyerAvis(this.avisForm).subscribe({
      next: (r) => {
        this.avisRetour.set({ ok: true, text: r.message });
        track('avis');
        this.avisForm = { nom: '', origine: '', sortie: '', texte: '', note: 5, website: '' };
        this.avisEnvoi.set(false);
      },
      error: (e) => { this.avisRetour.set({ ok: false, text: errorMessage(e) }); this.avisEnvoi.set(false); },
    });
  }

  envoyer() {
    if (this.sending()) return;
    this.sending.set(true);
    this.feedback.set(null);
    this.api.contact(this.form).subscribe({
      next: (r) => {
        this.feedback.set({ ok: true, text: r.message });
        track('reservation', this.form.message.match(/intéressé\(e\) par : (.+?)\./)?.[1] ?? 'Formulaire de contact');
        this.form = { nom: '', email: '', telephone: '', message: '', website: '' };
        this.sending.set(false);
      },
      error: (e) => {
        this.feedback.set({ ok: false, text: errorMessage(e) });
        this.sending.set(false);
      },
    });
  }
}

function fallback(file: string, i: number): Photo {
  return { id: -i - 1, titre: 'Aventure', image: `/uploads/${file}`, media_type: 'image', categorie: null, actif: true, created_at: null };
}
