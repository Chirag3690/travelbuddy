"""Iteration 4 tests:
1) GET /api/discover returns shared_destinations (intersection with OTHER user's casing).
2) POST /api/swipes on match returns shared_destinations + other_name + mode.
3) POST /api/swipes on no-match returns matched:false (shared_destinations empty/absent).
4) GET /api/matches includes shared_destinations per match.
5) WebSocket /api/ws/chats/{match_id}:
   - invalid token -> 4401
   - non-member token -> 4403
   - valid -> broadcast to all connected members + persist in db.messages
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

import pytest
import requests
import websockets
from motor.motor_asyncio import AsyncIOMotorClient

from conftest import BASE_URL, MONGO_URL, DB_NAME, auth_headers


def _ws_base() -> str:
    p = urlparse(BASE_URL)
    scheme = "wss" if p.scheme == "https" else "ws"
    return f"{scheme}://{p.netloc}"


# ---------- DB helpers ----------
async def _mk_user(destinations, modes=None, name=None):
    suffix = uuid.uuid4().hex[:10]
    user_id = f"test_user_i4_{suffix}"
    token = f"TEST_I4_TOKEN_{suffix}"
    email = f"i4_{suffix}@travelbuddy.local"
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=1)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.users.delete_one({"user_id": user_id})
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": name or f"I4-{suffix}",
        "picture": None,
        "profile_complete": True,
        "age": 25,
        "gender": "female",
        "bio": "i4",
        "location": "X",
        "interests": [],
        "modes": modes or ["trips"],
        "photos": [],
        "destinations": destinations,
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
    client.close()
    return user_id, token


async def _cleanup_user(user_id, token):
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


async def _insert_reverse_like(other_uid, self_uid, mode):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.swipes.update_one(
        {"swiper_id": other_uid, "target_user_id": self_uid, "mode": mode},
        {"$set": {
            "swiper_id": other_uid,
            "target_user_id": self_uid,
            "direction": "like",
            "mode": mode,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    client.close()


async def _count_messages(match_id):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    c = await db.messages.count_documents({"match_id": match_id})
    client.close()
    return c


@pytest.fixture
def i4_user(event_loop):
    """Fresh user with destinations=['Tokyo'], modes=['trips']."""
    uid, tok = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips", "events"]))
    yield uid, tok
    event_loop.run_until_complete(_cleanup_user(uid, tok))


# ---------- 1) /api/discover shared_destinations ----------
class TestDiscoverSharedDestinations:
    def test_discover_returns_shared_destinations_with_other_casing(self, api, i4_user):
        uid, tok = i4_user
        r = api.get(f"{BASE_URL}/api/discover?mode=trips", headers=auth_headers(tok))
        assert r.status_code == 200, r.text
        profiles = r.json()
        # All profiles must have shared_destinations key (list)
        for p in profiles:
            assert "shared_destinations" in p, f"missing shared_destinations: {p}"
            assert isinstance(p["shared_destinations"], list)

        # Leo (seed_user_02) has Tokyo in trips mode → must surface with shared=['Tokyo']
        leo = next((p for p in profiles if p.get("user_id") == "seed_user_02"), None)
        assert leo is not None, "Leo (seed_user_02) not surfaced in discover trips"
        assert "Tokyo" in leo["shared_destinations"], (
            f"Leo shared_destinations missing Tokyo: {leo['shared_destinations']}"
        )

    def test_discover_other_user_casing_preserved(self, event_loop, api):
        """Viewer has destinations=['tokyo'] (lowercase). Other has 'Tokyo'.
        shared_destinations should keep OTHER's casing ('Tokyo')."""
        uid, tok = event_loop.run_until_complete(
            _mk_user(["tokyo"], modes=["trips"])
        )
        try:
            r = api.get(f"{BASE_URL}/api/discover?mode=trips", headers=auth_headers(tok))
            assert r.status_code == 200, r.text
            profiles = r.json()
            leo = next((p for p in profiles if p.get("user_id") == "seed_user_02"), None)
            assert leo is not None
            # Leo's own casing is 'Tokyo' — must NOT be lowercased to viewer's 'tokyo'
            assert "Tokyo" in leo["shared_destinations"], (
                f"Expected OTHER user's casing 'Tokyo', got {leo['shared_destinations']}"
            )
            assert "tokyo" not in leo["shared_destinations"]
        finally:
            event_loop.run_until_complete(_cleanup_user(uid, tok))

    def test_discover_no_shared_destinations_when_no_overlap(self, event_loop, api):
        uid, tok = event_loop.run_until_complete(
            _mk_user(["SomePlaceNoSeedHas-xyz"], modes=["trips"])
        )
        try:
            r = api.get(f"{BASE_URL}/api/discover?mode=trips", headers=auth_headers(tok))
            assert r.status_code == 200
            profiles = r.json()
            for p in profiles:
                assert p["shared_destinations"] == [], (
                    f"Expected empty shared_destinations for non-overlapping viewer, got {p['shared_destinations']} on {p.get('user_id')}"
                )
        finally:
            event_loop.run_until_complete(_cleanup_user(uid, tok))


