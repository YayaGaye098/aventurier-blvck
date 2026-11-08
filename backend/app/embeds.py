"""Vidéos TikTok et publications Instagram intégrées dans les articles (lecteurs officiels).

On ne télécharge rien : on reconnaît le lien collé par l'admin, on le met au propre, et la page
affiche le lecteur officiel de la plateforme (iframe).
"""

import re
import urllib.request

TIKTOK = re.compile(r"^https?://(?:www\.|m\.)?tiktok\.com/@[\w.\-]+/(?:video|photo)/(\d+)", re.I)
TIKTOK_COURT = re.compile(r"^https?://(?:(?:vm|vt)\.tiktok\.com/[\w-]+|(?:www\.)?tiktok\.com/t/[\w-]+)/?", re.I)
INSTAGRAM = re.compile(r"^https?://(?:www\.)?instagram\.com/(?:[\w.]+/)?(p|reels?|tv)/([\w-]+)", re.I)

MAX_LIENS = 12


class LienInvalide(ValueError):
    pass


def _suivre_redirection(url: str) -> str:
    """Les liens courts de l'appli TikTok (vm.tiktok.com/…) redirigent vers le lien complet."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; AventurierBlvck/1.0)"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.geturl()
    except Exception as exc:
        raise LienInvalide(f"Impossible d'ouvrir le lien court « {url} ». Collez le lien complet de la vidéo.") from exc


def normaliser(url: str) -> str:
    """Renvoie le lien propre (sans paramètres de suivi) ou lève LienInvalide."""
    url = url.strip()
    if TIKTOK_COURT.match(url):
        url = _suivre_redirection(url)
    if m := TIKTOK.match(url):
        return f"https://www.tiktok.com/@{url.split('@', 1)[1].split('/', 1)[0]}/video/{m.group(1)}"
    if m := INSTAGRAM.match(url):
        genre = "reel" if m.group(1).lower().startswith("reel") else m.group(1).lower()
        return f"https://www.instagram.com/{genre}/{m.group(2)}/"
    raise LienInvalide(
        f"Lien non reconnu : « {url[:80]} ». Collez le lien d'une vidéo TikTok "
        "(…tiktok.com/@compte/video/…) ou d'une publication Instagram (…instagram.com/p/… ou /reel/…)."
    )


def normaliser_liste(urls: list[str]) -> list[str]:
    propres: list[str] = []
    for u in urls:
        if u.strip():
            n = normaliser(u)
            if n not in propres:
                propres.append(n)
    if len(propres) > MAX_LIENS:
        raise LienInvalide(f"{MAX_LIENS} vidéos TikTok/Instagram maximum par article.")
    return propres


def decrire(url: str) -> dict | None:
    """{plateforme, id, url} pour l'affichage, ou None si le lien stocké n'est plus reconnu."""
    if m := TIKTOK.match(url):
        return {"plateforme": "tiktok", "id": m.group(1), "url": url}
    if m := INSTAGRAM.match(url):
        return {"plateforme": "instagram", "id": f"{m.group(1).lower()}/{m.group(2)}", "url": url}
    return None
