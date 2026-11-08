from datetime import datetime, time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..notify import envoyer_whatsapp
from ..models import Avis, Contact, Evenement, Statistique, Hotel, Photo, Service
from ..security import avis_limiter, client_ip, contact_limiter, track_limiter
from ..schemas import AvisOut, AvisPublicIn, ContactIn, TrackIn, EvenementOut, HotelOut, PhotoOut, ServiceOut

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/services", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.scalars(select(Service).where(Service.actif).order_by(Service.id.desc())).all()


@router.get("/evenements", response_model=list[EvenementOut])
def list_evenements(db: Session = Depends(get_db)):
    """Sorties à venir (celles du jour restent visibles jusqu'à minuit), la plus proche en premier."""
    debut_du_jour = datetime.combine(datetime.now().date(), time.min)
    q = select(Evenement).where(Evenement.actif, Evenement.date_debut >= debut_du_jour).order_by(Evenement.date_debut)
    return db.scalars(q).all()


@router.get("/hotels", response_model=list[HotelOut])
def list_hotels(ville: str | None = None, db: Session = Depends(get_db)):
    q = select(Hotel).where(Hotel.actif)
    if ville:
        q = q.where(Hotel.ville == ville)
    q = q.order_by(Hotel.featured.desc(), Hotel.etoiles.desc(), Hotel.nom)
    return db.scalars(q).all()


@router.get("/villes", response_model=list[str])
def list_villes(db: Session = Depends(get_db)):
    return db.scalars(select(Hotel.ville).where(Hotel.actif).distinct().order_by(Hotel.ville)).all()


@router.get("/galerie", response_model=list[PhotoOut])
def list_photos(limit: int = 12, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 60))
    q = select(Photo).where(Photo.actif).order_by(Photo.created_at.desc(), Photo.id.desc()).limit(limit)
    return db.scalars(q).all()


@router.post("/contact")
def send_contact(data: ContactIn, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    ip = client_ip(request)
    contact_limiter.check(ip)
    contact_limiter.hit(ip)
    if not data.website:  # le champ piège est vide : c'est un humain
        db.add(Contact(**data.model_dump(exclude={"website"})))
        db.commit()
        lignes = [f"📩 Nouveau message sur le site", f"👤 {data.nom}", f"✉️ {data.email}"]
        if data.telephone:
            lignes.append(f"📞 {data.telephone}")
        lignes.append(f"\n{data.message[:800]}")
        background.add_task(envoyer_whatsapp, "\n".join(lignes))
    return {"success": True, "message": f"Merci {data.nom} ! Votre message a bien été envoyé. Je vous réponds très vite."}


@router.get("/avis", response_model=list[AvisOut])
def list_avis(db: Session = Depends(get_db)):
    return db.scalars(select(Avis).where(Avis.actif).order_by(Avis.created_at.desc(), Avis.id.desc()).limit(12)).all()


@router.post("/avis")
def send_avis(data: AvisPublicIn, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    ip = client_ip(request)
    avis_limiter.check(ip)
    avis_limiter.hit(ip)
    if not data.website:
        db.add(Avis(**data.model_dump(exclude={"website"}), actif=False))
        db.commit()
        background.add_task(envoyer_whatsapp, f"⭐ Nouvel avis à valider ({data.note}/5) de {data.nom} :\n{data.texte[:600]}")
    return {"success": True, "message": f"Merci {data.nom} ! Votre avis sera publié après relecture."}


@router.post("/track", status_code=204)
def track(data: TrackIn, request: Request, db: Session = Depends(get_db)):
    """Incrémente un compteur anonyme du jour (visite, clic WhatsApp…)."""
    ip = client_ip(request)
    try:
        track_limiter.check(ip)
    except HTTPException:
        return Response(status_code=204)
    track_limiter.hit(ip)
    jour, cible = datetime.now().date(), data.cible.strip()[:150]
    for _ in range(2):  # 2e essai si deux visites créent la même ligne au même instant
        stat = db.scalar(select(Statistique).where(
            Statistique.jour == jour, Statistique.type == data.type, Statistique.cible == cible))
        if stat:
            stat.total += 1
        else:
            db.add(Statistique(jour=jour, type=data.type, cible=cible, total=1))
        try:
            db.commit()
            break
        except IntegrityError:
            db.rollback()
    return Response(status_code=204)
