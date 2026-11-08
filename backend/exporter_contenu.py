"""Copie le contenu du site LOCAL (ce que vous avez saisi dans l'admin) vers le dossier « contenu/ ».

    python exporter_contenu.py

Ce dossier est envoyé sur GitHub : au démarrage, le site en ligne recharge exactement ce contenu
(sorties, hôtels, galerie, articles et leurs photos/vidéos, carrousel, avis publiés…).
Ne sont PAS copiés : le compte admin, les messages de contact et les statistiques.
"""
import json
import re
import shutil
import sqlite3
from pathlib import Path

ICI = Path(__file__).resolve().parent
BASE = ICI / "aventurier.db"
UPLOADS = ICI / "uploads"
DOSSIER = ICI / "contenu"
FICHIERS = DOSSIER / "fichiers"

# Ordre important : un média d'article a besoin de son article.
TABLES = ["services", "slides", "evenements", "hotels", "galerie", "articles", "article_medias", "avis", "reglages"]
FILTRES = {"avis": "WHERE actif = 1"}  # avis en attente de validation : non copiés


def exporter() -> None:
    con = sqlite3.connect(BASE)
    con.row_factory = sqlite3.Row
    donnees: dict[str, list[dict]] = {}
    fichiers: set[str] = set()
    for t in TABLES:
        lignes = [dict(r) for r in con.execute(f"SELECT * FROM {t} {FILTRES.get(t, '')}")]
        donnees[t] = lignes
        for ligne in lignes:
            for v in ligne.values():
                if isinstance(v, str):
                    fichiers.update(re.findall(r"/uploads/([\w.\-]+)", v))
    con.close()

    if FICHIERS.exists():
        shutil.rmtree(FICHIERS)
    FICHIERS.mkdir(parents=True)
    manquants = []
    for nom in sorted(fichiers):
        src = UPLOADS / nom
        if src.exists():
            shutil.copy2(src, FICHIERS / nom)
        else:
            manquants.append(nom)

    (DOSSIER / "contenu.json").write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    poids = sum(f.stat().st_size for f in FICHIERS.iterdir()) / 1e6
    print("Contenu exporté :", ", ".join(f"{t} {len(v)}" for t, v in donnees.items()))
    print(f"{len(fichiers) - len(manquants)} fichiers ({poids:.0f} Mo)")
    if manquants:
        print("Fichiers introuvables (ignorés) :", ", ".join(manquants))


if __name__ == "__main__":
    exporter()
