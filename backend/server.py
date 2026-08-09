from fastapi import FastAPI, APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

from seed_data import SEED_GROUPS, SEED_USERS, SEED_USER_REFRESH_FIELDS


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# -------- Models --------
class SessionRequest(BaseModel):
    session_token: str


class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    profile_complete: bool = False


class ProfileIn(BaseModel):
    age: int
    gender: str
    bio: str
    location: str
    interests: List[str] = []
    modes: List[str] = []  # events, trips, situationship
    photos: List[str] = []  # urls or base64
    destinations: List[str] = []  # places/events the user is going to


class ProfileSettingsIn(BaseModel):
    """Privacy / discovery preferences (toggle without full profile edit)."""
    hide_from_discover: bool


class Profile(BaseModel):
    user_id: str
    name: str
    picture: Optional[str] = None
    age: int
    gender: str
    bio: str
    location: str
    interests: List[str] = []
    modes: List[str] = []
    photos: List[str] = []


class SwipeIn(BaseModel):
    target_user_id: str
    direction: Literal["like", "pass"]
    mode: Literal["events", "trips", "situationship"]


class SwipeResult(BaseModel):
    matched: bool
    match_id: Optional[str] = None
    other_name: Optional[str] = None
    shared_destinations: List[str] = []
    mode: Optional[str] = None


class MessageIn(BaseModel):
    text: str


class Message(BaseModel):
    id: str
    match_id: str
    sender_id: str
    text: str
    created_at: str


class MatchOut(BaseModel):
    match_id: str
    user_id: str
    name: str
    picture: Optional[str] = None
    mode: str
    created_at: str
    last_message: Optional[str] = None


class GroupIn(BaseModel):
    name: str
    bio: str = ""
    mode: Literal["events", "trips", "situationship"]
    location: str = ""
    destinations: List[str] = Field(default_factory=list)
    photos: List[str] = Field(default_factory=list)
    max_members: int = 6


class GroupSwipeIn(BaseModel):
    target_group_id: str
    direction: Literal["like", "pass"]
    mode: Literal["events", "trips", "situationship"]


# -------- Auth helpers --------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# -------- Auth routes --------
@api_router.post("/auth/session")
async def auth_session(payload: SessionRequest):
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        resp = await http_client.get(
            EMERGENT_SESSION_URL,
            headers={"X-Session-ID": payload.session_token},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session token")
        data = resp.json()

    email = data.get("email")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Bad session data")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "profile_complete": False,
                "created_at": datetime.now(timezone.utc),
            }
        )

    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user_id,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "session_token": session_token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "profile_complete": user.get("profile_complete", False),
        },
    }


