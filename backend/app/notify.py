"""Notification WhatsApp de l'admin (nouveau message, nouvel avis) via le service gratuit CallMeBot.

Activation (une seule fois) : suivre https://www.callmebot.com/blog/free-api-whatsapp-messages/
(depuis le WhatsApp qui doit recevoir les alertes, envoyer « I allow callmebot to send me messages »
au numéro indiqué sur cette page). CallMeBot répond avec une clé (apikey).
Mettre ensuite dans backend/.env :
    WHATSAPP_NOTIFY_PHONE=221771034149
    CALLMEBOT_APIKEY=123456
Sans ces deux valeurs, aucune notification n'est envoyée (le site fonctionne normalement).
"""

import logging
import urllib.parse
import urllib.request

from .config import settings

log = logging.getLogger("aventurier.notify")


def actif() -> bool:
    return bool(settings.whatsapp_notify_phone and settings.callmebot_apikey)


def envoyer_whatsapp(texte: str) -> None:
    """Envoie le texte sur le WhatsApp de l'admin. Ne lève jamais d'erreur (appelée en tâche de fond)."""
    if not actif():
        return
    params = urllib.parse.urlencode({
        "phone": settings.whatsapp_notify_phone.lstrip("+").replace(" ", ""),
        "text": texte[:1500],
        "apikey": settings.callmebot_apikey,
    })
    try:
        with urllib.request.urlopen(f"https://api.callmebot.com/whatsapp.php?{params}", timeout=15) as r:
            if r.status != 200:
                log.warning("CallMeBot a répondu %s", r.status)
    except Exception as exc:  # réseau, service indisponible…
        log.warning("Notification WhatsApp non envoyée : %s", exc)
