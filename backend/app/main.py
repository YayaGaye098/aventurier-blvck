
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, IS_PROD, settings
from .database import Base, engine
from . import seo
from .routers import admin, blog, public
from .security import SecurityHeaders

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Aventurier Blvck API",
    version="2.0.0",
    # En production, on ne publie pas la liste des routes de l'API.
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
    openapi_url=None if IS_PROD else "/openapi.json",
)

app.add_middleware(SecurityHeaders)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(admin.router)
app.include_router(admin.auth)
app.include_router(blog.public)
app.include_router(blog.admin)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# En production, FastAPI peut aussi servir le site Angular compilé (un seul serveur à héberger).
FRONT_DIST = BASE_DIR.parent / "frontend" / "dist" / "frontend" / "browser"
if FRONT_DIST.is_dir():
    INDEX_HTML = (FRONT_DIST / "index.html").read_text(encoding="utf-8")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str, request: Request):
        if path.startswith("api/"):
            raise HTTPException(404, "Route introuvable.")
        file = (FRONT_DIST / path).resolve()
        if path and file.is_file() and FRONT_DIST.resolve() in file.parents:
            return FileResponse(file)
        try:
            page = seo.rendre(INDEX_HTML, seo.meta_pour(request, path.strip("/")) or {})
        except Exception:  # un aperçu raté ne doit jamais empêcher l'affichage du site
            page = INDEX_HTML
        return HTMLResponse(page, headers={"Cache-Control": "no-cache"})