# ---------- 2/3) /api/swipes shared_destinations ----------
class TestSwipesSharedDestinations:
    def test_swipe_match_returns_shared_destinations_other_name_mode(self, event_loop, api):
        # Viewer has Tokyo+Kyoto, Leo (seed_user_02) has Tokyo,Kyoto,Osaka.
        uid, tok = event_loop.run_until_complete(
            _mk_user(["Tokyo", "Kyoto"], modes=["trips"])
        )
        try:
            # Seed reverse like so 'like' creates a match
            event_loop.run_until_complete(
                _insert_reverse_like("seed_user_02", uid, "trips")
            )
            r = api.post(
                f"{BASE_URL}/api/swipes",
                json={"target_user_id": "seed_user_02", "direction": "like", "mode": "trips"},
                headers=auth_headers(tok),
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["matched"] is True, d
            assert isinstance(d["match_id"], str) and d["match_id"].startswith("match_")
            assert d.get("other_name") == "Leo"
            assert d.get("mode") == "trips"
            assert isinstance(d.get("shared_destinations"), list)
            shared = set(d["shared_destinations"])
            assert {"Tokyo", "Kyoto"}.issubset(shared), f"Expected Tokyo+Kyoto in shared, got {shared}"
            # Osaka is Leo-only → must NOT be in shared
            assert "Osaka" not in shared
        finally:
            event_loop.run_until_complete(_cleanup_user(uid, tok))

    def test_swipe_no_match_returns_empty_shared(self, event_loop, api):
        uid, tok = event_loop.run_until_complete(
            _mk_user(["Tokyo"], modes=["trips"])
        )
        try:
            # No reverse-like → no match
            r = api.post(
                f"{BASE_URL}/api/swipes",
                json={"target_user_id": "seed_user_02", "direction": "like", "mode": "trips"},
                headers=auth_headers(tok),
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["matched"] is False, d
            assert d.get("match_id") is None
            # Per response_model, shared_destinations defaults to [] (may be empty list)
            assert d.get("shared_destinations", []) == []
        finally:
            event_loop.run_until_complete(_cleanup_user(uid, tok))


# ---------- 4) /api/matches shared_destinations ----------
class TestMatchesSharedDestinations:
    def test_matches_list_includes_shared_destinations(self, event_loop, api):
        uid, tok = event_loop.run_until_complete(
            _mk_user(["Tokyo", "Osaka"], modes=["trips"])
        )
        try:
            event_loop.run_until_complete(
                _insert_reverse_like("seed_user_02", uid, "trips")
            )
            r = api.post(
                f"{BASE_URL}/api/swipes",
                json={"target_user_id": "seed_user_02", "direction": "like", "mode": "trips"},
                headers=auth_headers(tok),
            )
            assert r.status_code == 200
            match_id = r.json()["match_id"]

            mr = api.get(f"{BASE_URL}/api/matches", headers=auth_headers(tok))
            assert mr.status_code == 200, mr.text
            matches = mr.json()
            m = next((x for x in matches if x["match_id"] == match_id), None)
            assert m is not None
            assert "shared_destinations" in m, m
            shared = set(m["shared_destinations"])
            assert {"Tokyo", "Osaka"}.issubset(shared), f"Expected Tokyo+Osaka, got {shared}"
            assert "Kyoto" not in shared  # viewer doesn't have Kyoto
        finally:
            event_loop.run_until_complete(_cleanup_user(uid, tok))


# ---------- 5) WebSocket /api/ws/chats/{match_id} ----------
def _ws_url(match_id, token):
    return f"{_ws_base()}/api/ws/chats/{match_id}?token={token}"


class TestWebSocketChat:
    def test_ws_invalid_token_rejects_4401(self, event_loop):
        # Need a real match_id for path; but token is bogus → should close 4401
        # Create a match between two test users
        uid_a, tok_a = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        uid_b, tok_b = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        try:
            # Create match directly in DB
            async def _setup_match():
                client = AsyncIOMotorClient(MONGO_URL)
                db = client[DB_NAME]
                pair = sorted([uid_a, uid_b])
                mid = f"match_{uuid.uuid4().hex[:12]}"
                await db.matches.insert_one({
                    "match_id": mid,
                    "match_key": f"{pair[0]}::{pair[1]}::trips",
                    "user_a": pair[0],
                    "user_b": pair[1],
                    "mode": "trips",
                    "created_at": datetime.now(timezone.utc),
                })
                client.close()
                return mid
            match_id = event_loop.run_until_complete(_setup_match())

            async def _try():
                url = _ws_url(match_id, "BOGUS_TOKEN_XYZ")
                try:
                    async with websockets.connect(url) as ws:
                        await ws.recv()
                        return None
                except websockets.exceptions.InvalidStatus as e:
                    return ("http", e.response.status_code)
                except websockets.exceptions.ConnectionClosed as e:
                    return ("close", e.code)
                except Exception as e:
                    return ("err", str(e))

            result = event_loop.run_until_complete(_try())
            assert result is not None, "Expected connection to be rejected"
            kind, code = result
            assert kind == "close" and code == 4401, f"Expected close 4401, got {result}"
        finally:
            event_loop.run_until_complete(_cleanup_user(uid_a, tok_a))
            event_loop.run_until_complete(_cleanup_user(uid_b, tok_b))

    def test_ws_non_member_rejects_4403(self, event_loop):
        uid_a, tok_a = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        uid_b, tok_b = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        uid_c, tok_c = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        try:
            async def _setup_match():
                client = AsyncIOMotorClient(MONGO_URL)
                db = client[DB_NAME]
                pair = sorted([uid_a, uid_b])
                mid = f"match_{uuid.uuid4().hex[:12]}"
                await db.matches.insert_one({
                    "match_id": mid,
                    "match_key": f"{pair[0]}::{pair[1]}::trips",
                    "user_a": pair[0],
                    "user_b": pair[1],
                    "mode": "trips",
                    "created_at": datetime.now(timezone.utc),
                })
                client.close()
                return mid
            match_id = event_loop.run_until_complete(_setup_match())

            async def _try():
                url = _ws_url(match_id, tok_c)
                try:
                    async with websockets.connect(url) as ws:
                        await ws.recv()
                        return None
                except websockets.exceptions.ConnectionClosed as e:
                    return e.code
                except Exception as e:
                    return f"err:{e}"

            code = event_loop.run_until_complete(_try())
            assert code == 4403, f"Expected close 4403 for non-member, got {code}"
        finally:
            event_loop.run_until_complete(_cleanup_user(uid_a, tok_a))
            event_loop.run_until_complete(_cleanup_user(uid_b, tok_b))
            event_loop.run_until_complete(_cleanup_user(uid_c, tok_c))

    def test_ws_broadcast_persists_and_delivers_to_both_members(self, event_loop):
        uid_a, tok_a = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        uid_b, tok_b = event_loop.run_until_complete(_mk_user(["Tokyo"], modes=["trips"]))
        try:
            async def _setup_match():
                client = AsyncIOMotorClient(MONGO_URL)
                db = client[DB_NAME]
                pair = sorted([uid_a, uid_b])
                mid = f"match_{uuid.uuid4().hex[:12]}"
                await db.matches.insert_one({
                    "match_id": mid,
                    "match_key": f"{pair[0]}::{pair[1]}::trips",
                    "user_a": pair[0],
                    "user_b": pair[1],
                    "mode": "trips",
                    "created_at": datetime.now(timezone.utc),
                })
                client.close()
                return mid
            match_id = event_loop.run_until_complete(_setup_match())

            async def _flow():
                url_a = _ws_url(match_id, tok_a)
                url_b = _ws_url(match_id, tok_b)
                async with websockets.connect(url_a) as ws_a, websockets.connect(url_b) as ws_b:
                    # Give the server a tick to join rooms
                    await asyncio.sleep(0.3)
                    await ws_a.send(json.dumps({"text": "hello from A"}))
                    # Both should receive the broadcast
                    msg_a = await asyncio.wait_for(ws_a.recv(), timeout=5)
                    msg_b = await asyncio.wait_for(ws_b.recv(), timeout=5)
                    return json.loads(msg_a), json.loads(msg_b)

            payload_a, payload_b = event_loop.run_until_complete(_flow())
            for p in (payload_a, payload_b):
                assert p.get("type") == "message", p
                data = p.get("data", {})
                assert data.get("text") == "hello from A"
                assert data.get("sender_id") == uid_a
                assert data.get("match_id") == match_id
                assert isinstance(data.get("id"), str) and data["id"].startswith("msg_")
                assert "created_at" in data

            # Verify persisted
            cnt = event_loop.run_until_complete(_count_messages(match_id))
            assert cnt == 1, f"Expected 1 persisted message, got {cnt}"
        finally:
            event_loop.run_until_complete(_cleanup_user(uid_a, tok_a))
            event_loop.run_until_complete(_cleanup_user(uid_b, tok_b))
