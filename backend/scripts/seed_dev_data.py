#!/usr/bin/env python3
"""Upsert dummy trips/events users and squads for local testing.

Usage (from backend/):
  python scripts/seed_dev_data.py
  python scripts/seed_dev_data.py --clear-swipes   # reset discover decks
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from seed_data import SEED_GROUPS, SEED_USERS, SEED_USER_REFRESH_FIELDS  # noqa: E402

load_dotenv(ROOT / ".env")


def _group_visibility(member_count: int, created_at: datetime) -> float:
    age_hours = max(0.0, (datetime.now(timezone.utc) - created_at).total_seconds() / 3600.0)
    return member_count * 10.0 + max(0.0, 72.0 - age_hours) * 0.5


async def upsert_seeds(db, *, clear_swipes: bool) -> None:
    if clear_swipes:
        r1 = await db.swipes.delete_many({})
        r2 = await db.group_swipes.delete_many({})
        print(f"Cleared {r1.deleted_count} user swipes, {r2.deleted_count} group swipes.")

    now = datetime.now(timezone.utc)
    for u in SEED_USERS:
        refresh = {k: u[k] for k in SEED_USER_REFRESH_FIELDS}
        await db.users.update_one(
            {"user_id": u["user_id"]},
            {
                "$setOnInsert": {"user_id": u["user_id"], "created_at": now},
                "$set": refresh,
            },
            upsert=True,
        )

    for g in SEED_GROUPS:
        created = now
        await db.groups.update_one(
            {"group_id": g["group_id"]},
            {
                "$set": {
                    **g,
                    "visibility_score": _group_visibility(len(g["member_ids"]), created),
                    "created_at": created,
                    "updated_at": now,
                },
            },
            upsert=True,
        )

    events_users = sum(1 for u in SEED_USERS if "events" in u["modes"])
    trips_users = sum(1 for u in SEED_USERS if "trips" in u["modes"])
    events_groups = sum(1 for g in SEED_GROUPS if g["mode"] == "events")
    trips_groups = sum(1 for g in SEED_GROUPS if g["mode"] == "trips")

    print(f"Seeded {len(SEED_USERS)} users ({events_users} with events, {trips_users} with trips).")
    print(f"Seeded {len(SEED_GROUPS)} squads ({events_groups} events, {trips_groups} trips).")
    print("Try discover: mode=events or mode=trips, search Sunburn Goa, NH7, Manali, Ladakh…")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Inject Vinle dummy trips/events data")
    parser.add_argument(
        "--clear-swipes",
        action="store_true",
        help="Delete all swipes so seed profiles reappear in discover",
    )
    args = parser.parse_args()

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("Set MONGO_URL and DB_NAME in backend/.env")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    try:
        await upsert_seeds(db, clear_swipes=args.clear_swipes)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
