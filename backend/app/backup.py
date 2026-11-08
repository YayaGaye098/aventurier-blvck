"""Sauvegarde complète du site : base de données + photos/vidéos, dans un seul fichier .zip."""

import sqlite3
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from .config import settings


def creer_sauvegarde() -> Path:
    """Crée le .zip dans un dossier temporaire et renvoie son chemin (à supprimer après envoi)."""
    tmp = Path(tempfile.mkdtemp(prefix="sauvegarde_"))
    archive = tmp / f"aventurier-blvck-sauvegarde-{datetime.now():%Y-%m-%d_%Hh%M}.zip"
    url = make_url(settings.database_url)

    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as z:
        if url.get_backend_name() == "sqlite" and url.database:
            # Copie cohérente même si le site est en train d'écrire dans la base.
            copie = tmp / "aventurier.db"
            src, dst = sqlite3.connect(url.database), sqlite3.connect(copie)
            try:
                src.backup(dst)
            finally:  # « with sqlite3.connect » ne ferme pas la connexion : on le fait nous-mêmes
                dst.close()
                src.close()
            z.write(copie, "aventurier.db")
            copie.unlink()
        else:
            z.writestr("LISEZMOI.txt", "La base n'est pas SQLite : sauvegardez-la avec l'outil de votre hébergeur.\n")

        for f in sorted(settings.upload_dir.rglob("*")):
            if f.is_file():
                # Photos et vidéos sont déjà compressées : on les range sans les recompresser.
                z.write(f, f"uploads/{f.relative_to(settings.upload_dir).as_posix()}", compress_type=zipfile.ZIP_STORED)

        z.writestr("RESTAURER.txt", (
            "Pour restaurer : arrêter le site, remettre aventurier.db à l'emplacement de la base\n"
            "(DATABASE_URL) et le contenu de uploads/ dans le dossier des fichiers (UPLOAD_DIR), puis relancer.\n"
        ))
    return archive
