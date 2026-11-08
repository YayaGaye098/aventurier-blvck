import os
import tempfile
from io import BytesIO

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.auth import hash_password, verify_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Admin  # noqa: E402

client = TestClient(app)

with SessionLocal() as db:
    db.add(Admin(username="guide", password_hash=hash_password("motdepasse123")))
    db.commit()


def token():
    r = client.post("/api/admin/login", json={"username": "guide", "password": "motdepasse123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def png():
    buf = BytesIO()
    Image.new("RGB", (10, 10), "teal").save(buf, "PNG")
    return buf.getvalue()


def test_php_hash_compatible():
    php_hash = "$2y$" + hash_password("123456")[4:]
    assert verify_password("123456", php_hash)


def test_login_refuse():
    assert client.post("/api/admin/login", json={"username": "guide", "password": "faux"}).status_code == 401
    assert client.get("/api/admin/hotels").status_code == 401


def test_hotel_crud_and_public_filter():
    h = token()
    r = client.post("/api/admin/hotels", headers=h, json={"nom": "Teranga", "ville": "Saly", "etoiles": 4})
    assert r.status_code == 200
    hid = r.json()["id"]
    client.post("/api/admin/hotels", headers=h, json={"nom": "Caché", "ville": "Dakar", "actif": False})

    r = client.post(f"/api/admin/hotels/{hid}/image", headers=h, files={"image": ("a.png", png(), "image/png")})
    assert r.status_code == 200 and r.json()["image"].startswith("/uploads/hotel_")
    assert client.get(r.json()["image"]).status_code == 200

    assert [x["nom"] for x in client.get("/api/hotels").json()] == ["Teranga"]
    assert client.get("/api/villes").json() == ["Saly"]
    assert client.get("/api/hotels", params={"ville": "Dakar"}).json() == []
    assert client.delete(f"/api/admin/hotels/{hid}", headers=h).status_code == 200


def test_upload_refuse_non_image():
    h = token()
    hid = client.post("/api/admin/hotels", headers=h, json={"nom": "X", "ville": "Thiès"}).json()["id"]
    r = client.post(f"/api/admin/hotels/{hid}/image", headers=h,
                    files={"image": ("shell.php.png", b"<?php echo 1; ?>", "image/png")})
    assert r.status_code == 400


def test_contact_and_messages():
    r = client.post("/api/contact", json={"nom": "Awa", "email": "awa@example.com", "message": "Lac Rose samedi ?"})
    assert r.json()["success"]
    client.post("/api/contact", json={"nom": "Bot", "email": "b@example.com", "message": "spam", "website": "x"})
    assert client.post("/api/contact", json={"nom": "A", "email": "pas-un-email", "message": "x"}).status_code == 422

    h = token()
    msgs = client.get("/api/admin/contacts", headers=h).json()
    assert [m["nom"] for m in msgs] == ["Awa"]
    assert client.get("/api/admin/stats", headers=h).json()["non_lus"] == 1
    client.patch(f"/api/admin/contacts/{msgs[0]['id']}", headers=h)
    assert client.get("/api/admin/stats", headers=h).json()["non_lus"] == 0


def test_galerie_and_services():
    h = token()
    r = client.post("/api/admin/galerie", headers=h, data={"titre": "Baobab"},
                    files={"image": ("b.png", png(), "image/png")})
    assert r.status_code == 200
    assert client.get("/api/galerie").json()[0]["titre"] == "Baobab"
    s = client.post("/api/admin/services", headers=h, json={"titre": "VTT", "prix": 15000}).json()
    assert client.get("/api/services").json()[0]["prix"] == 15000
    client.put(f"/api/admin/services/{s['id']}", headers=h, json={"titre": "VTT", "actif": False})
    assert client.get("/api/services").json() == []


def test_blog_brouillon_publication_slug():
    h = token()
    a = client.post("/api/admin/blog", headers=h, json={
        "titre": "Été au Lac Rose : nos conseils !", "extrait": "Tout savoir.",
        "contenu": "mot " * 450, "categorie": "Conseils"}).json()
    assert a["slug"] == "ete-au-lac-rose-nos-conseils" and a["publie"] is False and a["temps_lecture"] == 3
    # un brouillon n'est pas visible publiquement
    assert client.get("/api/blog").json()["total"] == 0
    assert client.get(f"/api/blog/{a['slug']}").status_code == 404

    pub = client.put(f"/api/admin/blog/{a['id']}", headers=h, json={**a, "publie": True}).json()
    assert pub["published_at"]
    assert client.get(f"/api/blog/{a['slug']}").json()["titre"].startswith("Été")
    assert client.get("/api/blog/categories").json() == ["Conseils"]

    b = client.post("/api/admin/blog", headers=h, json={"titre": "Été au Lac Rose : nos conseils !", "publie": True}).json()
    assert b["slug"] == "ete-au-lac-rose-nos-conseils-2"

    r = client.post(f"/api/admin/blog/{a['id']}/image", headers=h, files={"image": ("c.png", png(), "image/png")})
    assert r.json()["image"].startswith("/uploads/blog_")
    page = client.get("/api/blog", params={"par_page": 1}).json()
    assert page["total"] == 2 and page["pages"] == 2 and len(page["items"]) == 1
    assert client.get("/api/admin/stats", headers=h).json()["articles"] == 2
    assert client.post("/api/admin/blog", json={"titre": "x"}).status_code == 401


def test_evenements_video_et_dates():
    h = token()
    futur = client.post("/api/admin/evenements", headers=h, json={
        "titre": "Cap sur le Sine Saloum", "lieu": "Sine Saloum", "date_debut": "2099-11-14T08:00",
        "prix_adulte": 32900, "prix_enfant": 28900, "telephone": "77 103 41 49"}).json()
    client.post("/api/admin/evenements", headers=h, json={"titre": "Passé", "date_debut": "2020-01-01T08:00"})
    masque = client.post("/api/admin/evenements", headers=h, json={
        "titre": "Masqué", "date_debut": "2099-01-01T08:00", "actif": False}).json()
    # public : seulement les événements visibles et à venir
    assert [e["titre"] for e in client.get("/api/evenements").json()] == ["Cap sur le Sine Saloum"]
    assert len(client.get("/api/admin/evenements", headers=h).json()) == 3

    mp4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 2048
    r = client.post(f"/api/admin/evenements/{futur['id']}/video", headers=h, files={"video": ("v.mp4", mp4, "video/mp4")})
    assert r.status_code == 200 and r.json()["video"].endswith(".mp4")
    r = client.post(f"/api/admin/evenements/{futur['id']}/video", headers=h,
                    files={"video": ("v.mp4", b"<?php echo 1; ?>", "video/mp4")})
    assert r.status_code == 400
    assert client.delete(f"/api/admin/evenements/{futur['id']}/video", headers=h).json()["video"] is None
    assert client.post("/api/admin/evenements", json={"titre": "x", "date_debut": "2099-01-01T08:00"}).status_code == 401
    assert client.delete(f"/api/admin/evenements/{masque['id']}", headers=h).status_code == 200


def test_limites_anti_abus_et_entetes():
    from app.security import contact_limiter, login_limiter

    login_limiter.clear()
    for _ in range(5):
        assert client.post("/api/admin/login", json={"username": "guide", "password": "faux"}).status_code == 401
    r = client.post("/api/admin/login", json={"username": "guide", "password": "motdepasse123"})
    assert r.status_code == 429 and "Retry-After" in r.headers
    login_limiter.clear()
    assert client.post("/api/admin/login", json={"username": "guide", "password": "motdepasse123"}).status_code == 200

    contact_limiter.clear()
    msg = {"nom": "Awa", "email": "awa@example.com", "message": "Bonjour"}
    for _ in range(5):
        assert client.post("/api/contact", json=msg).status_code == 200
    assert client.post("/api/contact", json=msg).status_code == 429
    contact_limiter.clear()

    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff" and r.headers["X-Frame-Options"] == "DENY"


def test_avis_moderation():
    from app.security import avis_limiter

    avis_limiter.clear()
    h = token()
    r = client.post("/api/avis", json={"nom": "Awa", "texte": "Sortie magnifique, merci !", "note": 5})
    assert r.status_code == 200
    client.post("/api/avis", json={"nom": "Bot", "texte": "spam spam spam", "website": "x"})
    assert client.post("/api/avis", json={"nom": "A", "texte": "court"}).status_code == 422
    # en attente : invisible publiquement, visible dans l'admin
    assert client.get("/api/avis").json() == []
    attente = client.get("/api/admin/avis", headers=h).json()
    assert [a["nom"] for a in attente] == ["Awa"] and attente[0]["actif"] is False
    assert client.get("/api/admin/stats", headers=h).json()["avis_attente"] == 1
    a = attente[0]
    client.put(f"/api/admin/avis/{a['id']}", headers=h, json={**a, "actif": True})
    assert [x["nom"] for x in client.get("/api/avis").json()] == ["Awa"]
    assert client.get("/api/admin/avis").status_code == 401
    avis_limiter.clear()


def test_statistiques_anonymes():
    from app.security import track_limiter

    track_limiter.clear()
    h = token()
    for _ in range(3):
        assert client.post("/api/track", json={"type": "visite"}).status_code == 204
    client.post("/api/track", json={"type": "whatsapp", "cible": "Cap sur le Sine Saloum"})
    client.post("/api/track", json={"type": "whatsapp", "cible": "Cap sur le Sine Saloum"})
    client.post("/api/track", json={"type": "whatsapp", "cible": "Bouton flottant"})
    assert client.post("/api/track", json={"type": "pirate"}).status_code == 422
    s = client.get("/api/admin/statistiques", headers=h, params={"jours": 7}).json()
    assert s["aujourdhui"] == 3 and s["totaux"]["visite"] == 3 and s["totaux"]["whatsapp"] == 3
    assert len(s["visites_par_jour"]) == 7 and s["visites_par_jour"][-1]["visites"] == 3
    assert s["whatsapp_par_cible"][0] == {"cible": "Cap sur le Sine Saloum", "total": 2}
    assert client.get("/api/admin/statistiques").status_code == 401


def test_apercu_partage_evenement():
    from datetime import datetime

    from app import seo

    h = token()
    ev = client.post("/api/admin/evenements", headers=h, json={
        "titre": "Cap sur le <Saloum>", "lieu": "Sine Saloum", "date_debut": "2099-11-14T08:00",
        "prix_adulte": 32900, "prix_enfant": 28900}).json()
    page = ('<title>x</title><meta name="description" content="d"><meta property="og:title" content="t">'
            '<meta property="og:description" content="d"><meta property="og:image" content="/i.jpg">'
            '<meta property="og:image:width" content="1200"><meta property="og:url" content="/">')

    class Req:
        base_url = "https://exemple.sn/"
        query_params = {"depart": str(ev["id"])}

    html = seo.rendre(page, seo.meta_pour(Req(), ""))
    assert "Cap sur le &lt;Saloum&gt;" in html and "<Saloum>" not in html  # texte échappé
    assert "32 900 FCFA" in html and "Enfant 28 900 FCFA" in html
    assert f'content="https://exemple.sn/?depart={ev["id"]}"' in html
    assert 'content="https://exemple.sn/images/og-image.jpg"' in html  # pas de photo : image par défaut
    assert "og:image:width" not in html
    assert seo.date_fr(datetime(2026, 11, 14)) == "samedi 14 novembre"


def test_sauvegarde_zip():
    import zipfile
    from io import BytesIO

    h = token()
    r = client.get("/api/admin/sauvegarde", headers=h)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    noms = zipfile.ZipFile(BytesIO(r.content)).namelist()
    assert "aventurier.db" in noms and "RESTAURER.txt" in noms
    assert client.get("/api/admin/sauvegarde").status_code == 401


def test_carrousel_accueil():
    h = token()
    s1 = client.post("/api/admin/slides", headers=h, json={"titre": "Cap sur le", "accent": "Sine Saloum"}).json()
    s2 = client.post("/api/admin/slides", headers=h, json={"titre": "Lac Rose"}).json()
    assert s2["ordre"] == s1["ordre"] + 1  # ajoutée à la fin
    # sans photo/vidéo, une diapo n'est pas affichée sur le site
    assert client.get("/api/slides").json() == []
    r = client.post(f"/api/admin/slides/{s1['id']}/media", headers=h, files={"media": ("p.png", png(), "image/png")})
    assert r.json()["media_type"] == "image" and r.json()["media"].startswith("/uploads/slide_")
    mp4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 1024
    r = client.post(f"/api/admin/slides/{s2['id']}/media", headers=h, files={"media": ("v.mp4", mp4, "video/mp4")})
    assert r.json()["media_type"] == "video"
    assert [s["titre"] for s in client.get("/api/slides").json()] == ["Cap sur le", "Lac Rose"]
    # réordonner puis masquer
    client.put(f"/api/admin/slides/{s2['id']}", headers=h, json={"titre": "Lac Rose", "ordre": 0})
    assert client.get("/api/slides").json()[0]["titre"] == "Lac Rose"
    client.put(f"/api/admin/slides/{s1['id']}", headers=h, json={"titre": "Cap sur le", "ordre": 5, "actif": False})
    assert [s["titre"] for s in client.get("/api/slides").json()] == ["Lac Rose"]
    assert client.post("/api/admin/slides", json={"titre": "x"}).status_code == 401
    assert client.delete(f"/api/admin/slides/{s2['id']}", headers=h).status_code == 200


MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 1024


def test_videos_galerie_hotel_apropos():
    h = token()
    # galerie : une vidéo est reconnue comme telle
    v = client.post("/api/admin/galerie", headers=h, files={"image": ("v.mp4", MP4, "video/mp4")}).json()
    assert v["media_type"] == "video" and v["image"].endswith(".mp4")
    p = client.post("/api/admin/galerie", headers=h, files={"image": ("p.png", png(), "image/png")}).json()
    assert p["media_type"] == "image"
    types = {x["id"]: x["media_type"] for x in client.get("/api/galerie").json()}
    assert types[v["id"]] == "video" and types[p["id"]] == "image"

    # hôtel : vidéo ajoutée puis retirée
    hotel = client.post("/api/admin/hotels", headers=h, json={"nom": "Lodge", "ville": "Saly"}).json()
    r = client.post(f"/api/admin/hotels/{hotel['id']}/video", headers=h, files={"video": ("v.mp4", MP4, "video/mp4")})
    assert r.json()["video"].startswith("/uploads/hotel_")
    assert any(x["video"] for x in client.get("/api/hotels").json())
    assert client.delete(f"/api/admin/hotels/{hotel['id']}/video", headers=h).json()["video"] is None

    # bloc « Qui sommes-nous »
    assert client.get("/api/reglages").json() == {"apropos_video": None}
    r = client.post("/api/admin/apropos/video", headers=h, files={"video": ("v.mp4", MP4, "video/mp4")})
    assert r.json()["apropos_video"].startswith("/uploads/apropos_")
    assert client.get("/api/reglages").json()["apropos_video"] == r.json()["apropos_video"]
    assert client.delete("/api/admin/apropos/video", headers=h).json() == {"apropos_video": None}
    assert client.post("/api/admin/apropos/video", files={"video": ("v.mp4", MP4, "video/mp4")}).status_code == 401


def test_migration_ancienne_base():
    import tempfile

    from sqlalchemy import create_engine, inspect, text

    from app.migrations import mettre_a_jour

    eng = create_engine(f"sqlite:///{tempfile.mkdtemp()}/vieille.db")
    with eng.begin() as c:  # tables telles qu'elles étaient avant les vidéos
        c.execute(text("CREATE TABLE galerie (id INTEGER PRIMARY KEY, image VARCHAR(255))"))
        c.execute(text("CREATE TABLE hotels (id INTEGER PRIMARY KEY, nom VARCHAR(150))"))
        c.execute(text("INSERT INTO galerie (image) VALUES ('/uploads/a.jpg')"))
    mettre_a_jour(eng)
    mettre_a_jour(eng)  # sans effet la 2e fois
    assert "video" in {c["name"] for c in inspect(eng).get_columns("hotels")}
    with eng.connect() as c:
        assert c.execute(text("SELECT media_type FROM galerie")).scalar() == "image"


def test_article_illustrations_et_videos_sociales():
    import os

    from app.config import settings

    h = token()
    a = client.post("/api/admin/blog", headers=h, json={
        "titre": "Sortie au Saloum", "publie": True,
        "embeds": ["https://www.tiktok.com/@aventurierblvck/video/7301234567890123456?is_from_webapp=1",
                   "https://www.instagram.com/reel/C1a2B3c4D5e/?utm_source=ig_web_copy_link"]}).json()
    assert [e["plateforme"] for e in a["embeds"]] == ["tiktok", "instagram"]
    assert a["embeds"][0] == {"plateforme": "tiktok", "id": "7301234567890123456",
                              "url": "https://www.tiktok.com/@aventurierblvck/video/7301234567890123456"}
    assert a["embeds"][1]["id"] == "reel/C1a2B3c4D5e"

    r = client.put(f"/api/admin/blog/{a['id']}", headers=h, json={"titre": "Sortie au Saloum", "embeds": ["https://youtube.com/x"]})
    assert r.status_code == 422 and "non reconnu" in r.json()["detail"]

    r = client.post(f"/api/admin/blog/{a['id']}/medias", headers=h, files={"media": ("p.png", png(), "image/png")})
    r = client.post(f"/api/admin/blog/{a['id']}/medias", headers=h, files={"media": ("v.mp4", MP4, "video/mp4")})
    medias = r.json()["medias"]
    assert [m["media_type"] for m in medias] == ["image", "video"]
    pub = client.get(f"/api/blog/{a['slug']}").json()
    assert len(pub["medias"]) == 2 and len(pub["embeds"]) == 2

    r = client.delete(f"/api/admin/blog/{a['id']}/medias/{medias[0]['id']}", headers=h)
    assert [m["media_type"] for m in r.json()["medias"]] == ["video"]
    video = settings.upload_dir / medias[1]["fichier"].split("/")[-1]
    assert video.exists()
    client.delete(f"/api/admin/blog/{a['id']}", headers=h)
    assert not video.exists()  # fichiers supprimés avec l'article
    assert client.post(f"/api/admin/blog/{a['id']}/medias", files={"media": ("p.png", png(), "image/png")}).status_code == 401
