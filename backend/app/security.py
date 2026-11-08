"""Protections simples : limitation des tentatives (anti force brute / anti-spam) et en-têtes HTTP."""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """Compte les événements par clé (ex. adresse IP) sur une fenêtre glissante, en mémoire.

    Suffisant pour un seul serveur. Les compteurs sont remis à zéro au redémarrage.
    """

    def __init__(self, max_events: int, window_s: int, message: str):
        self.max_events = max_events
        self.window_s = window_s
        self.message = message
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _purge(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window_s:
            hits.popleft()
        if not hits:
            self._hits.pop(key, None)
            hits = self._hits[key]
        return hits

    def check(self, key: str) -> None:
        """Lève une erreur 429 si la limite est déjà atteinte (sans compter cet appel)."""
        now = time.monotonic()
        with self._lock:
            hits = self._purge(key, now)
            if len(hits) >= self.max_events:
                wait = max(1, int(hits[0] + self.window_s - now))
                minutes = (wait + 59) // 60
                raise HTTPException(
                    429, f"{self.message} Réessayez dans {minutes} minute{'s' if minutes > 1 else ''}.",
                    headers={"Retry-After": str(wait)},
                )

    def hit(self, key: str) -> None:
        with self._lock:
            self._purge(key, time.monotonic()).append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


# 5 mots de passe faux en 15 minutes → blocage temporaire de cette adresse IP.
login_limiter = RateLimiter(5, 15 * 60, "Trop de tentatives de connexion.")
# 5 messages en 10 minutes par adresse IP sur le formulaire de contact.
contact_limiter = RateLimiter(5, 10 * 60, "Vous avez envoyé beaucoup de messages.")


# 3 avis en une heure par adresse IP.
avis_limiter = RateLimiter(3, 60 * 60, "Merci, vous avez déjà envoyé plusieurs avis.")


# Mesure d'audience : 120 événements / 10 min par IP au-delà, on ignore sans erreur.
track_limiter = RateLimiter(120, 10 * 60, "")


def client_ip(request: Request) -> str:
    # Derrière Nginx/Caddy, lancer uvicorn avec --proxy-headers pour obtenir la vraie IP du visiteur.
    return request.client.host if request.client else "inconnu"


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        path = request.url.path
        if path.startswith("/admin") or path.startswith("/api/admin"):
            h["X-Robots-Tag"] = "noindex, nofollow"
            h["Cache-Control"] = "no-store"
        return response
