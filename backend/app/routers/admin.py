import shutil
from datetime import date, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..auth import create_token, current_admin, hash_password, verify_password
from ..backup import creer_sauvegarde
from ..database import get_db
from ..models import Admin, Article, Avis, Contact, Evenement, Hotel, Photo, Reglage, Service, Slide, Statistique
from ..schemas import (
    TYPES_STAT, AvisIn, AvisOut, ContactOut, EvenementIn, EvenementOut, HotelIn, HotelOut, LoginIn, PasswordChange,
    PhotoOut, PhotoUpdate, ReglagesOut, ServiceIn, ServiceOut, SlideIn, SlideOut, StatCible, StatJour, Statistiques, Stats, TokenOut,
)
from ..security import client_ip, login_limiter
from ..uploads import delete_image, save_image, save_video

router = APIRouter(prefix="/api/admin", tags=["admin"])
auth = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(current_admin)])


def get_or_404(db: Session, model, id: int):
    obj = db.get(model, id)
    if not obj:
        raise HTTPException(404, "Élément introuvable.")
    return obj


# ── Connexion ──────────────────────────────────────────
@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    login_limiter.check(ip)
    admin = db.scalar(select(Admin).where(Admin.username == data.username))
    if not admin or not verify_password(data.password, admin.password_hash):
        login_limiter.hit(ip)
        raise HTTPException(401, "Identifiant ou mot de passe incorrect.")
    login_limiter.reset(ip)
    return TokenOut(access_token=create_token(admin))


@auth.get("/me")
def me(admin: Admin = Depends(current_admin)):
    return {"id": admin.id, "username": admin.username}


@auth.post("/password")
def change_password(data: PasswordChange, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)):
    if not verify_password(data.ancien, admin.password_hash):
        raise HTTPException(400, "Ancien mot de passe incorrect.")
    admin.password_hash = hash_password(data.nouveau)
    db.merge(admin)
    db.commit()
    return {"success": True}


@auth.get("/stats", response_model=Stats)
def stats(db: Session = Depends(get_db)):
    count = lambda m, *w: db.scalar(select(func.count()).select_from(m).where(*w))  # noqa: E731
    return Stats(
        hotels=count(Hotel), services=count(Service), photos=count(Photo), articles=count(Article),
        messages=count(Contact), non_lus=count(Contact, Contact.lu.is_(False)),
        evenements=count(Evenement), avis_attente=count(Avis, Avis.actif.is_(False)),
    )


# ── Hôtels ─────────────────────────────────────────────
@auth.get("/hotels", response_model=list[HotelOut])
def admin_hotels(db: Session = Depends(get_db)):
    return db.scalars(select(Hotel).order_by(Hotel.featured.desc(), Hotel.ville, Hotel.nom)).all()


@auth.post("/hotels", response_model=HotelOut)
def create_hotel(data: HotelIn, db: Session = Depends(get_db)):
    hotel = Hotel(**data.model_dump())
    db.add(hotel)
    db.commit()
    return hotel


@auth.put("/hotels/{id}", response_model=HotelOut)
def update_hotel(id: int, data: HotelIn, db: Session = Depends(get_db)):
    hotel = get_or_404(db, Hotel, id)
    for k, v in data.model_dump().items():
        setattr(hotel, k, v)
    db.commit()
    return hotel


@auth.post("/hotels/{id}/image", response_model=HotelOut)
async def hotel_image(id: int, image: UploadFile = File(...), db: Session = Depends(get_db)):
    hotel = get_or_404(db, Hotel, id)
    url = await save_image(image, "hotel")
    delete_image(hotel.image)
    hotel.image = url
    db.commit()
    return hotel


@auth.post("/hotels/{id}/video", response_model=HotelOut)
async def hotel_video(id: int, video: UploadFile = File(...), db: Session = Depends(get_db)):
    hotel = get_or_404(db, Hotel, id)
    url = await save_video(video, "hotel")
    delete_image(hotel.video)
    hotel.video = url
    db.commit()
    return hotel


