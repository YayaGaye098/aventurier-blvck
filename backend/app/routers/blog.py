import math
import re
import unicodedata
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_admin
from ..database import get_db
from ..models import Article
from ..schemas import ArticleCard, ArticleIn, ArticleOut, ArticlePage
from ..uploads import delete_image, save_image

public = APIRouter(prefix="/api/blog", tags=["blog"])
admin = APIRouter(prefix="/api/admin/blog", tags=["admin"], dependencies=[Depends(current_admin)])


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:200] or "article"


def unique_slug(db: Session, wanted: str, exclude_id: int | None = None) -> str:
    base, slug, n = wanted, wanted, 2
    while True:
        q = select(Article.id).where(Article.slug == slug)
        if exclude_id:
            q = q.where(Article.id != exclude_id)
        if not db.scalar(q):
            return slug
        slug, n = f"{base}-{n}", n + 1


def lecture(contenu: str) -> int:
    return max(1, math.ceil(len(contenu.split()) / 200))


def card(a: Article) -> ArticleCard:
    return ArticleCard.model_validate(a).model_copy(update={"temps_lecture": lecture(a.contenu)})


def full(a: Article) -> ArticleOut:
    return ArticleOut.model_validate(a).model_copy(update={"temps_lecture": lecture(a.contenu)})


def apply(db: Session, a: Article, data: ArticleIn) -> None:
    a.titre = data.titre.strip()
    a.slug = unique_slug(db, slugify(data.slug or data.titre), a.id)
    a.extrait = data.extrait.strip()
    a.contenu = data.contenu
    a.categorie = (data.categorie or "").strip() or None
    if data.publie and not a.publie:
        a.published_at = a.published_at or datetime.now()
    a.publie = data.publie


# ── Public ─────────────────────────────────────────────
@public.get("", response_model=ArticlePage)
def list_articles(page: int = 1, par_page: int = 9, categorie: str | None = None, db: Session = Depends(get_db)):
    page, par_page = max(1, page), max(1, min(par_page, 30))
    where = [Article.publie]
    if categorie:
        where.append(Article.categorie == categorie)
    total = db.scalar(select(func.count()).select_from(Article).where(*where)) or 0
    rows = db.scalars(
        select(Article).where(*where)
        .order_by(Article.published_at.desc(), Article.id.desc())
        .offset((page - 1) * par_page).limit(par_page)
    ).all()
    return ArticlePage(items=[card(a) for a in rows], total=total, page=page, pages=max(1, math.ceil(total / par_page)))


@public.get("/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)):
    q = select(Article.categorie).where(Article.publie, Article.categorie.is_not(None)).distinct().order_by(Article.categorie)
    return db.scalars(q).all()


@public.get("/{slug}", response_model=ArticleOut)
def get_article(slug: str, db: Session = Depends(get_db)):
    a = db.scalar(select(Article).where(Article.slug == slug, Article.publie))
    if not a:
        raise HTTPException(404, "Article introuvable.")
    return full(a)


# ── Admin ──────────────────────────────────────────────
@admin.get("", response_model=list[ArticleCard])
def admin_list(db: Session = Depends(get_db)):
    rows = db.scalars(select(Article).order_by(Article.publie, Article.updated_at.desc(), Article.id.desc())).all()
    return [card(a) for a in rows]


@admin.get("/{id}", response_model=ArticleOut)
def admin_get(id: int, db: Session = Depends(get_db)):
    a = db.get(Article, id)
    if not a:
        raise HTTPException(404, "Article introuvable.")
    return full(a)


@admin.post("", response_model=ArticleOut)
def admin_create(data: ArticleIn, db: Session = Depends(get_db)):
    a = Article(publie=False)
    apply(db, a, data)
    db.add(a)
    db.commit()
    return full(a)


@admin.put("/{id}", response_model=ArticleOut)
def admin_update(id: int, data: ArticleIn, db: Session = Depends(get_db)):
    a = db.get(Article, id)
    if not a:
        raise HTTPException(404, "Article introuvable.")
    apply(db, a, data)
    db.commit()
    db.refresh(a)
    return full(a)


@admin.post("/{id}/image", response_model=ArticleOut)
async def admin_image(id: int, image: UploadFile = File(...), db: Session = Depends(get_db)):
    a = db.get(Article, id)
    if not a:
        raise HTTPException(404, "Article introuvable.")
    url = await save_image(image, "blog")
    delete_image(a.image)
    a.image = url
    db.commit()
    db.refresh(a)
    return full(a)


@admin.post("/upload", response_model=dict)
async def admin_upload_inline(image: UploadFile = File(...)):
    """Image à insérer dans le corps d'un article."""
    return {"url": await save_image(image, "blog")}


@admin.delete("/{id}")
def admin_delete(id: int, db: Session = Depends(get_db)):
    a = db.get(Article, id)
    if not a:
        raise HTTPException(404, "Article introuvable.")
    delete_image(a.image)
    db.delete(a)
    db.commit()
    return {"success": True}
