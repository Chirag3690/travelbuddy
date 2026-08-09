import os
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://journey-squad-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_TOKEN = "TEST_TOKEN_123"
TEST_USER_ID = "test_user_abc"
TEST_EMAIL = "tester@travelbuddy.local"

# Second test user (for mutual-like / chat membership tests)
TEST_TOKEN_2 = "TEST_TOKEN_456"
TEST_USER_ID_2 = "test_user_xyz"
TEST_EMAIL_2 = "tester2@travelbuddy.local"

# Third test user (non-member for chat 403)
TEST_TOKEN_3 = "TEST_TOKEN_789"
TEST_USER_ID_3 = "test_user_out"
TEST_EMAIL_3 = "outsider@travelbuddy.local"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _seed_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=7)

    users = [
        (TEST_USER_ID, TEST_EMAIL, "Tester"),
        (TEST_USER_ID_2, TEST_EMAIL_2, "Tester Two"),
        (TEST_USER_ID_3, TEST_EMAIL_3, "Outsider"),
    ]
    for uid, email, name in users:
        await db.users.update_one(
            {"user_id": uid},
            {"$set": {
                "user_id": uid,
                "email": email,
                "name": name,
                "picture": None,
                "profile_complete": False,
                "created_at": now,
            }},
            upsert=True,
        )

    sessions = [
        (TEST_TOKEN, TEST_USER_ID),
        (TEST_TOKEN_2, TEST_USER_ID_2),
        (TEST_TOKEN_3, TEST_USER_ID_3),
    ]
    for token, uid in sessions:
        await db.user_sessions.update_one(
            {"session_token": token},
            {"$set": {
                "session_token": token,
                "user_id": uid,
                "expires_at": expires,
                "created_at": now,
            }},
            upsert=True,
        )

    # Clean swipes/matches/messages for these test users to give a fresh state
    test_ids = [TEST_USER_ID, TEST_USER_ID_2, TEST_USER_ID_3]
    await db.swipes.delete_many({"$or": [
        {"swiper_id": {"$in": test_ids}},
        {"target_user_id": {"$in": test_ids}},
    ]})
    await db.matches.delete_many({"$or": [
        {"user_a": {"$in": test_ids}},
        {"user_b": {"$in": test_ids}},
    ]})
    # delete messages for matches we just removed (best effort)
    await db.messages.delete_many({})

    client.close()


@pytest.fixture(scope="session", autouse=True)
def seed_db():
    asyncio.get_event_loop().run_until_complete(_seed_db())
    yield


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def auth_headers(token=TEST_TOKEN):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def insert_reverse_like(other_user_id: str, self_user_id: str, mode: str):
    """Insert a swipe from other_user -> self_user with direction=like so that next 'like' creates a match."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.swipes.update_one(
        {"swiper_id": other_user_id, "target_user_id": self_user_id, "mode": mode},
        {"$set": {
            "swiper_id": other_user_id,
            "target_user_id": self_user_id,
            "direction": "like",
            "mode": mode,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    client.close()