@auth.delete("/hotels/{id}/video", response_model=HotelOut)
def hotel_video_delete(id: int, db: Session = Depends(get_db)):
    hotel = get_or_404(db, Hotel, id)
    delete_image(hotel.video)
    hotel.video = None
    db.commit()
    return hotel


@auth.delete("/hotels/{id}")
def delete_hotel(id: int, db: Session = Depends(get_db)):
    hotel = get_or_404(db, Hotel, id)
    delete_image(hotel.image)
    delete_image(hotel.video)
    db.delete(hotel)
    db.commit()
    return {"success": True}


# ── Sauvegarde ─────────────────────────────────────────
@auth.get("/sauvegarde")
def sauvegarde(background: BackgroundTasks):
    """Télécharge un .zip avec la base de données et toutes les photos/vidéos."""
    archive = creer_sauvegarde()
    background.add_task(shutil.rmtree, archive.parent, ignore_errors=True)
    return FileResponse(archive, media_type="application/zip", filename=archive.name)


# ── Statistiques de visites ────────────────────────────
@auth.get("/statistiques", response_model=Statistiques)
def statistiques(jours: int = 30, db: Session = Depends(get_db)):
    jours = max(7, min(jours, 365))
    aujourdhui = datetime.now().date()
    debut = aujourdhui - timedelta(days=jours - 1)
    rows = db.execute(
        select(Statistique.jour, Statistique.type, Statistique.cible, Statistique.total)
        .where(Statistique.jour >= debut)
    ).all()
    totaux: dict[str, int] = {t: 0 for t in TYPES_STAT}
    visites: dict[date, int] = {}
    wa: dict[str, int] = {}
    for jour, type_, cible, total in rows:
        totaux[type_] = totaux.get(type_, 0) + total
        if type_ == "visite":
            visites[jour] = visites.get(jour, 0) + total
        elif type_ == "whatsapp":
            cle = cible or "Bouton WhatsApp général"
            wa[cle] = wa.get(cle, 0) + total
    serie = [
        StatJour(jour=(debut + timedelta(days=i)).isoformat(), visites=visites.get(debut + timedelta(days=i), 0))
        for i in range(jours)
    ]
    top = [StatCible(cible=c, total=t) for c, t in sorted(wa.items(), key=lambda x: -x[1])[:8]]
    return Statistiques(jours=jours, totaux=totaux, visites_par_jour=serie, whatsapp_par_cible=top,
                        aujourdhui=visites.get(aujourdhui, 0))


# ── Avis clients ───────────────────────────────────────
@auth.get("/avis", response_model=list[AvisOut])
def admin_avis(db: Session = Depends(get_db)):
    # Les avis en attente de validation d'abord.
    return db.scalars(select(Avis).order_by(Avis.actif, Avis.created_at.desc(), Avis.id.desc())).all()


@auth.post("/avis", response_model=AvisOut)
def create_avis(data: AvisIn, db: Session = Depends(get_db)):
    avis = Avis(**data.model_dump())
    db.add(avis)
    db.commit()
    return avis


@auth.put("/avis/{id}", response_model=AvisOut)
def update_avis(id: int, data: AvisIn, db: Session = Depends(get_db)):
    avis = get_or_404(db, Avis, id)
    for k, v in data.model_dump().items():
        setattr(avis, k, v)
    db.commit()
    return avis


@auth.post("/avis/{id}/image", response_model=AvisOut)
async def avis_image(id: int, image: UploadFile = File(...), db: Session = Depends(get_db)):
    avis = get_or_404(db, Avis, id)
    url = await save_image(image, "avis")
    delete_image(avis.image)
    avis.image = url
    db.commit()
    return avis


@auth.delete("/avis/{id}")
def delete_avis(id: int, db: Session = Depends(get_db)):
    avis = get_or_404(db, Avis, id)
    delete_image(avis.image)
    db.delete(avis)
    db.commit()
    return {"success": True}


# ── Vidéo du bloc « Qui sommes-nous » ─────────────────
def _reglages(db: Session) -> ReglagesOut:
    return ReglagesOut(**{r.cle: r.valeur for r in db.scalars(select(Reglage)) if r.cle in ReglagesOut.model_fields})


