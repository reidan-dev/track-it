#!/usr/bin/env python
"""Seed the initial user. Run once: python scripts/seed_user.py --email you@example.com --password secret"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.user import User, UserSettings
from app.auth import hash_password


def seed(email: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User {email} already exists (id={existing.id})")
            return
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id))
        db.commit()
        print(f"Created user {email} (id={user.id})")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    seed(args.email, args.password)
