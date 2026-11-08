from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Aventures ──────────────────────────────────────────
class ServiceIn(BaseModel):
    titre: str = Field(min_length=1, max_length=150)
    description: str = ""
    icone: str = "fa-compass"
    prix: int | None = Field(default=None, ge=0)
    duree: str | None = None
    actif: bool = True


class ServiceOut(ORM, ServiceIn):
    id: int
    image: str | None = None


# ── Carrousel de l'accueil ─────────────────────────────
class SlideIn(BaseModel):
    titre: str = Field(default="", max_length=120)
    accent: str | None = Field(default=None, max_length=120)
    texte: str | None = Field(default=None, max_length=300)
    ordre: int = 0
    actif: bool = True


class SlideOut(ORM, SlideIn):
    id: int
    media: str | None = None
    media_type: str = "image"


# ── Événements (sorties datées) ───────────────────────
class EvenementIn(BaseModel):
    titre: str = Field(min_length=1, max_length=150)
    lieu: str | None = Field(default=None, max_length=120)
    description: str = ""
    date_debut: datetime
    prix_adulte: int | None = Field(default=None, ge=0)
    prix_enfant: int | None = Field(default=None, ge=0)
    telephone: str | None = Field(default=None, max_length=40)
    actif: bool = True


class EvenementOut(ORM, EvenementIn):
    id: int
    image: str | None = None
    video: str | None = None


# ── Avis clients ───────────────────────────────────────
class AvisIn(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    origine: str | None = Field(default=None, max_length=100)
    sortie: str | None = Field(default=None, max_length=150)
    texte: str = Field(min_length=1, max_length=1500)
    note: int = Field(default=5, ge=1, le=5)
    actif: bool = True


class AvisPublicIn(BaseModel):
    """Avis envoyé par un visiteur : publié seulement après validation."""

    nom: str = Field(min_length=1, max_length=100)
    origine: str | None = Field(default=None, max_length=100)
    sortie: str | None = Field(default=None, max_length=150)
    texte: str = Field(min_length=10, max_length=1500)
    note: int = Field(default=5, ge=1, le=5)
    website: str = ""  # champ piège anti-spam


class AvisOut(ORM):
    id: int
    nom: str
    origine: str | None
    sortie: str | None
    texte: str
    note: int
    image: str | None
    actif: bool
    created_at: datetime | None = None


# ── Statistiques ───────────────────────────────────────
TYPES_STAT = ("visite", "whatsapp", "appel", "partage", "reservation", "avis")


class TrackIn(BaseModel):
    type: str = Field(pattern="^(" + "|".join(TYPES_STAT) + ")$")
    cible: str = Field(default="", max_length=150)


class StatJour(BaseModel):
    jour: str
    visites: int


class StatCible(BaseModel):
    cible: str
    total: int


class Statistiques(BaseModel):
    jours: int
    totaux: dict[str, int]
    visites_par_jour: list[StatJour]
    whatsapp_par_cible: list[StatCible]
    aujourdhui: int


# ── Hôtels ─────────────────────────────────────────────
class HotelIn(BaseModel):
    nom: str = Field(min_length=1, max_length=150)
    ville: str = Field(min_length=1, max_length=80)
    description: str = ""
    adresse: str | None = None
    telephone: str | None = None
    email: str | None = None
    site_web: str | None = None
    etoiles: int = Field(default=3, ge=1, le=5)
    prix_nuit: int | None = Field(default=None, ge=0)
    actif: bool = True
    featured: bool = False


class HotelOut(ORM, HotelIn):
    id: int
    image: str | None = None
    video: str | None = None


class ReglagesOut(BaseModel):
    apropos_video: str | None = None


# ── Galerie ────────────────────────────────────────────
class PhotoOut(ORM):
    id: int
    titre: str | None
    image: str
    media_type: str = "image"
    categorie: str | None
    actif: bool
    created_at: datetime | None = None


class PhotoUpdate(BaseModel):
    titre: str | None = None
    categorie: str | None = None
    actif: bool = True


# ── Blog ───────────────────────────────────────────────
class ArticleIn(BaseModel):
    titre: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=220)  # généré à partir du titre si vide
    extrait: str = Field(default="", max_length=400)
    contenu: str = ""
    categorie: str | None = Field(default=None, max_length=80)
    publie: bool = False
    # Liens de vidéos TikTok / publications Instagram à intégrer dans l'article
    embeds: list[str] = Field(default_factory=list, max_length=30)


class ArticleCard(ORM):
    id: int
    titre: str
    slug: str
    extrait: str
    image: str | None
    categorie: str | None
    publie: bool
    published_at: datetime | None
    temps_lecture: int = 1


class ArticleMediaOut(ORM):
    id: int
    fichier: str
    media_type: str


class EmbedOut(BaseModel):
    plateforme: str  # "tiktok" ou "instagram"
    id: str
    url: str


class ArticleOut(ArticleCard):
    contenu: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    medias: list[ArticleMediaOut] = []
    embeds: list[EmbedOut] = []


class ArticlePage(BaseModel):
    items: list[ArticleCard]
    total: int
    page: int
    pages: int


# ── Contacts ───────────────────────────────────────────
class ContactIn(BaseModel):
    nom: str = Field(min_length=1, max_length=150)
    email: EmailStr
    telephone: str | None = Field(default=None, max_length=40)
    message: str = Field(min_length=1, max_length=5000)
    # Champ piège anti-spam : invisible pour les humains, rempli par les robots.
    website: str | None = None


class ContactOut(ORM):
    id: int
    nom: str
    email: str
    telephone: str | None
    message: str
    lu: bool
    created_at: datetime | None = None


# ── Auth / stats ───────────────────────────────────────
class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    ancien: str
    nouveau: str = Field(min_length=8)


class Stats(BaseModel):
    hotels: int
    services: int
    photos: int
    articles: int
    messages: int
    non_lus: int
    evenements: int = 0
    avis_attente: int = 0
