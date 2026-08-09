"""Tests for new 'destinations' profile field and ?destination= discover filter.

Uses FRESH test users (different user_id/session_token per test) so prior swipes
do not exclude seed users from the discover deck.
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from conftest import BASE_URL, MONGO_URL, DB_NAME, auth_headers


# -------- helpers --------
async def _create_fresh_user():
    """Insert a fresh user and session into Mongo; return (user_id, token)."""
    suffix = uuid.uuid4().hex[:10]
    user_id = f"test_dest_{suffix}"
    token = f"TEST_DEST_TOKEN_{suffix}"
    email = f"dest_{suffix}@travelbuddy.local"
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=1)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "email": email,
            "name": f"DestTester-{suffix}",
            "picture": None,
            "profile_complete": False,
            "created_at": now,
        }},
        upsert=True,
    )
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token,
            "user_id": user_id,
            "expires_at": expires,
            "created_at": now,
        }},
        upsert=True,
    )
    # Make sure no prior swipes leak in
    await db.swipes.delete_many({"swiper_id": user_id})
    client.close()
    return user_id, token


@pytest.fixture
def fresh_user(event_loop):
    """Yield a freshly seeded (user_id, token) and clean up after the test."""
    user_id, token = event_loop.run_until_complete(_create_fresh_user())
    yield user_id, token

    async def _cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.users.delete_one({"user_id": user_id})
        await db.user_sessions.delete_one({"session_token": token})
        await db.swipes.delete_many({"swiper_id": user_id})
        client.close()

    event_loop.run_until_complete(_cleanup())


# -------- Profile: destinations save & retrieve --------
class TestProfileDestinations:
    def test_post_profile_saves_destinations_and_returns_them(self, api, fresh_user):
        user_id, token = fresh_user
        payload = {
            "age": 30,
            "gender": "female",
            "bio": "Wanderer",
            "location": "Madrid",
            "interests": ["Travel"],
            "modes": ["trips", "events"],
            "photos": [],
            "destinations": ["Tokyo", "Paris", "Lisbon"],
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["profile_complete"] is True
        assert "destinations" in data, (
            f"Response missing 'destinations' field. Keys returned: {list(data.keys())}"
        )
        assert data["destinations"] == payload["destinations"]
        assert "_id" not in data

    def test_get_profile_me_returns_destinations(self, api, fresh_user):
        user_id, token = fresh_user
        payload = {
            "age": 25,
            "gender": "male",
            "bio": "Test",
            "location": "Berlin",
            "interests": [],
            "modes": ["trips"],
            "photos": [],
            "destinations": ["Bali", "Phuket"],
        }
        rp = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(token))
        assert rp.status_code == 200, rp.text

        r = api.get(f"{BASE_URL}/api/profile/me", headers=auth_headers(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "destinations" in data, (
            f"GET /api/profile/me missing 'destinations'. Keys: {list(data.keys())}"
        )
        assert data["destinations"] == ["Bali", "Phuket"]


# -------- Discover: destinations field present + filter --------
class TestDiscoverDestinations:
    def test_discover_trips_includes_destinations_field(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(f"{BASE_URL}/api/discover?mode=trips", headers=auth_headers(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) > 0, "Expected seed users with 'trips' mode"
        for u in data:
            assert "trips" in u["modes"]
            assert "destinations" in u, (
                f"Discover result for {u['user_id']} missing 'destinations'. Keys: {list(u.keys())}"
            )
            assert isinstance(u["destinations"], list)

    def test_discover_trips_destination_tokyo_returns_leo_only(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(
            f"{BASE_URL}/api/discover?mode=trips&destination=Tokyo",
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        ids = [u["user_id"] for u in data]
        assert "seed_user_02" in ids, f"Leo (seed_user_02) should match Tokyo: got {ids}"
        for u in data:
            assert "trips" in u["modes"]
            # destinations should contain a Tokyo-substring match (case-insensitive)
            dests = [d.lower() for d in u.get("destinations", [])]
            assert any("tokyo" in d for d in dests), (
                f"User {u['user_id']} returned but no destination contains 'tokyo': {u.get('destinations')}"
            )

    def test_discover_destination_lowercase_case_insensitive(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(
            f"{BASE_URL}/api/discover?mode=trips&destination=tokyo",
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        ids = [u["user_id"] for u in r.json()]
        assert "seed_user_02" in ids, f"case-insensitive match failed: {ids}"

    def test_discover_events_destination_coachella_returns_only_ava(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(
            f"{BASE_URL}/api/discover?mode=events&destination=Coachella",
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        ids = [u["user_id"] for u in data]
        assert ids == ["seed_user_01"], (
            f"Expected ONLY Ava (seed_user_01) for events+Coachella, got {ids}"
        )
        assert "events" in data[0]["modes"]
        assert any("coachella" in d.lower() for d in data[0].get("destinations", []))

    def test_discover_destination_no_match_returns_empty(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(
            f"{BASE_URL}/api/discover?mode=trips&destination=NotARealPlace",
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_discover_gender_and_age_filters(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(
            f"{BASE_URL}/api/discover?mode=trips&genders=female&min_age=24&max_age=26",
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        for u in r.json():
            assert u["gender"] == "female"
            assert 24 <= u["age"] <= 26

    def test_discover_location_filter(self, api, fresh_user):
        _, token = fresh_user
        r = api.get(
            f"{BASE_URL}/api/discover?mode=trips&location=Berlin",
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        assert len(r.json()) >= 1
        for u in r.json():
            assert "berlin" in u["location"].lower()
