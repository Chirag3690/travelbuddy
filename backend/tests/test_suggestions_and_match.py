"""Iteration 3 tests:
1) GET /api/suggestions (static + user-dynamic, prefix-first, case-insensitive, empty=popular, no-match=[])
2) MATCH FLOW with auto-seeded likes on first profile completion.
"""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from conftest import BASE_URL, MONGO_URL, DB_NAME, auth_headers


# ---------- helpers ----------
async def _create_fresh_match_user():
    suffix = uuid.uuid4().hex[:10]
    user_id = f"test_user_match_{suffix}"
    token = f"TEST_MATCH_TOKEN_{suffix}"
    email = f"match_{suffix}@travelbuddy.local"
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=1)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    # Ensure absolutely fresh — delete any prior doc with this id (shouldn't exist)
    await db.users.delete_one({"user_id": user_id})
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": f"MatchTester-{suffix}",
        "picture": None,
        "profile_complete": False,
        "created_at": now,
    })
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
    await db.swipes.delete_many({"$or": [
        {"swiper_id": user_id},
        {"target_user_id": user_id},
    ]})
    await db.matches.delete_many({"$or": [
        {"user_a": user_id}, {"user_b": user_id},
    ]})
    client.close()
    return user_id, token


async def _cleanup_match_user(user_id, token):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_one({"session_token": token})
    await db.swipes.delete_many({"$or": [
        {"swiper_id": user_id},
        {"target_user_id": user_id},
    ]})
    await db.matches.delete_many({"$or": [
        {"user_a": user_id}, {"user_b": user_id},
    ]})
    client.close()


@pytest.fixture
def fresh_match_user(event_loop):
    user_id, token = event_loop.run_until_complete(_create_fresh_match_user())
    yield user_id, token
    event_loop.run_until_complete(_cleanup_match_user(user_id, token))


async def _get_swipes_targeting(user_id):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    docs = await db.swipes.find({"target_user_id": user_id}, {"_id": 0}).to_list(50)
    client.close()
    return docs


