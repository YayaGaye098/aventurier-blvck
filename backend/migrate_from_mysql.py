"""Copie les données de l'ancien site PHP (MySQL « aventurier_blvck ») vers la nouvelle base.

    pip install pymysql
    python migrate_from_mysql.py --host localhost --user root --password "" --db aventurier_blvck

- Les comptes admin sont repris tels quels : les anciens mots de passe continuent de marcher.
- Les chemins d'images (« ../assets/images/upload/xxx.jpg ») deviennent « /uploads/xxx.jpg ».
  Pensez à copier les fichiers de l'ancien dossier assets/images/upload(s)/ dans backend/uploads/.
"""
import argparse
from pathlib import PurePosixPath

import pymysql
import pymysql.cursors

from app.database import Base, SessionLocal, engine
from app.models import Admin, Contact, Hotel, Photo, Service


def img(path):
    return f"/uploads/{PurePosixPath(path).name}" if path else None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="localhost")
    p.add_argument("--user", default="root")
    p.add_argument("--password", default="")
    p.add_argument("--db", default="aventurier_blvck")
    a = p.parse_args()

    src = pymysql.connect(host=a.host, user=a.user, password=a.password, database=a.db,
                          charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor)
    Base.metadata.create_all(bind=engine)

    def rows(table):
        with src.cursor() as c:
            c.execute(f"SELECT * FROM {table}")
            return c.fetchall()

    with SessionLocal() as db:
        for r in rows("admins"):
            db.merge(Admin(id=r["id"], username=r["username"], password_hash=r["password"]))
        for r in rows("services"):
            db.merge(Service(id=r["id"], titre=r["titre"], description=r.get("description") or "",
                             icone=r.get("icone") or "fa-compass", prix=r.get("prix"),
                             duree=r.get("duree"), actif=bool(r.get("actif", 1))))
        for r in rows("hotels"):
            db.merge(Hotel(id=r["id"], nom=r["nom"], ville=r["ville"], description=r.get("description") or "",
                           adresse=r.get("adresse"), telephone=r.get("telephone"), email=r.get("email"),
                           site_web=r.get("site_web"), etoiles=r.get("etoiles") or 3,
                           prix_nuit=int(r["prix_nuit"]) if r.get("prix_nuit") else None,
                           image=img(r.get("image")), actif=bool(r.get("actif", 1)),
                           featured=bool(r.get("featured", 0))))
        for r in rows("galerie"):
            db.merge(Photo(id=r["id"], titre=r.get("titre"), image=img(r["image"]),
                           categorie=r.get("categorie"), actif=bool(r.get("actif", 1)),
                           created_at=r.get("created_at")))
        for r in rows("contacts"):
            db.merge(Contact(id=r["id"], nom=r["nom"], email=r["email"], telephone=r.get("telephone"),
                             message=r["message"], lu=bool(r.get("lu", 0)), created_at=r.get("created_at")))
        db.commit()
    print("Migration terminée.")


if __name__ == "__main__":
    main()
