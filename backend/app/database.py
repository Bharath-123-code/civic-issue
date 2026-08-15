# backend/app/database.py
import sqlite3
import json
import datetime
from pathlib import Path
from contextlib import contextmanager
from backend.app.config import settings

@contextmanager
def get_db_connection():
    db_path = Path(settings.DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    db_path = Path(settings.DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                image_url TEXT,
                status TEXT NOT NULL DEFAULT 'Reported',
                ai_priority TEXT NOT NULL DEFAULT 'Medium',
                admin_notes TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        
        # Check if database is empty
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM reports")
        count = cursor.fetchone()[0]
        
        if count == 0:
            seed_file = Path("backend/data/seed_reports.json")
            if seed_file.exists():
                try:
                    with open(seed_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        for report in data:
                            conn.execute("""
                                INSERT INTO reports (
                                    title, description, category, latitude, longitude, image_url, status, ai_priority, admin_notes, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                report.get("title"),
                                report.get("description"),
                                report.get("category"),
                                report.get("latitude"),
                                report.get("longitude"),
                                report.get("image_url"),
                                report.get("status", "Reported"),
                                report.get("ai_priority", "Medium"),
                                report.get("admin_notes"),
                                report.get("created_at", datetime.datetime.utcnow().isoformat())
                            ))
                        conn.commit()
                        print(f"Preloaded {len(data)} reports from seed file.")
                except Exception as e:
                    print(f"Error loading seed reports: {e}")
