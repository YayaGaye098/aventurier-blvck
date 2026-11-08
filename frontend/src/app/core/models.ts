export interface Service {
  id: number;
  titre: string;
  description: string;
  icone: string;
  image: string | null;
  prix: number | null;
  duree: string | null;
  actif: boolean;
}

export interface Slide {
  id: number;
  media: string | null;
  media_type: 'image' | 'video';
  titre: string;
  accent: string | null;
  texte: string | null;
  ordre: number;
  actif: boolean;
}

export interface Evenement {
  id: number;
  titre: string;
  lieu: string | null;
  description: string;
  /** Date et heure de départ, format ISO local (ex. 2026-11-14T08:00:00). */
  date_debut: string;
  prix_adulte: number | null;
  prix_enfant: number | null;
  telephone: string | null;
  image: string | null;
  video: string | null;
  actif: boolean;
}

export interface Avis {
  id: number;
  nom: string;
  origine: string | null;
  sortie: string | null;
  texte: string;
  note: number;
  image: string | null;
  actif: boolean;
  created_at: string | null;
}

export interface Statistiques {
  jours: number;
  totaux: Record<string, number>;
  visites_par_jour: { jour: string; visites: number }[];
  whatsapp_par_cible: { cible: string; total: number }[];
  aujourdhui: number;
}

export interface Hotel {
  id: number;
  nom: string;
  ville: string;
  description: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  etoiles: number;
  prix_nuit: number | null;
  image: string | null;
  video: string | null;
  actif: boolean;
  featured: boolean;
}

export interface Reglages {
  apropos_video: string | null;
}

export interface Photo {
  id: number;
  titre: string | null;
  /** Fichier photo ou vidéo, selon media_type. */
  image: string;
  media_type: 'image' | 'video';
  categorie: string | null;
  actif: boolean;
  created_at: string | null;
}

export interface ContactMessage {
  id: number;
  nom: string;
  email: string;
  telephone: string | null;
  message: string;
  lu: boolean;
  created_at: string | null;
}

export interface ArticleCard {
  id: number;
  titre: string;
  slug: string;
  extrait: string;
  image: string | null;
  categorie: string | null;
  publie: boolean;
  published_at: string | null;
  temps_lecture: number;
}

export interface ArticleMedia {
  id: number;
  fichier: string;
  media_type: 'image' | 'video';
}

/** Vidéo TikTok ou publication Instagram intégrée dans un article. */
export interface Embed {
  plateforme: 'tiktok' | 'instagram';
  /** TikTok : numéro de la vidéo. Instagram : « p/CODE » ou « reel/CODE ». */
  id: string;
  url: string;
}

export interface Article extends ArticleCard {
  contenu: string;
  created_at: string | null;
  updated_at: string | null;
  medias: ArticleMedia[];
  embeds: Embed[];
}

export interface ArticlePage {
  items: ArticleCard[];
  total: number;
  page: number;
  pages: number;
}

export interface ArticleInput {
  titre: string;
  slug: string | null;
  extrait: string;
  contenu: string;
  categorie: string | null;
  publie: boolean;
  embeds: string[];
}

export interface Stats {
  hotels: number;
  services: number;
  photos: number;
  articles: number;
  messages: number;
  non_lus: number;
  evenements: number;
  avis_attente: number;
}

export type ServiceInput = Omit<Service, 'id' | 'image'>;
export type HotelInput = Omit<Hotel, 'id' | 'image' | 'video'>;
export type AvisInput = Omit<Avis, 'id' | 'image' | 'created_at'>;
export type SlideInput = Omit<Slide, 'id' | 'media' | 'media_type'>;
export type EvenementInput = Omit<Evenement, 'id' | 'image' | 'video'>;

export const VILLES = [
  'Dakar', 'Lac Rose', 'Saly', 'Mbour', 'Saint-Louis', 'Thiès', 'Touba', 'Kaolack',
  'Sine-Saloum', 'Ziguinchor', 'Cap Skirring', 'Kolda', 'Tambacounda', 'Kédougou',
];

/** Coordonnées publiques de l'agence (à compléter). */
export const AGENCE = {
  whatsapp: '221771034149', // +221 77 103 41 49 (sans + ni espaces)
  email: 'laventurierblvck@gmail.com',
  instagram: 'https://www.instagram.com/aventurier_blvck',
  tiktok: 'https://www.tiktok.com/@aventurierblvck',
  facebook: '',
  youtube: '',
};
