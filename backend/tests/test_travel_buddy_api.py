"""Travel Buddy backend API tests."""
import os
import pytest

from conftest import (
    BASE_URL,
    TEST_TOKEN,
    TEST_TOKEN_2,
    TEST_TOKEN_3,
    TEST_USER_ID,
    TEST_USER_ID_2,
    TEST_USER_ID_3,
    auth_headers,
    insert_reverse_like,
)


# -------- Health --------
class TestHealth:
    def test_root_returns_message(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data and isinstance(data["message"], str)
        assert "_id" not in data


# -------- Auth --------
class TestAuth:
    def test_bad_session_token_returns_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/session", json={"session_token": "not-a-real-token"})
        assert r.status_code == 401, r.text

    def test_me_without_auth_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401, r.text

    def test_me_with_synthetic_bearer_returns_user(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["email"] == "tester@travelbuddy.local"
        assert "_id" not in data


# -------- Profile --------
class TestProfile:
    profile_payload = {
        "age": 28,
        "gender": "non-binary",
        "bio": "Loves coffee and live music",
        "location": "San Francisco, CA",
        "interests": ["Music", "Coffee", "Hiking"],
        "modes": ["events", "trips"],
        "photos": ["https://example.com/p1.jpg"],
    }

    def test_post_profile_saves_data(self, api):
        r = api.post(f"{BASE_URL}/api/profile", json=self.profile_payload, headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["profile_complete"] is True
        assert data["age"] == self.profile_payload["age"]
        assert data["gender"] == self.profile_payload["gender"]
        assert data["bio"] == self.profile_payload["bio"]
        assert data["location"] == self.profile_payload["location"]
        assert data["interests"] == self.profile_payload["interests"]
        assert data["modes"] == self.profile_payload["modes"]
        assert data["photos"] == self.profile_payload["photos"]
        assert "_id" not in data

    def test_get_profile_me_returns_saved(self, api):
        r = api.get(f"{BASE_URL}/api/profile/me", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["profile_complete"] is True
        assert data["age"] == self.profile_payload["age"]
        assert data["modes"] == self.profile_payload["modes"]
        assert data.get("hide_from_discover") is False
        assert "_id" not in data

    def test_patch_profile_settings_hides_from_discover(self, api):
        r = api.patch(
            f"{BASE_URL}/api/profile/settings",
            json={"hide_from_discover": True},
            headers=auth_headers(TEST_TOKEN_2),
        )
        assert r.status_code == 200, r.text
        assert r.json()["hide_from_discover"] is True

        discover = api.get(
            f"{BASE_URL}/api/discover?mode=situationship",
            headers=auth_headers(TEST_TOKEN),
        )
        assert discover.status_code == 200, discover.text
        ids = [u["user_id"] for u in discover.json()]
        assert TEST_USER_ID_2 not in ids

        r2 = api.patch(
            f"{BASE_URL}/api/profile/settings",
            json={"hide_from_discover": False},
            headers=auth_headers(TEST_TOKEN_2),
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["hide_from_discover"] is False

    def test_profile_for_user2_situationship_mode(self, api):
        """Make test_user_2 have situationship mode for later mutual-like test."""
        payload = {
            "age": 27,
            "gender": "female",
            "bio": "Mountain person",
            "location": "Denver, CO",
            "interests": ["Skiing"],
            "modes": ["situationship", "trips", "events"],
            "photos": [],
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload, headers=auth_headers(TEST_TOKEN_2))
        assert r.status_code == 200, r.text
        assert r.json()["profile_complete"] is True


# -------- Discover --------
class TestDiscover:
    def test_discover_events_only_includes_events_modes(self, api):
        r = api.get(f"{BASE_URL}/api/discover?mode=events", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for u in data:
            assert "events" in u["modes"], f"User {u['user_id']} modes={u['modes']} missing 'events'"
            assert u["user_id"] != TEST_USER_ID, "self must be excluded"
            assert "_id" not in u

    def test_discover_trips_filter(self, api):
        r = api.get(f"{BASE_URL}/api/discover?mode=trips", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        for u in r.json():
            assert "trips" in u["modes"]

    def test_discover_situationship_filter(self, api):
        r = api.get(f"{BASE_URL}/api/discover?mode=situationship", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        for u in r.json():
            assert "situationship" in u["modes"]

    def test_discover_excludes_swiped(self, api):
        # Pass on seed_user_02 in 'events' mode
        sr = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": "seed_user_02", "direction": "pass", "mode": "events"},
            headers=auth_headers(TEST_TOKEN),
        )
        assert sr.status_code == 200, sr.text
        assert sr.json()["matched"] is False

        r = api.get(f"{BASE_URL}/api/discover?mode=events", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        ids = [u["user_id"] for u in r.json()]
        assert "seed_user_02" not in ids


# -------- Swipes --------
class TestSwipes:
    def test_pass_returns_not_matched(self, api):
        r = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": "seed_user_03", "direction": "pass", "mode": "events"},
            headers=auth_headers(TEST_TOKEN),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matched"] is False
        assert data.get("match_id") is None

    def test_swipe_self_returns_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": TEST_USER_ID, "direction": "like", "mode": "events"},
            headers=auth_headers(TEST_TOKEN),
        )
        assert r.status_code == 400, r.text

    def test_mutual_like_creates_match(self, api, event_loop):
        # Insert reverse like: test_user_2 likes test_user_1 in 'situationship' mode
        event_loop.run_until_complete(insert_reverse_like(TEST_USER_ID_2, TEST_USER_ID, "situationship"))
        # Now test_user_1 likes test_user_2 → should match
        r = api.post(
            f"{BASE_URL}/api/swipes",
            json={"target_user_id": TEST_USER_ID_2, "direction": "like", "mode": "situationship"},
            headers=auth_headers(TEST_TOKEN),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["matched"] is True
        assert isinstance(data.get("match_id"), str) and data["match_id"].startswith("match_")
        pytest.match_id = data["match_id"]  # stash on pytest module for later tests


# -------- Matches --------
class TestMatches:
    def test_list_matches_contains_other_user_and_mode(self, api):
        r = api.get(f"{BASE_URL}/api/matches", headers=auth_headers(TEST_TOKEN))
        assert r.status_code == 200, r.text
        matches = r.json()
        assert isinstance(matches, list) and len(matches) >= 1
        m = next((x for x in matches if x["match_id"] == getattr(pytest, "match_id", None)), None)
        assert m is not None, f"Expected match_id not in list: {matches}"
        assert m["user_id"] == TEST_USER_ID_2
        assert m["mode"] == "situationship"
        for x in matches:
            assert "_id" not in x


# -------- Chat --------
class TestChat:
    def test_post_message_as_member(self, api):
        match_id = getattr(pytest, "match_id", None)
        assert match_id, "match_id required from previous test"
        r = api.post(
            f"{BASE_URL}/api/chats/{match_id}/messages",
            json={"text": "Hello from user1"},
            headers=auth_headers(TEST_TOKEN),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["match_id"] == match_id
        assert data["sender_id"] == TEST_USER_ID
        assert data["text"] == "Hello from user1"
        assert "_id" not in data

    def test_get_messages_as_member(self, api):
        match_id = getattr(pytest, "match_id", None)
        r = api.get(
            f"{BASE_URL}/api/chats/{match_id}/messages",
            headers=auth_headers(TEST_TOKEN_2),
        )
        assert r.status_code == 200, r.text
        msgs = r.json()
        assert isinstance(msgs, list) and len(msgs) >= 1
        assert any(m["text"] == "Hello from user1" for m in msgs)
        for m in msgs:
            assert "_id" not in m

    def test_post_message_non_member_returns_403(self, api):
        match_id = getattr(pytest, "match_id", None)
        r = api.post(
            f"{BASE_URL}/api/chats/{match_id}/messages",
            json={"text": "I should not be here"},
            headers=auth_headers(TEST_TOKEN_3),
        )
        assert r.status_code == 403, r.text

    def test_get_messages_non_member_returns_403(self, api):
        match_id = getattr(pytest, "match_id", None)
        r = api.get(
            f"{BASE_URL}/api/chats/{match_id}/messages",
            headers=auth_headers(TEST_TOKEN_3),
        )
        assert r.status_code == 403, r.text

    def test_bad_match_id_returns_404(self, api):
        r = api.get(
            f"{BASE_URL}/api/chats/match_does_not_exist/messages",
            headers=auth_headers(TEST_TOKEN),
        )
        assert r.status_code == 404, r.text
