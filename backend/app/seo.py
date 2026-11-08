"""Aperçus des liens partagés (WhatsApp, Facebook, X…).

Ces sites ne lisent pas le JavaScript : le serveur écrit donc lui-même le titre, la description et
l'image de chaque page dans le HTML renvoyé (page d'accueil, événement partagé, article de blog).
"""

import html
import re
from datetime import datetime

from fastapi import Request
from sqlalchemy import select

from .config import settings
from .database import SessionLocal
from .models import Article, Evenement

DEFAULT_IMAGE = "/images/og-image.jpg"
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def site_url(request: Request) -> str:
    """Adresse publique du site (SITE_URL si définie, sinon déduite de la requête)."""
    return (settings.site_url or str(request.base_url)).rstrip("/")


def absolu(base: str, chemin: str | None) -> str:
    chemin = chemin or DEFAULT_IMAGE
    return chemin if chemin.startswith("http") else f"{base}{chemin}"


def date_fr(d: datetime) -> str:
    return f"{JOURS[d.weekday()]} {d.day} {MOIS[d.month - 1]}"


def prix(n: int | None) -> str:
    return f"{n:,}".replace(",", " ") + " FCFA" if n else ""


def meta_pour(request: Request, path: str) -> dict | None:
    """Renvoie les métadonnées propres à la page demandée, ou None pour les valeurs par défaut."""
    base = site_url(request)
    depart = request.query_params.get("depart")
    with SessionLocal() as db:
        if not path and depart and depart.isdigit():
            ev = db.get(Evenement, int(depart))
            if ev and ev.actif:
                details = [date_fr(ev.date_debut).capitalize() + f" à {ev.date_debut:%Hh%M}"]
                if ev.lieu:
                    details.append(ev.lieu)
                if ev.prix_adulte:
                    details.append(f"Adulte {prix(ev.prix_adulte)}")
                if ev.prix_enfant:
                    details.append(f"Enfant {prix(ev.prix_enfant)}")
                desc = " · ".join(details)
                if ev.description:
                    desc += f". {ev.description}"
                return {
                    "title": f"{ev.titre} – {date_fr(ev.date_debut)} | Aventurier Blvck",
                    "description": desc,
                    "image": absolu(base, ev.image),
                    "url": f"{base}/?depart={ev.id}",
                    "image_size": False,
                }
        m = re.fullmatch(r"blog/([\w-]+)", path)
        if m:
            a = db.scalar(select(Article).where(Article.slug == m.group(1), Article.publie))
            if a:
                return {
                    "title": f"{a.titre} | Aventurier Blvck",
                    "description": a.extrait,
                    "image": absolu(base, a.image),
                    "url": f"{base}/blog/{a.slug}",
                    "type": "article",
                    "image_size": False,
                }
    return {"url": f"{base}/{path}".rstrip("/") or base, "image": absolu(base, None)}


def _set(page: str, attr: str, name: str, value: str) -> str:
    pattern = re.compile(rf'(<meta {attr}="{re.escape(name)}" content=")[^"]*(")')
    return pattern.sub(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), page, count=1)


def rendre(page: str, meta: dict) -> str:
    if title := meta.get("title"):
        page = re.sub(r"<title>[^<]*</title>", lambda _: f"<title>{html.escape(title)}</title>", page, count=1)
        page = _set(page, "property", "og:title", title)
    if desc := meta.get("description"):
        desc = desc[:300]
        page = _set(page, "name", "description", desc)
        page = _set(page, "property", "og:description", desc)
    if image := meta.get("image"):
        page = _set(page, "property", "og:image", image)
    if meta.get("image_size") is False:  # image d'un événement / article : dimensions inconnues
        page = re.sub(r'\s*<meta property="og:image:(width|height)" content="[^"]*">', "", page)
    if url := meta.get("url"):
        page = _set(page, "property", "og:url", url)
    if t := meta.get("type"):
        page = _set(page, "property", "og:type", t)
    return page
