/** Mesure d'audience anonyme : envoie un compteur au serveur (aucun cookie, aucune donnée personnelle). */
export type TrackType = 'visite' | 'whatsapp' | 'appel' | 'partage' | 'reservation' | 'avis';

export function track(type: TrackType, cible = '') {
  try {
    const body = JSON.stringify({ type, cible: cible.slice(0, 150) });
    const blob = new Blob([body], { type: 'application/json' });
    // sendBeacon part même si le visiteur quitte la page (ex. clic vers WhatsApp).
    if (!navigator.sendBeacon?.('/api/track', blob)) {
      fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch { /* la mesure d'audience ne doit jamais gêner le visiteur */ }
}

/** Une seule visite comptée par session de navigation. */
export function trackVisite() {
  try {
    if (sessionStorage.getItem('ab-visite')) return;
    sessionStorage.setItem('ab-visite', '1');
  } catch { /* stockage indisponible : on compte quand même */ }
  track('visite');
}
