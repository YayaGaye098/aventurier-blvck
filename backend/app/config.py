from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Configuration lue depuis les variables d'environnement ou le fichier .env."""

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # SQLite par défaut. Pour MySQL : mysql+pymysql://user:pass@localhost/aventurier_blvck
    # Pour PostgreSQL : postgresql+psycopg://user:pass@localhost/aventurier_blvck
    database_url: str = f"sqlite:///{BASE_DIR / 'aventurier.db'}"

    # "production" : refuse la clé secrète par défaut et masque la documentation /docs de l'API.
    environment: str = "development"

    # À CHANGER en production (ex. : python -c "import secrets; print(secrets.token_hex(32))")
    secret_key: str = "change-moi-en-production-avec-une-longue-chaine-aleatoire"
    token_expire_minutes: int = 60 * 8

    upload_dir: Path = BASE_DIR / "uploads"
    max_upload_mb: int = 20   # photos (redimensionnées et compressées à l'envoi)
    max_video_mb: int = 200

    # Adresse publique du site, utilisée pour les aperçus de liens (ex. https://aventurierblvck.onrender.com).
    # Vide : déduite automatiquement de la requête.
    site_url: str = ""

    # Notification WhatsApp (CallMeBot) à chaque nouveau message / avis. Voir app/notify.py.
    whatsapp_notify_phone: str = ""
    callmebot_apikey: str = ""

    # Origines autorisées pour le frontend Angular (séparées par des virgules)
    cors_origins: str = "http://localhost:4200"


settings = Settings()

DEFAULT_SECRET = "change-moi-en-production-avec-une-longue-chaine-aleatoire"
IS_PROD = settings.environment.lower() in ("production", "prod")
if IS_PROD and (settings.secret_key == DEFAULT_SECRET or len(settings.secret_key) < 32):
    raise RuntimeError(
        "SECRET_KEY manquante ou trop courte. Générez-en une avec : "
        "python -c 'import secrets; print(secrets.token_hex(32))' "
        "puis mettez-la dans backend/.env (SECRET_KEY=...)."
    )

settings.upload_dir.mkdir(parents=True, exist_ok=True)
