import uuid
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import settings

FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif"}

# Les photos sont ramenées à cette taille maximale (largeur ou hauteur) : nettes en plein écran,
# mais légères pour les visiteurs sur mobile.
TAILLE_MAX_PX = 2400
POIDS_OK = 900 * 1024  # en dessous, une photo déjà à la bonne taille est gardée telle quelle


def optimiser(data: bytes, fmt: str) -> tuple[bytes, str]:
    """Redresse (EXIF), redimensionne et compresse une photo. Renvoie (données, extension)."""
    if fmt == "GIF":  # peut être animé : on n'y touche pas
        return data, "gif"
    img = Image.open(BytesIO(data))
    tournee = img.getexif().get(0x0112, 1) != 1  # photo de téléphone prise « de côté »
    trop_grande = max(img.size) > TAILLE_MAX_PX
    if not (tournee or trop_grande or len(data) > POIDS_OK):
        return data, FORMATS[fmt]  # déjà légère et à la bonne taille
    img = ImageOps.exif_transpose(img)
    if trop_grande:
        img.thumbnail((TAILLE_MAX_PX, TAILLE_MAX_PX), Image.LANCZOS)
    out = BytesIO()
    if img.mode in ("RGBA", "LA", "P") and fmt in ("PNG", "WEBP"):
        img.save(out, "WEBP", quality=85, method=4)  # garde la transparence (logos…)
        ext = "webp"
    else:
        img.convert("RGB").save(out, "JPEG", quality=82, optimize=True, progressive=True)
        ext = "jpg"
    resultat = out.getvalue()
    if not (tournee or trop_grande) and len(resultat) >= len(data):
        return data, FORMATS[fmt]  # la recompression n'apporte rien : on garde l'original
    return resultat, ext


async def save_image(file: UploadFile, prefix: str) -> str:
    """Vérifie que le fichier est une vraie image, l'enregistre et renvoie son URL publique."""
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"Image trop lourde (max {settings.max_upload_mb} Mo).")
    try:
        img = Image.open(BytesIO(data))
        img.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "Le fichier envoyé n'est pas une image valide.")
    if (img.format or "") not in FORMATS:
        raise HTTPException(400, "Format accepté : JPG, PNG, WEBP ou GIF (pour une photo HEIC d'iPhone, choisissez « JPEG » à l'export).")
    try:
        data, ext = optimiser(data, img.format)
    except (OSError, ValueError):  # image inhabituelle : on garde le fichier d'origine
        ext = FORMATS[img.format]
    name = f"{prefix}_{uuid.uuid4().hex[:12]}.{ext}"
    (settings.upload_dir / name).write_bytes(data)
    return f"/uploads/{name}"


async def save_video(file: UploadFile, prefix: str) -> str:
    """Enregistre une vidéo MP4/MOV/WEBM (lue par morceaux) et renvoie son URL publique."""
    head = await file.read(16)
    if len(head) >= 12 and head[4:8] == b"ftyp":
        ext = "mov" if head[8:10] == b"qt" else "mp4"
    elif head[:4] == bytes.fromhex("1a45dfa3"):
        ext = "webm"
    else:
        raise HTTPException(400, "Format vidéo accepté : MP4, MOV ou WEBM.")
    limit = settings.max_video_mb * 1024 * 1024
    name = f"{prefix}_{uuid.uuid4().hex[:12]}.{ext}"
    path = settings.upload_dir / name
    size = len(head)
    try:
        with path.open("wb") as out:
            out.write(head)
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(400, f"Vidéo trop lourde (max {settings.max_video_mb} Mo).")
                out.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return f"/uploads/{name}"


def delete_image(url: str | None) -> None:
    if url and url.startswith("/uploads/"):
        path = settings.upload_dir / url.removeprefix("/uploads/")
        if path.is_file() and path.parent == settings.upload_dir:
            path.unlink()