@api_router.get("/auth/me", response_model=UserPublic)
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return UserPublic(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        picture=user.get("picture"),
        profile_complete=user.get("profile_complete", False),
    )


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# -------- Profile routes --------
@api_router.post("/profile")
async def upsert_profile(payload: ProfileIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    was_complete = user.get("profile_complete", False)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "age": payload.age,
                "gender": payload.gender,
                "bio": payload.bio,
                "location": payload.location,
                "interests": payload.interests,
                "modes": payload.modes,
                "photos": payload.photos,
                "destinations": payload.destinations,
                "profile_complete": True,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # First-time profile completion: seed a couple of "like" swipes from
    # random seed users towards this user so they can experience the match
    # flow without needing a second human account.
    if not was_complete and payload.modes:
        import random
        seed_ids = [u["user_id"] for u in SEED_USERS]
        random.shuffle(seed_ids)
        pre_likers = seed_ids[:3]
        for i, sid in enumerate(pre_likers):
            mode = payload.modes[i % len(payload.modes)]
            await db.swipes.update_one(
                {"swiper_id": sid, "target_user_id": user["user_id"], "mode": mode},
                {
                    "$set": {
                        "swiper_id": sid,
                        "target_user_id": user["user_id"],
                        "direction": "like",
                        "mode": mode,
                        "created_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )

    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_profile(updated)


@api_router.get("/profile/me")
async def get_my_profile(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return _user_to_profile(user, user)


@api_router.patch("/profile/settings")
async def update_profile_settings(payload: ProfileSettingsIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "hide_from_discover": payload.hide_from_discover,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return _user_to_profile(updated, updated)


def _user_to_profile(user: dict, viewer: Optional[dict] = None) -> dict:
    dests = user.get("destinations", []) or []
    shared: List[str] = []
    if viewer and viewer.get("user_id") != user.get("user_id"):
        viewer_dests = {d.lower(): d for d in (viewer.get("destinations", []) or [])}
        for d in dests:
            if d.lower() in viewer_dests:
                shared.append(d)
    result = {
        "user_id": user["user_id"],
        "name": user.get("name", ""),
        "picture": user.get("picture"),
        "email": user.get("email", ""),
        "age": user.get("age", 0),
        "gender": user.get("gender", ""),
        "bio": user.get("bio", ""),
        "location": user.get("location", ""),
        "interests": user.get("interests", []),
        "modes": user.get("modes", []),
        "photos": user.get("photos", []),
        "destinations": dests,
        "shared_destinations": shared,
        "profile_complete": user.get("profile_complete", False),
    }
    if viewer and viewer.get("user_id") == user.get("user_id"):
        result["hide_from_discover"] = bool(user.get("hide_from_discover", False))
    return result


# -------- Discovery --------
LGBTQ_GENDER_VALUES = {
    "non-binary",
    "other",
    "lgbtq",
    "lgbtq+",
    "queer",
    "trans",
    "genderqueer",
}


def _parse_gender_filter(genders: Optional[str]) -> Optional[List[str]]:
    if not genders or not genders.strip():
        return None
    expanded: set = set()
    for raw in genders.split(","):
        g = raw.strip().lower()
        if not g:
            continue
        if g in ("lgbtq", "lgbtq+"):
            expanded |= LGBTQ_GENDER_VALUES
        else:
            expanded.add(g)
    return list(expanded) if expanded else None


@api_router.get("/discover")
async def discover(
    mode: str,
    destination: Optional[str] = None,
    location: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    genders: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)

    swiped = await db.swipes.find(
        {"swiper_id": user["user_id"]}, {"_id": 0, "target_user_id": 1}
    ).to_list(1000)
    swiped_ids = {s["target_user_id"] for s in swiped}
    swiped_ids.add(user["user_id"])

    query: dict = {
        "user_id": {"$nin": list(swiped_ids)},
        "profile_complete": True,
        "modes": mode,
        "hide_from_discover": {"$ne": True},
    }
    if destination and destination.strip():
        # case-insensitive substring match on any destination in the user's list
        query["destinations"] = {"$regex": destination.strip(), "$options": "i"}
    if location and location.strip():
        query["location"] = {"$regex": location.strip(), "$options": "i"}

    age_filter: dict = {}
    if min_age is not None:
        age_filter["$gte"] = min_age
    if max_age is not None:
        age_filter["$lte"] = max_age
    if age_filter:
        query["age"] = age_filter

    gender_values = _parse_gender_filter(genders)
    if gender_values:
        query["gender"] = {"$in": gender_values}

    cursor = db.users.find(query, {"_id": 0})
    candidates = await cursor.to_list(50)
    return [_user_to_profile(u, user) for u in candidates]


# -------- Swipes / Matches --------
@api_router.post("/swipes", response_model=SwipeResult)
async def swipe(payload: SwipeIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if payload.target_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot swipe yourself")

    await db.swipes.update_one(
        {"swiper_id": user["user_id"], "target_user_id": payload.target_user_id, "mode": payload.mode},
        {
            "$set": {
                "swiper_id": user["user_id"],
                "target_user_id": payload.target_user_id,
                "direction": payload.direction,
                "mode": payload.mode,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    if payload.direction != "like":
        return SwipeResult(matched=False)

    reverse = await db.swipes.find_one(
        {
            "swiper_id": payload.target_user_id,
            "target_user_id": user["user_id"],
            "direction": "like",
            "mode": payload.mode,
        },
        {"_id": 0},
    )
    if not reverse:
        return SwipeResult(matched=False)

    pair = sorted([user["user_id"], payload.target_user_id])
    match_key = f"{pair[0]}::{pair[1]}::{payload.mode}"
    existing = await db.matches.find_one({"match_key": match_key}, {"_id": 0})
    if existing:
        match_id = existing["match_id"]
    else:
        match_id = f"match_{uuid.uuid4().hex[:12]}"
        await db.matches.insert_one(
            {
                "match_id": match_id,
                "match_key": match_key,
                "user_a": pair[0],
                "user_b": pair[1],
                "mode": payload.mode,
                "created_at": datetime.now(timezone.utc),
            }
        )

    other = await db.users.find_one({"user_id": payload.target_user_id}, {"_id": 0})
    shared: List[str] = []
    if other:
        viewer_dests = {d.lower() for d in (user.get("destinations", []) or [])}
        for d in other.get("destinations", []) or []:
            if d.lower() in viewer_dests:
                shared.append(d)

    return SwipeResult(
        matched=True,
        match_id=match_id,
        other_name=(other or {}).get("name"),
        shared_destinations=shared,
        mode=payload.mode,
    )


@api_router.get("/matches")
async def list_matches(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    cursor = db.matches.find(
        {"$or": [{"user_a": uid}, {"user_b": uid}]}, {"_id": 0}
    ).sort("created_at", -1)
    matches = await cursor.to_list(200)

    results = []
    for m in matches:
        other_id = m["user_b"] if m["user_a"] == uid else m["user_a"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
        if not other:
            continue
        last_msg_doc = await db.messages.find_one(
            {"match_id": m["match_id"]}, {"_id": 0}, sort=[("created_at", -1)]
        )
        viewer_dests = {d.lower() for d in (user.get("destinations", []) or [])}
        shared = [d for d in (other.get("destinations", []) or []) if d.lower() in viewer_dests]
        results.append(
            {
                "match_id": m["match_id"],
                "user_id": other["user_id"],
                "name": other.get("name", ""),
                "picture": (other.get("photos") or [None])[0] or other.get("picture"),
                "mode": m["mode"],
                "created_at": m["created_at"].isoformat(),
                "last_message": last_msg_doc["text"] if last_msg_doc else None,
                "shared_destinations": shared,
            }
        )
    return results


# -------- Groups / Squads --------
def _group_visibility(member_count: int, created_at: Optional[datetime] = None) -> float:
    recency = 0.0
    if created_at:
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        age_hours = max((datetime.now(timezone.utc) - created_at).total_seconds() / 3600, 0)
        recency = max(0.0, 24.0 - age_hours) / 24.0
    return round(10 + (member_count * 4) + recency, 3)


async def _group_members(member_ids: List[str]) -> List[dict]:
    if not member_ids:
        return []
    cursor = db.users.find({"user_id": {"$in": member_ids}}, {"_id": 0})
    users = await cursor.to_list(100)
    by_id = {u["user_id"]: u for u in users}
    members = []
    for uid in member_ids:
        u = by_id.get(uid)
        if not u:
            continue
        members.append({
            "user_id": uid,
            "name": u.get("name", ""),
            "picture": (u.get("photos") or [None])[0] or u.get("picture"),
        })
    return members


async def _group_to_out(group: dict, viewer: Optional[dict] = None) -> dict:
    member_ids = group.get("member_ids", []) or []
    created_at = group.get("created_at") or datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    member_count = len(member_ids)
    viewer_id = viewer.get("user_id") if viewer else None
    request_status = None
    if viewer_id and viewer_id not in member_ids:
        req = await db.group_join_requests.find_one(
            {"group_id": group["group_id"], "user_id": viewer_id, "status": "pending"},
            {"_id": 0, "status": 1},
        )
        request_status = req.get("status") if req else None
    return {
        "group_id": group["group_id"],
        "name": group.get("name", ""),
        "bio": group.get("bio", ""),
        "mode": group.get("mode", "trips"),
        "location": group.get("location", ""),
        "destinations": group.get("destinations", []) or [],
        "photos": group.get("photos", []) or [],
        "creator_id": group.get("creator_id"),
        "member_ids": member_ids,
        "member_count": member_count,
        "max_members": group.get("max_members", 6),
        "members": await _group_members(member_ids),
        "is_member": viewer_id in member_ids if viewer_id else False,
        "is_admin": viewer_id == group.get("creator_id") if viewer_id else False,
        "request_status": request_status,
        "visibility_score": group.get("visibility_score") or _group_visibility(member_count, created_at),
        "created_at": created_at.isoformat(),
    }


async def _assert_group_member(group_id: str, user_id: str) -> dict:
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if user_id not in (group.get("member_ids", []) or []):
        raise HTTPException(status_code=403, detail="Not a member of group")
    return group


async def _assert_group_admin(group_id: str, user_id: str) -> dict:
    group = await _assert_group_member(group_id, user_id)
    if group.get("creator_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the group owner can manage requests")
    return group


async def _add_user_to_group(group: dict, user_id: str) -> dict:
    member_ids = group.get("member_ids", []) or []
    if user_id not in member_ids:
        if len(member_ids) >= group.get("max_members", 6):
            raise HTTPException(status_code=400, detail="Group is full")
        member_ids.append(user_id)
    now = datetime.now(timezone.utc)
    await db.groups.update_one(
        {"group_id": group["group_id"]},
        {"$set": {
            "member_ids": member_ids,
            "visibility_score": _group_visibility(len(member_ids), group.get("created_at")),
            "updated_at": now,
        }},
    )
    updated = await db.groups.find_one({"group_id": group["group_id"]}, {"_id": 0})
    return updated


@api_router.post("/groups")
async def create_group(payload: GroupIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")
    max_members = max(2, min(payload.max_members, 12))
    now = datetime.now(timezone.utc)
    group = {
        "group_id": f"group_{uuid.uuid4().hex[:12]}",
        "name": name,
        "bio": payload.bio.strip(),
        "mode": payload.mode,
        "location": payload.location.strip(),
        "destinations": [d.strip() for d in payload.destinations if d.strip()][:8],
        "photos": payload.photos[:6],
        "creator_id": user["user_id"],
        "member_ids": [user["user_id"]],
        "max_members": max_members,
        "visibility_score": _group_visibility(1, now),
        "created_at": now,
        "updated_at": now,
    }
    await db.groups.insert_one(group)
    return await _group_to_out(group, user)


@api_router.get("/groups/me")
async def my_groups(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    groups = await db.groups.find({"member_ids": uid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    request_docs = await db.group_join_requests.find(
        {"owner_id": uid, "status": "pending"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    invite_docs = await db.group_join_requests.find(
        {"user_id": uid, "status": "invited"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    requests = []
    for req in request_docs:
        requester = await db.users.find_one({"user_id": req["user_id"]}, {"_id": 0})
        group = await db.groups.find_one({"group_id": req["group_id"]}, {"_id": 0})
        if not requester or not group:
            continue
        requests.append({
            **req,
            "created_at": req["created_at"].isoformat(),
            "group_name": group.get("name", ""),
            "user_name": requester.get("name", ""),
            "user_picture": (requester.get("photos") or [None])[0] or requester.get("picture"),
        })
    invitations = []
    for inv in invite_docs:
        group = await db.groups.find_one({"group_id": inv["group_id"]}, {"_id": 0})
        inviter = await db.users.find_one({"user_id": inv.get("invited_by") or inv.get("owner_id")}, {"_id": 0})
        if not group:
            continue
        invitations.append({
            **inv,
            "created_at": inv["created_at"].isoformat(),
            "group_name": group.get("name", ""),
            "group_photo": (group.get("photos") or [None])[0],
            "group_mode": group.get("mode"),
            "group_destination": (group.get("destinations") or [""])[0],
            "inviter_name": (inviter or {}).get("name", "A buddy"),
        })
    return {
        "groups": [await _group_to_out(g, user) for g in groups],
        "requests": requests,
        "invitations": invitations,
    }


@api_router.get("/groups/{group_id}")
async def group_detail(group_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return await _group_to_out(group, user)


@api_router.get("/groups/{group_id}/invite-candidates")
async def group_invite_candidates(group_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    group = await _assert_group_admin(group_id, user["user_id"])
    member_ids = set(group.get("member_ids", []) or [])

    cursor = db.matches.find(
        {"$or": [{"user_a": user["user_id"]}, {"user_b": user["user_id"]}]},
        {"_id": 0},
    ).sort("created_at", -1)
    matches = await cursor.to_list(200)

    candidates = []
    seen: set[str] = set()
    for m in matches:
        other_id = m["user_b"] if m["user_a"] == user["user_id"] else m["user_a"]
        if other_id in member_ids or other_id in seen:
            continue
        existing = await db.group_join_requests.find_one(
            {"group_id": group_id, "user_id": other_id, "status": {"$in": ["pending", "invited"]}},
            {"_id": 0},
        )
        if existing:
            continue
        seen.add(other_id)
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
        if not other:
            continue
        candidates.append({
            "user_id": other["user_id"],
            "name": other.get("name", ""),
            "picture": (other.get("photos") or [None])[0] or other.get("picture"),
            "location": other.get("location", ""),
            "modes": other.get("modes", []),
            "destinations": other.get("destinations", []),
        })
    return candidates


@api_router.post("/groups/{group_id}/invite/{user_id}")
async def invite_group_member(group_id: str, user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    group = await _assert_group_admin(group_id, user["user_id"])
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="You are already in this group")
    invitee = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")

    member_ids = group.get("member_ids", []) or []
    if user_id in member_ids:
        updated = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
        return await _group_to_out(updated, user)
    if len(member_ids) >= group.get("max_members", 6):
        raise HTTPException(status_code=400, detail="Group is full")

    now = datetime.now(timezone.utc)
    existing = await db.group_join_requests.find_one(
        {"group_id": group_id, "user_id": user_id, "status": {"$in": ["pending", "invited"]}},
        {"_id": 0},
    )
    if existing:
        return {
            "invited": True,
            "request_id": existing["request_id"],
            "status": existing["status"],
        }
    request_id = f"greq_{uuid.uuid4().hex[:12]}"
    await db.group_join_requests.insert_one(
        {
            "request_id": request_id,
            "group_id": group_id,
            "owner_id": group["creator_id"],
            "user_id": user_id,
            "invited_by": user["user_id"],
            "status": "invited",
            "mode": group.get("mode"),
            "created_at": now,
        }
    )
    return {"invited": True, "request_id": request_id, "status": "invited"}


@api_router.post("/groups/{group_id}/members/{user_id}/remove")
async def remove_group_member(group_id: str, user_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    group = await _assert_group_admin(group_id, user["user_id"])
    if user_id == group.get("creator_id"):
        raise HTTPException(status_code=400, detail="Owner cannot be removed from the squad")
    member_ids = group.get("member_ids", []) or []
    if user_id not in member_ids:
        raise HTTPException(status_code=404, detail="Member not found in this group")
    member_ids = [m for m in member_ids if m != user_id]
    now = datetime.now(timezone.utc)
    await db.groups.update_one(
        {"group_id": group_id},
        {"$set": {
            "member_ids": member_ids,
            "visibility_score": _group_visibility(len(member_ids), group.get("created_at")),
            "updated_at": now,
        }},
    )
    await db.group_join_requests.update_many(
        {"group_id": group_id, "user_id": user_id, "status": {"$in": ["pending", "invited"]}},
        {"$set": {"status": "removed", "resolved_at": now}},
    )
    updated = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    return await _group_to_out(updated, user)


@api_router.get("/discover/groups")
async def discover_groups(
    mode: str,
    destination: Optional[str] = None,
    location: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization)
    uid = user["user_id"]
    swiped = await db.group_swipes.find(
        {"swiper_id": uid}, {"_id": 0, "target_group_id": 1}
    ).to_list(1000)
    swiped_ids = {s["target_group_id"] for s in swiped}
    query: dict = {
        "mode": mode,
        "group_id": {"$nin": list(swiped_ids)},
        "member_ids": {"$ne": uid},
        "$expr": {"$lt": [{"$size": "$member_ids"}, "$max_members"]},
    }
    if destination and destination.strip():
        query["destinations"] = {"$regex": destination.strip(), "$options": "i"}
    if location and location.strip():
        query["location"] = {"$regex": location.strip(), "$options": "i"}

    cursor = db.groups.find(query, {"_id": 0}).sort([
        ("visibility_score", -1),
        ("created_at", -1),
    ])
    groups = await cursor.to_list(50)
    return [await _group_to_out(g, user) for g in groups]


@api_router.post("/group-swipes")
async def group_swipe(payload: GroupSwipeIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    group = await db.groups.find_one({"group_id": payload.target_group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if user["user_id"] in (group.get("member_ids", []) or []):
        raise HTTPException(status_code=400, detail="Already a group member")

    now = datetime.now(timezone.utc)
    await db.group_swipes.update_one(
        {"swiper_id": user["user_id"], "target_group_id": payload.target_group_id, "mode": payload.mode},
        {"$set": {
            "swiper_id": user["user_id"],
            "target_group_id": payload.target_group_id,
            "direction": payload.direction,
            "mode": payload.mode,
            "created_at": now,
        }},
        upsert=True,
    )
    if payload.direction != "like":
        return {"requested": False, "request_id": None, "status": "passed"}

    if len(group.get("member_ids", []) or []) >= group.get("max_members", 6):
        raise HTTPException(status_code=400, detail="This group is full")

    request_id = f"greq_{uuid.uuid4().hex[:12]}"
    existing = await db.group_join_requests.find_one(
        {"group_id": group["group_id"], "user_id": user["user_id"], "status": "pending"},
        {"_id": 0},
    )
    if existing:
        return {"requested": True, "request_id": existing["request_id"], "status": "pending"}

    await db.group_join_requests.insert_one({
        "request_id": request_id,
        "group_id": group["group_id"],
        "owner_id": group["creator_id"],
        "user_id": user["user_id"],
        "status": "pending",
        "mode": payload.mode,
        "created_at": now,
    })
    return {"requested": True, "request_id": request_id, "status": "pending"}


@api_router.get("/groups/{group_id}/requests")
async def group_requests(group_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _assert_group_admin(group_id, user["user_id"])
    docs = await db.group_join_requests.find(
        {"group_id": group_id, "status": "pending"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    out = []
    for req in docs:
        requester = await db.users.find_one({"user_id": req["user_id"]}, {"_id": 0})
        if not requester:
            continue
        out.append({
            **req,
            "created_at": req["created_at"].isoformat(),
            "user_name": requester.get("name", ""),
            "user_picture": (requester.get("photos") or [None])[0] or requester.get("picture"),
            "user_location": requester.get("location", ""),
        })
    return out


@api_router.post("/groups/{group_id}/requests/{request_id}/accept")
async def accept_group_request(group_id: str, request_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    group = await _assert_group_admin(group_id, user["user_id"])
    req = await db.group_join_requests.find_one(
        {"group_id": group_id, "request_id": request_id, "status": "pending"},
        {"_id": 0},
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    now = datetime.now(timezone.utc)
    updated = await _add_user_to_group(group, req["user_id"])
    await db.group_join_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted", "resolved_at": now}},
    )
    return await _group_to_out(updated, user)


@api_router.post("/groups/{group_id}/requests/{request_id}/reject")
async def reject_group_request(group_id: str, request_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _assert_group_admin(group_id, user["user_id"])
    now = datetime.now(timezone.utc)
    result = await db.group_join_requests.update_one(
        {"group_id": group_id, "request_id": request_id, "status": "pending"},
        {"$set": {"status": "rejected", "resolved_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"ok": True}


@api_router.post("/groups/{group_id}/invitations/{request_id}/accept")
async def accept_group_invitation(group_id: str, request_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    req = await db.group_join_requests.find_one(
        {
            "group_id": group_id,
            "request_id": request_id,
            "user_id": user["user_id"],
            "status": "invited",
        },
        {"_id": 0},
    )
    if not req:
        raise HTTPException(status_code=404, detail="Invitation not found")
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    now = datetime.now(timezone.utc)
    updated = await _add_user_to_group(group, user["user_id"])
    await db.group_join_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted", "resolved_at": now}},
    )
    return await _group_to_out(updated, user)


@api_router.post("/groups/{group_id}/invitations/{request_id}/reject")
async def reject_group_invitation(group_id: str, request_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    now = datetime.now(timezone.utc)
    result = await db.group_join_requests.update_one(
        {
            "group_id": group_id,
            "request_id": request_id,
            "user_id": user["user_id"],
            "status": "invited",
        },
        {"$set": {"status": "rejected", "resolved_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return {"ok": True}


@api_router.get("/groups/{group_id}/messages")
async def get_group_messages(group_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _assert_group_member(group_id, user["user_id"])
    cursor = db.group_messages.find({"group_id": group_id}, {"_id": 0}).sort("created_at", 1)
    msgs = await cursor.to_list(500)
    return [
        {
            "id": m["id"],
            "group_id": m["group_id"],
            "sender_id": m["sender_id"],
            "sender_name": m.get("sender_name", ""),
            "text": m["text"],
            "created_at": m["created_at"].isoformat(),
        }
        for m in msgs
    ]


@api_router.post("/groups/{group_id}/messages")
async def post_group_message(group_id: str, payload: MessageIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _assert_group_member(group_id, user["user_id"])
    msg = {
        "id": f"gmsg_{uuid.uuid4().hex[:12]}",
        "group_id": group_id,
        "sender_id": user["user_id"],
        "sender_name": user.get("name", ""),
        "text": payload.text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.group_messages.insert_one(msg)
    payload_out = {
        "id": msg["id"],
        "group_id": msg["group_id"],
        "sender_id": msg["sender_id"],
        "sender_name": msg["sender_name"],
        "text": msg["text"],
        "created_at": msg["created_at"].isoformat(),
    }
    await ws_manager.broadcast(f"group:{group_id}", {"type": "message", "data": payload_out})
    return payload_out


# -------- Chat --------
async def _assert_match_member(match_id: str, user_id: str) -> dict:
    m = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    if user_id not in (m["user_a"], m["user_b"]):
        raise HTTPException(status_code=403, detail="Not a member of match")
    return m


@api_router.get("/chats/{match_id}/messages")
async def get_messages(match_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _assert_match_member(match_id, user["user_id"])
    cursor = db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1)
    msgs = await cursor.to_list(500)
    return [
        {
            "id": m["id"],
            "match_id": m["match_id"],
            "sender_id": m["sender_id"],
            "text": m["text"],
            "created_at": m["created_at"].isoformat(),
        }
        for m in msgs
    ]


@api_router.post("/chats/{match_id}/messages")
async def post_message(match_id: str, payload: MessageIn, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await _assert_match_member(match_id, user["user_id"])
    msg = {
        "id": f"msg_{uuid.uuid4().hex[:12]}",
        "match_id": match_id,
        "sender_id": user["user_id"],
        "text": payload.text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.messages.insert_one(msg)
    payload_out = {
        "id": msg["id"],
        "match_id": msg["match_id"],
        "sender_id": msg["sender_id"],
        "text": msg["text"],
        "created_at": msg["created_at"].isoformat(),
    }
    await ws_manager.broadcast(match_id, {"type": "message", "data": payload_out})
    return payload_out


# -------- WebSocket chat --------
class WSManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}

    async def join(self, match_id: str, ws: WebSocket):
        self.rooms.setdefault(match_id, []).append(ws)

    def leave(self, match_id: str, ws: WebSocket):
        if match_id in self.rooms:
            try:
                self.rooms[match_id].remove(ws)
            except ValueError:
                pass
            if not self.rooms[match_id]:
                self.rooms.pop(match_id, None)

    async def broadcast(self, match_id: str, payload: dict):
        for ws in list(self.rooms.get(match_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.leave(match_id, ws)


ws_manager = WSManager()


@app.websocket("/api/ws/chats/{match_id}")
async def ws_chat(websocket: WebSocket, match_id: str, token: str = ""):
    # Accept first so we can deliver a close-code that the client can read.
    await websocket.accept()

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        await websocket.close(code=4401)
        return
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        await websocket.close(code=4401)
        return
    match = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not match or user["user_id"] not in (match["user_a"], match["user_b"]):
        await websocket.close(code=4403)
        return

    await ws_manager.join(match_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            text = (data or {}).get("text", "").strip()
            if not text:
                continue
            msg = {
                "id": f"msg_{uuid.uuid4().hex[:12]}",
                "match_id": match_id,
                "sender_id": user["user_id"],
                "text": text,
                "created_at": datetime.now(timezone.utc),
            }
            await db.messages.insert_one(msg)
            await ws_manager.broadcast(match_id, {
                "type": "message",
                "data": {
                    "id": msg["id"],
                    "match_id": msg["match_id"],
                    "sender_id": msg["sender_id"],
                    "text": msg["text"],
                    "created_at": msg["created_at"].isoformat(),
                },
            })
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.leave(match_id, websocket)


@app.websocket("/api/ws/groups/{group_id}")
async def ws_group_chat(websocket: WebSocket, group_id: str, token: str = ""):
    await websocket.accept()

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        await websocket.close(code=4401)
        return
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        await websocket.close(code=4401)
        return
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group or user["user_id"] not in (group.get("member_ids", []) or []):
        await websocket.close(code=4403)
        return

    room = f"group:{group_id}"
    await ws_manager.join(room, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            text = (data or {}).get("text", "").strip()
            if not text:
                continue
            msg = {
                "id": f"gmsg_{uuid.uuid4().hex[:12]}",
                "group_id": group_id,
                "sender_id": user["user_id"],
                "sender_name": user.get("name", ""),
                "text": text,
                "created_at": datetime.now(timezone.utc),
            }
            await db.group_messages.insert_one(msg)
            await ws_manager.broadcast(room, {
                "type": "message",
                "data": {
                    "id": msg["id"],
                    "group_id": msg["group_id"],
                    "sender_id": msg["sender_id"],
                    "sender_name": msg["sender_name"],
                    "text": msg["text"],
                    "created_at": msg["created_at"].isoformat(),
                },
            })
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.leave(room, websocket)


# -------- Health --------
@api_router.get("/")
async def root():
    return {"message": "Vinle API"}


# -------- Destination suggestions --------
DESTINATION_SUGGESTIONS = [
    # India — Mountains / Hill stations
    "Manali", "Kasol", "Tosh", "Kheerganga", "Bir Billing", "Spiti Valley",
    "Leh", "Ladakh", "Pangong Lake", "Nubra Valley", "Srinagar", "Gulmarg",
    "Pahalgam", "Sonamarg", "Dharamshala", "McLeodganj", "Dalhousie",
    "Shimla", "Mussoorie", "Nainital", "Rishikesh", "Auli", "Chopta",
    "Tungnath", "Dehradun", "Gangtok", "Darjeeling", "Tawang", "Ziro",
    "Sikkim", "Meghalaya", "Shillong", "Cherrapunji", "Mawlynnong",
    # India — Beaches & coast
    "Goa", "Palolem", "Anjuna", "Gokarna", "Varkala", "Alleppey",
    "Munnar", "Wayanad", "Pondicherry", "Auroville", "Andaman Islands",
    "Havelock Island", "Lakshadweep",
    # India — Deserts & heritage
    "Jaisalmer", "Jodhpur", "Udaipur", "Pushkar", "Jaipur", "Bikaner",
    "Mount Abu", "Hampi", "Mysore", "Coorg", "Chikmagalur",
    # India — Cities
    "Mumbai", "Delhi", "Bangalore", "Bengaluru", "Hyderabad", "Chennai",
    "Kolkata", "Pune", "Ahmedabad", "Chandigarh", "Lucknow", "Varanasi",
    # India — Festivals & events
    "Sunburn Goa", "NH7 Weekender", "Magnetic Fields Festival",
    "Hornbill Festival", "Pushkar Camel Fair", "Rann Utsav",
    "Holi Festival", "Diwali", "Ziro Music Festival", "VH1 Supersonic",
    "Lollapalooza India", "Sunburn Pune", "Sunburn Hyderabad",
    "AP Dhillon India Tour", "Diljit Dosanjh Dil-Luminati", "Arijit Singh Live",
    "BGMI Masters Series", "ISL Final", "IPL Final",
    "Wankhede Stadium", "Eden Gardens", "Chinnaswamy Stadium",
    "JLN Stadium Delhi", "DY Patil Stadium",
    # Treks & adventure (India)
    "Hampta Pass Trek", "Kedarkantha Trek", "Valley of Flowers",
    "Roopkund Trek", "Markha Valley Trek", "Goecha La Trek",
    # Global — Music festivals & concerts
    "Coachella", "Tomorrowland", "Burning Man", "EDC Las Vegas",
    "Glastonbury", "Ultra Music Festival", "Lollapalooza",
    "Governors Ball", "Primavera Sound", "Eras Tour", "Sphere Las Vegas",
    "Rolling Loud", "Outside Lands", "Bonnaroo", "Stagecoach",
    "Electric Forest", "Splendour in the Grass", "Reading Festival",
    "Sziget Festival", "Mysteryland", "Awakenings", "Wireless Festival",
    "Boomtown", "Creamfields", "DGTL Amsterdam", "Time Warp",
    # Global — Sports / F1
    "Monaco GP", "Silverstone GP", "Abu Dhabi GP", "Las Vegas GP",
    "Indian GP", "Singapore GP", "Suzuka GP", "Bahrain GP",
    "Super Bowl", "Wimbledon", "Roland Garros", "US Open Tennis",
    "Madison Square Garden", "Wembley Stadium",
    # Global — Concert venues
    "The O2 London", "Red Rocks", "Hollywood Bowl", "Allianz Arena",
    # Global — Asia
    "Tokyo", "Kyoto", "Osaka", "Hokkaido", "Okinawa", "Seoul",
    "Busan", "Jeju Island", "Bangkok", "Chiang Mai", "Phuket",
    "Krabi", "Pai Thailand", "Phi Phi Islands", "Bali", "Ubud",
    "Canggu", "Lombok", "Komodo", "Singapore", "Kuala Lumpur",
    "Penang", "Langkawi", "Hanoi", "Ho Chi Minh City", "Hoi An",
    "Halong Bay", "Sapa", "Siem Reap", "Angkor Wat", "Phnom Penh",
    "Yangon", "Bagan", "Kathmandu", "Pokhara", "Annapurna Base Camp",
    "Everest Base Camp", "Bhutan", "Thimphu", "Paro", "Tiger's Nest",
    "Colombo", "Ella Sri Lanka", "Maldives",
    # Global — Europe
    "Lisbon", "Porto", "Madrid", "Barcelona", "Seville", "Granada",
    "Paris", "Nice", "Marseille", "Amsterdam", "Rotterdam",
    "Berlin", "Munich", "Hamburg", "Cologne", "London", "Edinburgh",
    "Dublin", "Rome", "Florence", "Venice", "Milan", "Naples",
    "Cinque Terre", "Amalfi Coast", "Santorini", "Mykonos", "Athens",
    "Crete", "Ibiza", "Mallorca", "Croatia", "Hvar", "Dubrovnik",
    "Split", "Vienna", "Prague", "Budapest", "Krakow", "Warsaw",
    "Iceland", "Reykjavik", "Norway", "Tromsø", "Lofoten",
    "Stockholm", "Copenhagen", "Helsinki", "Zurich", "Interlaken",
    "Zermatt", "Lauterbrunnen",
    # Global — Americas
    "New York", "Brooklyn", "Los Angeles", "San Francisco", "Chicago",
    "Miami", "Austin", "Nashville", "New Orleans", "Las Vegas",
    "Seattle", "Portland", "Mexico City", "Tulum", "Playa del Carmen",
    "Cabo San Lucas", "Oaxaca", "Rio de Janeiro", "São Paulo",
    "Buenos Aires", "Patagonia", "Cusco", "Machu Picchu", "Lima",
    "Medellín", "Cartagena", "Costa Rica", "Banff", "Whistler",
    "Vancouver", "Toronto", "Montreal",
    # Global — Middle East / Africa
    "Dubai", "Abu Dhabi", "Doha", "Istanbul", "Cappadocia",
    "Antalya", "Cairo", "Marrakech", "Fes", "Sahara Desert",
    "Cape Town", "Zanzibar", "Serengeti", "Kilimanjaro",
    # Global — Outdoors & adventure
    "Joshua Tree", "Big Sur", "Yosemite", "Grand Canyon", "Zion",
    "Sedona", "Denali", "Banff", "Maui", "Oahu", "Kauai",
    "Galapagos",
]


INTEREST_SEEDS = [
    "Music", "Travel", "Hiking", "Food", "Photography", "Yoga", "Surfing",
    "Festivals", "Beaches", "Mountains", "Nightlife", "Art", "Books", "Films",
    "Coffee", "Gaming", "Fitness", "Fashion", "Culture", "Wildlife", "Camping",
    "Road trips", "Backpacking", "Scuba diving", "Skiing", "History", "Food tours",
]

EVENT_HINTS = (
    "festival", "concert", "tour", " gp", "championship", "open", "weekender",
    "sunburn", "coachella", "ipl", "super bowl", "olympics", "expo",
)


async def _nominatim_places(q: str, limit: int = 6) -> List[str]:
    """Places from OpenStreetMap (no API key)."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": q,
                    "format": "json",
                    "limit": limit,
                    "addressdetails": 1,
                },
                headers={"User-Agent": "Vinle/1.0 (vinle-app)"},
            )
            if resp.status_code != 200:
                return []
            out: list[str] = []
            for item in resp.json():
                name = (item.get("name") or "").strip()
                addr = item.get("address") or {}
                city = (
                    addr.get("city")
                    or addr.get("town")
                    or addr.get("village")
                    or addr.get("state")
                    or ""
                )
                country = addr.get("country") or ""
                if name and city and name.lower() != city.lower():
                    label = f"{name}, {city}"
                elif name:
                    label = name
                else:
                    label = (item.get("display_name") or "").split(",")[0].strip()
                if country and country not in label:
                    label = f"{label}, {country}" if label else country
                if label and label not in out:
                    out.append(label)
            return out
    except Exception as e:
        logger.warning("Nominatim search failed: %s", e)
        return []


def _static_destination_matches(query: str, limit: int) -> List[str]:
    if not query:
        return DESTINATION_SUGGESTIONS[:limit]
    prefix = [s for s in DESTINATION_SUGGESTIONS if s.lower().startswith(query)]
    substring = [
        s for s in DESTINATION_SUGGESTIONS
        if query in s.lower() and not s.lower().startswith(query)
    ]
    return prefix + substring


async def _user_destination_matches(query: str) -> List[str]:
    if not query:
        return []
    found: list[str] = []
    cursor = db.users.find(
        {"destinations": {"$regex": query, "$options": "i"}},
        {"_id": 0, "destinations": 1},
    )
    async for u in cursor:
        for d in u.get("destinations", []):
            if query in d.lower():
                found.append(d)
    return found


@api_router.get("/suggestions")
async def suggestions(q: str = "", limit: int = 8):
    limit = max(1, min(limit, 20))
    query = (q or "").strip().lower()

    map_places: list[str] = []
    if len(query) >= 2:
        map_places = await _nominatim_places(query, limit=limit)

    # Events / festivals from curated list when query looks event-related
    static_matches: list[str] = []
    if query:
        static_matches = _static_destination_matches(query, limit)
        if any(hint in f" {query}" for hint in EVENT_HINTS):
            events = [
                s for s in DESTINATION_SUGGESTIONS
                if any(k in s.lower() for k in ("festival", "tour", " gp", "live", "weekender"))
                and query in s.lower()
            ]
            static_matches = events + static_matches
    else:
        static_matches = [
            s for s in DESTINATION_SUGGESTIONS
            if any(k in s.lower() for k in ("festival", "tour", " gp", "coachella", "sunburn"))
        ][:limit]

    user_dests = await _user_destination_matches(query) if query else []

    seen: set[str] = set()
    out: list[str] = []
    for s in map_places + user_dests + static_matches:
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
        if len(out) >= limit:
            break
    return out


@api_router.get("/suggestions/interests")
async def interest_suggestions(q: str = "", limit: int = 8):
    limit = max(1, min(limit, 20))
    query = (q or "").strip().lower()

    from_db: list[str] = []
    if query:
        pipeline = [
            {"$match": {"interests": {"$regex": query, "$options": "i"}}},
            {"$unwind": "$interests"},
            {"$match": {"interests": {"$regex": query, "$options": "i"}}},
            {"$group": {"_id": "$interests"}},
            {"$limit": limit},
        ]
        async for row in db.users.aggregate(pipeline):
            val = row.get("_id")
            if val:
                from_db.append(val)
    else:
        pipeline = [
            {"$unwind": "$interests"},
            {"$group": {"_id": "$interests", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
            {"$limit": limit},
        ]
        async for row in db.users.aggregate(pipeline):
            val = row.get("_id")
            if val:
                from_db.append(val)

    static: list[str] = []
    if query:
        static = [
            s for s in INTEREST_SEEDS
            if s.lower().startswith(query) or query in s.lower()
        ]
    else:
        static = INTEREST_SEEDS[:limit]

    seen: set[str] = set()
    out: list[str] = []
    for s in from_db + static:
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
        if len(out) >= limit:
            break
    return out


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Startup: indexes + seed --------


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.matches.create_index("match_key", unique=True)
    await db.swipes.create_index([("swiper_id", 1), ("target_user_id", 1), ("mode", 1)], unique=True)
    await db.messages.create_index([("match_id", 1), ("created_at", 1)])
    await db.groups.create_index("group_id", unique=True)
    await db.groups.create_index("member_ids")
    await db.groups.create_index([("mode", 1), ("visibility_score", -1)])
    await db.group_swipes.create_index([("swiper_id", 1), ("target_group_id", 1), ("mode", 1)], unique=True)
    await db.group_join_requests.create_index([("group_id", 1), ("user_id", 1), ("status", 1)])
    await db.group_join_requests.create_index([("owner_id", 1), ("status", 1)])
    await db.group_messages.create_index([("group_id", 1), ("created_at", 1)])

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
        await db.groups.update_one(
            {"group_id": g["group_id"]},
            {
                "$set": {
                    **g,
                    "visibility_score": _group_visibility(len(g["member_ids"]), now),
                    "created_at": now,
                    "updated_at": now,
                },
            },
            upsert=True,
        )
    logger.info(
        "Startup complete: indexes ensured, %d seed users, %d seed groups.",
        len(SEED_USERS),
        len(SEED_GROUPS),
    )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
