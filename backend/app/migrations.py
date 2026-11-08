"""Mises à jour automatiques de la base au démarrage.

`create_all` crée les nouvelles tables mais n'ajoute pas les nouvelles colonnes aux tables
existantes : on les ajoute ici, sans toucher aux données.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# (table, colonne, définition SQL)
COLONNES = [
    ("galerie", "media_type", "VARCHAR(10) NOT NULL DEFAULT 'image'"),
    ("hotels", "video", "VARCHAR(255)"),
]


def mettre_a_jour(engine: Engine) -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, colonne, definition in COLONNES:
            if table in tables and colonne not in {c["name"] for c in insp.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {colonne} {definition}"))