@auth.post("/apropos/video", response_model=ReglagesOut)
async def apropos_video(video: UploadFile = File(...), db: Session = Depends(get_db)):
    url = await save_video(video, "apropos")
    r = db.get(Reglage, "apropos_video") or Reglage(cle="apropos_video")
    delete_image(r.valeur)
    r.valeur = url
    db.merge(r)
    db.commit()
    return _reglages(db)


@auth.delete("/apropos/video", response_model=ReglagesOut)
def apropos_video_delete(db: Session = Depends(get_db)):
    r = db.get(Reglage, "apropos_video")
    if r:
        delete_image(r.valeur)
        db.delete(r)
        db.commit()
    return _reglages(db)


# ── Carrousel de l'accueil ─────────────────────────────
@auth.get("/slides", response_model=list[SlideOut])
def admin_slides(db: Session = Depends(get_db)):
    return db.scalars(select(Slide).order_by(Slide.ordre, Slide.id)).all()


@auth.post("/slides", response_model=SlideOut)
def create_slide(data: SlideIn, db: Session = Depends(get_db)):
    slide = Slide(**data.model_dump())
    if not data.ordre:  # nouvelle diapo : à la fin
        slide.ordre = (db.scalar(select(func.max(Slide.ordre))) or 0) + 1
    db.add(slide)
    db.commit()
    return slide


@auth.put("/slides/{id}", response_model=SlideOut)
def update_slide(id: int, data: SlideIn, db: Session = Depends(get_db)):
    slide = get_or_404(db, Slide, id)
    for k, v in data.model_dump().items():
        setattr(slide, k, v)
    db.commit()
    return slide


@auth.post("/slides/{id}/media", response_model=SlideOut)
async def slide_media(id: int, media: UploadFile = File(...), db: Session = Depends(get_db)):
    """Photo ou vidéo de la diapo (le type est détecté d'après le fichier)."""
    slide = get_or_404(db, Slide, id)
    if (media.content_type or "").startswith("video/"):
        url, kind = await save_video(media, "slide"), "video"
    else:
        url, kind = await save_image(media, "slide"), "image"
    delete_image(slide.media)
    slide.media, slide.media_type = url, kind
    db.commit()
    return slide


@auth.delete("/slides/{id}")
def delete_slide(id: int, db: Session = Depends(get_db)):
    slide = get_or_404(db, Slide, id)
    delete_image(slide.media)
    db.delete(slide)
    db.commit()
    return {"success": True}


# ── Événements (sorties datées) ───────────────────────
@auth.get("/evenements", response_model=list[EvenementOut])
def admin_evenements(db: Session = Depends(get_db)):
    return db.scalars(select(Evenement).order_by(Evenement.date_debut.desc())).all()


@auth.post("/evenements", response_model=EvenementOut)
def create_evenement(data: EvenementIn, db: Session = Depends(get_db)):
    ev = Evenement(**data.model_dump())
    db.add(ev)
    db.commit()
    return ev


@auth.put("/evenements/{id}", response_model=EvenementOut)
def update_evenement(id: int, data: EvenementIn, db: Session = Depends(get_db)):
    ev = get_or_404(db, Evenement, id)
    for k, v in data.model_dump().items():
        setattr(ev, k, v)
    db.commit()
    return ev


@auth.post("/evenements/{id}/image", response_model=EvenementOut)
async def evenement_image(id: int, image: UploadFile = File(...), db: Session = Depends(get_db)):
    ev = get_or_404(db, Evenement, id)
    url = await save_image(image, "evenement")
    delete_image(ev.image)
    ev.image = url
    db.commit()
    return ev


@auth.post("/evenements/{id}/video", response_model=EvenementOut)
async def evenement_video(id: int, video: UploadFile = File(...), db: Session = Depends(get_db)):
    ev = get_or_404(db, Evenement, id)
    url = await save_video(video, "evenement")
    delete_image(ev.video)
    ev.video = url
    db.commit()
    return ev


