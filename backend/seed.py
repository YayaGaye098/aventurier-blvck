"""Crée l'admin et (optionnellement) des données de démonstration.

    python seed.py --admin monidentifiant          # crée/réinitialise l'admin (mot de passe demandé)
    python seed.py --admin monidentifiant --demo   # + aventures, hôtels et photos d'exemple
"""
import argparse
import getpass

from sqlalchemy import select

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from datetime import datetime, timedelta

from app.migrations import mettre_a_jour
from articles_blog import ARTICLES
from app.models import Admin, Article, Evenement, Hotel, Photo, Service, Slide

DEMO_SERVICES = [
    ("Balade au Lac Rose", "Découverte du lac, des récolteurs de sel et des dunes voisines.", "fa-water", "Demi-journée", "/uploads/aventure_lac-rose.jpeg"),
    ("Sortie VTT dans le Saloum", "Pistes entre baobabs et bolongs, à rythme tranquille, pour tous niveaux.", "fa-person-biking", "Journée", "/uploads/aventure_saloum.jpeg"),
    ("Saint-Louis historique", "L'île, le pont Faidherbe, Guet Ndar et la Langue de Barbarie.", "fa-landmark", "Journée", "/uploads/aventure_saint-louis.jpeg"),
    ("Week-end en Casamance", "Forêts, villages et plages du sud, avec hébergement chez nos partenaires.", "fa-tree", "2 à 3 jours", "/uploads/aventure_casamance.jpeg"),
    ("Coucher de soleil à Saly", "Fin de journée en bord de mer, photos et détente.", "fa-sun", "2 heures", "/uploads/aventure_coucher-soleil.jpeg"),
    ("Excursion sur mesure", "Dites-nous ce qui vous fait rêver : on construit l'aventure ensemble.", "fa-compass", None, "/uploads/aventure_sur-mesure.jpeg"),
]

DEMO_SLIDES = [
    ("hero_velo.jpg", "Explorez le Sénégal", "autrement.",
     "Des sorties à vélo entre les baobabs, avec un guide passionné."),
    ("hero_saloum.jpg", "Cap sur le", "Sine Saloum",
     "Mangroves, balade en pirogue et îles secrètes : une journée hors du temps."),
    ("hero_lac-rose.jpg", "Des paysages", "qui en mettent plein les yeux.",
     "Lac Rose, salines colorées, dunes : le Sénégal comme vous ne l'avez jamais vu."),
    ("hero_coucher-soleil.jpg", "Des couchers de soleil", "inoubliables.",
     "Fin de journée les pieds dans l'eau, entre baobabs et lumière dorée."),
    ("hero_groupe.jpg", "Partez seul,", "revenez entre amis.",
     "Nos sorties de groupe : bonne humeur, rencontres et souvenirs garantis."),
    ("hero_casamance.jpg", "Au cœur des", "baobabs géants.",
     "Villages, nature et traditions : des week-ends authentiques partout au pays."),
]

DEMO_HOTELS = [
    ("Hôtel partenaire (exemple)", "Saly", 4, "/uploads/savana.webp", True),
    ("Résidence partenaire (exemple)", "Dakar", 5, "/uploads/radisson.webp", True),
    ("Lodge partenaire (exemple)", "Saint-Louis", 3, "/uploads/sindia.webp", False),
    ("Hôtel bord de mer (exemple)", "Dakar", 4, "/uploads/img-hotel-lagon-ii-dakar-35.webp", False),
    ("Écolodge (exemple)", "Lac Rose", 3, "/uploads/photo2jpg.webp", False),
    ("Hôtel familial (exemple)", "Mbour", 3, "/uploads/foto-hotel-1224ed5e.webp", True),
]

