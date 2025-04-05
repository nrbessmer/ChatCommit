# scripts/init_db.py
from app.database import Base, engine

if __name__ == "__main__":
    print("🔧 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created.")