# ---------- /api/suggestions ----------
class TestSuggestions:
    def test_suggestions_tok_contains_tokyo_prefix_first(self, api):
        r = api.get(f"{BASE_URL}/api/suggestions?q=tok")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        # Case-insensitive Tokyo match should appear
        assert any(s.lower() == "tokyo" for s in data), f"Tokyo not in {data}"
        # Prefix-first: first item should start with 'tok' (case-insensitive)
        assert data[0].lower().startswith("tok"), f"First item not prefix match: {data}"

    def test_suggestions_coa_returns_coachella(self, api):
        r = api.get(f"{BASE_URL}/api/suggestions?q=coa")
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(s.lower() == "coachella" for s in data), f"Coachella not in {data}"

    def test_suggestions_empty_query_returns_popular_with_default_limit(self, api):
        r = api.get(f"{BASE_URL}/api/suggestions?q=")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 8, f"Expected default limit 8, got {len(data)}: {data}"
        # All entries unique
        assert len(set(s.lower() for s in data)) == len(data)

    def test_suggestions_no_match_returns_empty(self, api):
        r = api.get(f"{BASE_URL}/api/suggestions?q=cooooaaa")
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_suggestions_surfaces_user_added_destinations(self, api, event_loop):
        """Insert a user with an unusual destination, ensure it shows up in suggestions."""
        unique_dest = f"Zorblatt-{uuid.uuid4().hex[:6]}"
        uid = f"sugg_seed_{uuid.uuid4().hex[:8]}"
        async def _seed():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            await db.users.update_one(
                {"user_id": uid},
                {"$set": {
                    "user_id": uid,
                    "email": f"{uid}@x.local",
                    "name": "SuggSeed",
                    "destinations": [unique_dest],
                    "profile_complete": True,
                    "modes": ["trips"],
                    "created_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            client.close()
        async def _clean():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            await db.users.delete_one({"user_id": uid})
            client.close()

        event_loop.run_until_complete(_seed())
        try:
            # Lowercase query to confirm case-insensitive surfacing
            r = api.get(f"{BASE_URL}/api/suggestions?q={unique_dest[:6].lower()}")
            assert r.status_code == 200, r.text
            data = r.json()
            assert any(unique_dest.lower() in s.lower() for s in data), (
                f"User-added destination {unique_dest} not in suggestions: {data}"
            )
        finally:
            event_loop.run_until_complete(_clean())


# ---------- MATCH FLOW ----------
class TestMatchFlow:
    def test_first_profile_completion_seeds_3_likes(self, api, fresh_match_user, event_loop):
        user_id, token = fresh_match_user
        payload = {
            "age": 26, "gender": "female", "bio": "Auto-like seed test",
            "location": "NYC", "interests": ["Travel"],
            "modes": ["events"], "photos": [], "destinations": ["Tokyo"],
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(token))
        assert r.status_code == 200, r.text

        swipes = event_loop.run_until_complete(_get_swipes_targeting(user_id))
        assert len(swipes) == 3, f"Expected exactly 3 auto-seed likes, got {len(swipes)}: {swipes}"
        for s in swipes:
            assert s["direction"] == "like"
            assert s["mode"] == "events"
            assert s["swiper_id"].startswith("seed_user_")
            assert s["target_user_id"] == user_id
        # Distinct swipers
        swiper_ids = [s["swiper_id"] for s in swipes]
        assert len(set(swiper_ids)) == 3, f"Auto-seed swipers not distinct: {swiper_ids}"

    def test_like_back_creates_match_and_appears_in_matches(self, api, fresh_match_user, event_loop):
        user_id, token = fresh_match_user
        payload = {
            "age": 24, "gender": "male", "bio": "Match flow",
            "location": "LA", "interests": [],
            "modes": ["trips"], "photos": [], "destinations": [],
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(token))
        assert r.status_code == 200, r.text

        swipes = event_loop.run_until_complete(_get_swipes_targeting(user_id))
        assert len(swipes) == 3
        liker_id = swipes[0]["swiper_id"]
        liker_mode = swipes[0]["mode"]
        assert liker_mode == "trips"

        # Now user likes the liker back in same mode → should match
        sr = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": liker_id, "direction": "like", "mode": liker_mode},
            headers=auth_headers(token),
        )
        assert sr.status_code == 200, sr.text
        sdata = sr.json()
        assert sdata["matched"] is True, f"Expected match, got {sdata}"
        assert isinstance(sdata.get("match_id"), str) and sdata["match_id"].startswith("match_")
        match_id = sdata["match_id"]

        # Match should appear in GET /api/matches
        mr = api.get(f"{BASE_URL}/api/matches", headers=auth_headers(token))
        assert mr.status_code == 200, mr.text
        matches = mr.json()
        m = next((x for x in matches if x["match_id"] == match_id), None)
        assert m is not None, f"match_id {match_id} not in matches: {matches}"
        assert m["user_id"] == liker_id
        assert m["mode"] == liker_mode
        assert isinstance(m["name"], str) and len(m["name"]) > 0

    def test_like_unrelated_seed_returns_not_matched(self, api, fresh_match_user, event_loop):
        user_id, token = fresh_match_user
        payload = {
            "age": 22, "gender": "female", "bio": "No match",
            "location": "Paris", "interests": [],
            "modes": ["situationship"], "photos": [], "destinations": [],
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(token))
        assert r.status_code == 200, r.text

        swipes = event_loop.run_until_complete(_get_swipes_targeting(user_id))
        pre_liker_ids = {s["swiper_id"] for s in swipes}
        # Pick a seed user that did NOT pre-like this user
        all_seeds = {f"seed_user_0{i}" for i in range(1, 9)}
        non_liker = next(iter(all_seeds - pre_liker_ids))

        sr = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": non_liker, "direction": "like", "mode": "situationship"},
            headers=auth_headers(token),
        )
        assert sr.status_code == 200, sr.text
        sdata = sr.json()
        assert sdata["matched"] is False, f"Expected no match, got {sdata}"
        assert sdata.get("match_id") is None

    def test_like_in_different_mode_returns_not_matched(self, api, fresh_match_user, event_loop):
        user_id, token = fresh_match_user
        # User chose events as mode → auto-seed pre-likes will all be 'events'
        payload = {
            "age": 28, "gender": "non-binary", "bio": "Mode mismatch",
            "location": "Berlin", "interests": [],
            "modes": ["events"], "photos": [], "destinations": [],
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(token))
        assert r.status_code == 200, r.text

        swipes = event_loop.run_until_complete(_get_swipes_targeting(user_id))
        assert all(s["mode"] == "events" for s in swipes)
        liker_id = swipes[0]["swiper_id"]

        # User likes the same liker but in 'trips' (different) mode → must NOT match
        sr = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": liker_id, "direction": "like", "mode": "trips"},
            headers=auth_headers(token),
        )
        assert sr.status_code == 200, sr.text
        sdata = sr.json()
        assert sdata["matched"] is False, f"Mode mismatch must not match, got {sdata}"
        assert sdata.get("match_id") is None