DEMO_ARTICLES = [
    ("Que mettre dans son sac pour une sortie à vélo", "que-mettre-dans-son-sac-pour-une-sortie-a-velo", "Conseils",
     "La liste simple pour profiter d'une journée de VTT entre baobabs et bolongs, sans rien oublier.",
     "/uploads/3.jpeg",
     """Une sortie à vélo au Sénégal, c'est du soleil, de la poussière et beaucoup de bonheur. Voici l'essentiel à emporter.

## L'indispensable

- **De l'eau** : au moins 1,5 litre par personne, plus si la sortie dure toute la journée.
- **Protection solaire** : crème, casquette ou chapeau, lunettes.
- **Des vêtements légers** et des chaussures fermées.
- **Une petite collation** : fruits, arachides, biscuits.

## Le petit plus

- Un foulard contre la poussière, surtout pendant l'harmattan.
- Un téléphone chargé pour les photos (et une batterie externe).

> Le vélo, le casque et l'encadrement sont fournis par le guide. Vous n'avez qu'à venir !

*Article d'exemple : modifiez-le ou supprimez-le depuis l'espace admin.*"""),
    ("Lac Rose : quand y aller ?", "lac-rose-quand-y-aller", "Destinations",
     "La couleur du lac change selon la saison et l'heure. Nos conseils pour la meilleure visite.",
     "/uploads/7.jpeg",
     """Le Lac Rose est l'une des sorties préférées de nos voyageurs.

## La bonne saison

La couleur est en général plus marquée en saison sèche, quand le soleil est fort et le vent faible.

## Le bon moment de la journée

Privilégiez le milieu de journée pour la couleur, ou la fin d'après-midi pour la lumière et la fraîcheur.

## Sur place

Rencontre avec les récolteurs de sel, balade dans les dunes, déjeuner au bord du lac : comptez une demi-journée.

*Article d'exemple : modifiez-le ou supprimez-le depuis l'espace admin.*"""),
    ("Partir en groupe : comment on organise votre sortie", "partir-en-groupe-comment-on-organise-votre-sortie", "Coulisses",
     "Anniversaire, sortie d'entreprise, bande d'amis : voici comment se passe l'organisation, étape par étape.",
     "/uploads/4.jpeg",
     """Vous êtes plusieurs et vous voulez une journée mémorable ? On s'occupe de tout.

1. **Vous nous écrivez** : destination, date, nombre de personnes, budget.
2. **On vous propose un programme** avec transport, activités et repas.
3. **Vous validez**, on réserve les hôtels ou restaurants partenaires.
4. **Le jour J**, on vous accompagne du départ au retour.

*Article d'exemple : modifiez-le ou supprimez-le depuis l'espace admin.*"""),
]

# Prochaine sortie de groupe (affichée dans « Prochains départs » tant que la date n'est pas passée).
DEMO_EVENEMENTS = [
    dict(
        titre="Cap sur le Sine Saloum", lieu="Sine Saloum",
        description="Une escapade inoubliable au cœur de la nature : mangroves, balade en pirogue, "
                    "découvertes et détente. Plus qu'un voyage, une expérience unique !",
        date_debut=datetime(2026, 11, 14, 8, 0), prix_adulte=32900, prix_enfant=28900,
        telephone="77 103 41 49", image="/uploads/evenement_sine-saloum.jpeg",
        video="/uploads/evenement_sine-saloum.mp4", actif=True,
    ),
]

DEMO_PHOTOS = [
    "1.jpeg", "2.jpeg", "3.jpeg", "4.jpeg", "6.jpeg", "7.jpeg", "8.jpeg",
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--admin", required=True, help="identifiant de l'administrateur")
    p.add_argument("--password", help="mot de passe (sinon demandé de façon masquée)")
    p.add_argument("--demo", action="store_true", help="ajoute des données d'exemple si la base est vide")
    args = p.parse_args()

    Base.metadata.create_all(bind=engine)
    mettre_a_jour(engine)
    password = args.password or getpass.getpass("Mot de passe admin (8 caractères min.) : ")
    if len(password) < 8:
        raise SystemExit("Mot de passe trop court (8 caractères minimum).")

    with SessionLocal() as db:
        admin = db.scalar(select(Admin).where(Admin.username == args.admin))
        if admin:
            admin.password_hash = hash_password(password)
            print(f"Mot de passe de « {args.admin} » mis à jour.")
        else:
            db.add(Admin(username=args.admin, password_hash=hash_password(password)))
            print(f"Admin « {args.admin} » créé.")

        if args.demo and not db.scalar(select(Service.id).limit(1)):
            for titre, desc, icone, duree, image in reversed(DEMO_SERVICES):
                db.add(Service(titre=titre, description=desc, icone=icone, duree=duree, image=image))
            for i, (fichier, titre, accent, texte) in enumerate(DEMO_SLIDES, start=1):
                db.add(Slide(media=f"/uploads/{fichier}", titre=titre, accent=accent, texte=texte, ordre=i))
            for nom, ville, etoiles, image, featured in DEMO_HOTELS:
                db.add(Hotel(
                    nom=nom, ville=ville, etoiles=etoiles, image=image, featured=featured,
                    description="Établissement d'exemple : remplacez-le par un vrai partenaire depuis l'espace admin.",
                ))
            for ev in DEMO_EVENEMENTS:
                db.add(Evenement(**ev))
            for name in DEMO_PHOTOS:
                db.add(Photo(image=f"/uploads/{name}", titre="Aventure"))
            for i, (titre, slug, cat, extrait, image, contenu) in enumerate(DEMO_ARTICLES):
                db.add(Article(titre=titre, slug=slug, categorie=cat, extrait=extrait, image=image, contenu=contenu,
                               publie=True, published_at=datetime.now() - timedelta(days=3 * i)))
            # Articles prêts à illustrer : en brouillon, à publier depuis l'admin après ajout des photos.
            for titre, slug, cat, extrait, contenu in ARTICLES:
                db.add(Article(titre=titre, slug=slug, categorie=cat, extrait=extrait, contenu=contenu, publie=False))
            print("Données de démonstration ajoutées.")
        db.commit()


if __name__ == "__main__":
    main()
