from datetime import datetime

from datetime import date

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Service(Base):
    """Une aventure / sortie / balade proposée."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    icone: Mapped[str] = mapped_column(String(80), default="fa-compass")
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prix: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duree: Mapped[str | None] = mapped_column(String(80), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Slide(Base):
    """Diapo du carrousel de la page d'accueil : une photo ou une vidéo + un message."""

    __tablename__ = "slides"

    id: Mapped[int] = mapped_column(primary_key=True)
    media: Mapped[str | None] = mapped_column(String(255), nullable=True)
    media_type: Mapped[str] = mapped_column(String(10), default="image")  # "image" ou "video"
    titre: Mapped[str] = mapped_column(String(120), default="")
    accent: Mapped[str | None] = mapped_column(String(120), nullable=True)  # 2e ligne du titre, en couleur
    texte: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ordre: Mapped[int] = mapped_column(Integer, default=0)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Evenement(Base):
    """Sortie datée (départ de groupe) mise en avant sur le site, avec photo et vidéo."""

    __tablename__ = "evenements"

    id: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str] = mapped_column(String(150))
    lieu: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    date_debut: Mapped[datetime] = mapped_column(DateTime, index=True)
    prix_adulte: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prix_enfant: Mapped[int | None] = mapped_column(Integer, nullable=True)
    telephone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Avis(Base):
    """Témoignage client. Ceux envoyés depuis le site attendent la validation de l'admin (actif=False)."""

    __tablename__ = "avis"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(100))
    origine: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sortie: Mapped[str | None] = mapped_column(String(150), nullable=True)
    texte: Mapped[str] = mapped_column(Text)
    note: Mapped[int] = mapped_column(Integer, default=5)
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Hotel(Base):
    __tablename__ = "hotels"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(150))
    ville: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    adresse: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telephone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    site_web: Mapped[str | None] = mapped_column(String(255), nullable=True)
    etoiles: Mapped[int] = mapped_column(Integer, default=3)
    prix_nuit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Photo(Base):
    __tablename__ = "galerie"

    id: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str | None] = mapped_column(String(150), nullable=True)
    image: Mapped[str] = mapped_column(String(255))  # fichier photo OU vidéo (voir media_type)
    media_type: Mapped[str] = mapped_column(String(10), default="image", server_default="image")
    categorie: Mapped[str | None] = mapped_column(String(80), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Article(Base):
    """Article de blog. Le contenu est écrit en Markdown."""

    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    titre: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    extrait: Mapped[str] = mapped_column(String(400), default="")
    contenu: Mapped[str] = mapped_column(Text, default="")
    image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    categorie: Mapped[str | None] = mapped_column(String(80), nullable=True)
    publie: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(150))
    telephone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    lu: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Statistique(Base):
    """Compteur anonyme par jour (visites, clics WhatsApp…). Aucune donnée personnelle n'est stockée."""

    __tablename__ = "statistiques"
    __table_args__ = (UniqueConstraint("jour", "type", "cible", name="uq_stat_jour_type_cible"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    jour: Mapped[date] = mapped_column(Date, index=True)
    type: Mapped[str] = mapped_column(String(30))
    cible: Mapped[str] = mapped_column(String(150), default="")
    total: Mapped[int] = mapped_column(Integer, default=0)


class Reglage(Base):
    """Réglage simple du site (clé → valeur), ex. la vidéo du bloc « Qui sommes-nous »."""

    __tablename__ = "reglages"

    cle: Mapped[str] = mapped_column(String(60), primary_key=True)
    valeur: Mapped[str | None] = mapped_column(String(255), nullable=True)