@auth.delete("/evenements/{id}/video", response_model=EvenementOut)
def evenement_video_delete(id: int, db: Session = Depends(get_db)):
    ev = get_or_404(db, Evenement, id)
    delete_image(ev.video)
    ev.video = None
    db.commit()
    return ev


@auth.delete("/evenements/{id}")
def delete_evenement(id: int, db: Session = Depends(get_db)):
    ev = get_or_404(db, Evenement, id)
    delete_image(ev.image)
    delete_image(ev.video)
    db.delete(ev)
    db.commit()
    return {"success": True}


# ── Aventures ──────────────────────────────────────────
@auth.get("/services", response_model=list[ServiceOut])
def admin_services(db: Session = Depends(get_db)):
    return db.scalars(select(Service).order_by(Service.id.desc())).all()


@auth.post("/services", response_model=ServiceOut)
def create_service(data: ServiceIn, db: Session = Depends(get_db)):
    service = Service(**data.model_dump())
    db.add(service)
    db.commit()
    return service


@auth.put("/services/{id}", response_model=ServiceOut)
def update_service(id: int, data: ServiceIn, db: Session = Depends(get_db)):
    service = get_or_404(db, Service, id)
    for k, v in data.model_dump().items():
        setattr(service, k, v)
    db.commit()
    return service


@auth.post("/services/{id}/image", response_model=ServiceOut)
async def service_image(id: int, image: UploadFile = File(...), db: Session = Depends(get_db)):
    service = get_or_404(db, Service, id)
    url = await save_image(image, "aventure")
    delete_image(service.image)
    service.image = url
    db.commit()
    return service


@auth.delete("/services/{id}")
def delete_service(id: int, db: Session = Depends(get_db)):
    service = get_or_404(db, Service, id)
    delete_image(service.image)
    db.delete(service)
    db.commit()
    return {"success": True}


# ── Galerie ────────────────────────────────────────────
@auth.get("/galerie", response_model=list[PhotoOut])
def admin_photos(db: Session = Depends(get_db)):
    return db.scalars(select(Photo).order_by(Photo.created_at.desc(), Photo.id.desc())).all()


@auth.post("/galerie", response_model=PhotoOut)
async def add_photo(
    image: UploadFile = File(...),
    titre: str | None = Form(None),
    categorie: str | None = Form(None),
    db: Session = Depends(get_db),
):
    # Le champ s'appelle « image » mais accepte aussi une vidéo (MP4, MOV, WEBM).
    if (image.content_type or "").startswith("video/"):
        url, kind = await save_video(image, "galerie"), "video"
    else:
        url, kind = await save_image(image, "galerie"), "image"
    photo = Photo(image=url, media_type=kind, titre=titre or None, categorie=categorie or None)
    db.add(photo)
    db.commit()
    return photo


@auth.put("/galerie/{id}", response_model=PhotoOut)
def update_photo(id: int, data: PhotoUpdate, db: Session = Depends(get_db)):
    photo = get_or_404(db, Photo, id)
    for k, v in data.model_dump().items():
        setattr(photo, k, v)
    db.commit()
    return photo


@auth.delete("/galerie/{id}")
def delete_photo(id: int, db: Session = Depends(get_db)):
    photo = get_or_404(db, Photo, id)
    delete_image(photo.image)
    db.delete(photo)
    db.commit()
    return {"success": True}


# ── Messages ───────────────────────────────────────────
@auth.get("/contacts", response_model=list[ContactOut])
def admin_contacts(db: Session = Depends(get_db)):
    return db.scalars(select(Contact).order_by(Contact.created_at.desc(), Contact.id.desc())).all()


@auth.patch("/contacts/{id}", response_model=ContactOut)
def mark_contact(id: int, lu: bool = True, db: Session = Depends(get_db)):
    contact = get_or_404(db, Contact, id)
    contact.lu = lu
    db.commit()
    return contact


@auth.post("/contacts/tout-lu")
def mark_all_read(db: Session = Depends(get_db)):
    db.execute(update(Contact).values(lu=True))
    db.commit()
    return {"success": True}


@auth.delete("/contacts/{id}")
def delete_contact(id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Contact, id))
    db.commit()
    return {"success": True}
