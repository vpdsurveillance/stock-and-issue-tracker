from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import logging
import uuid
import bcrypt
import jwt as pyjwt

from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal

from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Depends,
    Request,
    Response,
    UploadFile,
    File,
)

from fastapi.responses import StreamingResponse

from pydantic import BaseModel, Field, EmailStr

from motor.motor_asyncio import AsyncIOMotorClient

from starlette.middleware.cors import CORSMiddleware

from openpyxl import Workbook, load_workbook


# ============================================================
# APP
# ============================================================

app = FastAPI()

api = APIRouter(prefix="/api")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "Stock and Issue Tracker API is running"
    }


# ============================================================
# CONFIG
# ============================================================

JWT_SECRET = os.environ.get("JWT_SECRET", "changeme")
JWT_ALG = "HS256"

DEPARTMENTS = ("MDS", "VPD", "Media")

Department = Literal["MDS", "VPD", "Media"]


# ============================================================
# DATABASE
# ============================================================

mongo_url = os.environ["MONGO_URL"]

client = AsyncIOMotorClient(mongo_url)

db = client[os.environ["DB_NAME"]]


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("stockapp")


# ============================================================
# HELPERS
# ============================================================

def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(
        pwd.encode(),
        bcrypt.gensalt()
    ).decode()


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(
            pwd.encode(),
            hashed.encode()
        )
    except Exception:
        return False


def create_access_token(
    user_id: str,
    email: str,
    role: str
) -> str:

    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc)
        + timedelta(hours=12),
        "type": "access",
    }

    return pyjwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALG
    )


async def get_current_user(
    request: Request
) -> dict:

    token = request.cookies.get("access_token")

    if not token:
        h = request.headers.get("Authorization", "")

        if h.startswith("Bearer "):
            token = h[7:]

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    try:
        payload = pyjwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG]
        )

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired"
        )

    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = await db.users.find_one({
        "id": payload["sub"]
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    user.pop("_id", None)
    user.pop("password_hash", None)

    return user


async def require_admin(
    user: dict = Depends(get_current_user)
) -> dict:

    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin only"
        )

    return user


def _iso(dt: datetime) -> str:

    return dt.astimezone(
        timezone.utc
    ).isoformat()


def _parse_date(s) -> datetime:

    if isinstance(s, datetime):
        return (
            s
            if s.tzinfo
            else s.replace(tzinfo=timezone.utc)
        )

    if isinstance(s, date):
        return datetime(
            s.year,
            s.month,
            s.day,
            tzinfo=timezone.utc
        )

    dt = datetime.fromisoformat(
        str(s).replace("Z", "+00:00")
    )

    return (
        dt
        if dt.tzinfo
        else dt.replace(tzinfo=timezone.utc)
    )


# ============================================================
# MODELS
# ============================================================

class LoginBody(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str


class ItemIn(BaseModel):
    name: str
    pack_size: str
    department: Department


class ItemOut(ItemIn):
    id: str
    created_at: str


class StockEntryIn(BaseModel):
    item_id: str
    department: Department
    item_name: str
    pack_size: str
    quantity: int = Field(gt=0)
    receipt_date: str
    lot_number: str
    expiry_date: str
    manufacturer: str
    supplier: str
    program: str


class StockBatchIn(BaseModel):
    items: List[StockEntryIn]


class IssueIn(BaseModel):
    item_id: str
    department: Department
    item_name: str
    pack_size: str
    expiry_date: str
    quantity: int = Field(gt=0)
    issued_section: str
    issue_date: Optional[str] = None
    program: Optional[str] = ""
    lot_number: Optional[str] = ""


class IssueBatchIn(BaseModel):
    items: List[IssueIn]


# ============================================================
# AUTH
# ============================================================

@api.post("/auth/login")
async def login(
    body: LoginBody,
    response: Response
):

    email = body.email.lower()

    user = await db.users.find_one({
        "email": email
    })

    if not user or not verify_password(
        body.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(
        user["id"],
        user["email"],
        user["role"]
    )

    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=43200,
        path="/"
    )

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "token": token
    }


@api.get("/auth/me")
async def me(
    user: dict = Depends(get_current_user)
):
    return user


@api.post("/auth/logout")
async def logout(
    response: Response
):

    response.delete_cookie(
        "access_token",
        path="/"
    )

    return {"ok": True}


# ============================================================
# ITEMS
# ============================================================

@api.get("/items")
async def list_items(
    department: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    q = {}

    if department:
        q["department"] = department

    if search:
        q["name"] = {
            "$regex": search,
            "$options": "i"
        }

    docs = await db.items.find(
        q,
        {"_id": 0}
    ).sort(
        "name",
        1
    ).to_list(2000)

    return docs


@api.post("/items")
async def create_item(
    body: ItemIn,
    user: dict = Depends(require_admin)
):

    if body.department not in DEPARTMENTS:
        raise HTTPException(
            400,
            "Invalid department"
        )

    exists = await db.items.find_one({
        "department": body.department,
        "name": {
            "$regex": f"^{body.name}$",
            "$options": "i"
        },
        "pack_size": body.pack_size
    })

    if exists:
        raise HTTPException(
            400,
            "Item with same name and pack size already exists in this department"
        )

    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "pack_size": body.pack_size.strip(),
        "department": body.department,
        "created_at": _iso(
            datetime.now(timezone.utc)
        ),
    }

    await db.items.insert_one(doc)

    doc.pop("_id", None)

    return doc


@api.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    user: dict = Depends(require_admin)
):

    r = await db.items.delete_one({
        "id": item_id
    })

    if r.deleted_count == 0:
        raise HTTPException(
            404,
            "Not found"
        )

    return {"ok": True}


# ============================================================
# META
# ============================================================

@api.get("/meta/{field}")
async def meta_field(
    field: str,
    user: dict = Depends(get_current_user)
):

    if field not in (
        "manufacturers",
        "suppliers",
        "programs",
        "sections"
    ):
        raise HTTPException(
            400,
            "Invalid field"
        )

    src_field = {
        "manufacturers": "manufacturer",
        "suppliers": "supplier",
        "programs": "program",
        "sections": "issued_section"
    }[field]

    coll = (
        db.issues
        if field == "sections"
        else db.stock_entries
    )

    vals = await coll.distinct(
        src_field
    )

    return sorted([
        v for v in vals if v
    ])



# ============================================================
# STOCK ENTRIES
# ============================================================

# ============================================================
# SINGLE STOCK ENTRY
# ============================================================

@api.post("/stock")
async def create_stock(
    body: StockEntryIn,
    user: dict = Depends(get_current_user)
):
    # Check that the item exists in Items Master
    item = await db.items.find_one({
        "id": body.item_id
    })

    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Item not found: {body.item_name}"
        )

    # Convert Pydantic model to dictionary
    doc = body.model_dump()

    # Generate unique stock-entry ID
    doc["id"] = str(uuid.uuid4())

    # Convert dates to ISO format
    doc["receipt_date"] = _iso(
        _parse_date(doc["receipt_date"])
    )

    doc["expiry_date"] = _iso(
        _parse_date(doc["expiry_date"])
    )

    # Created information
    doc["created_at"] = _iso(
        datetime.now(timezone.utc)
    )

    doc["created_by"] = user["email"]

    # Save stock entry
    await db.stock_entries.insert_one(doc)

    # Remove MongoDB internal ID before returning
    doc.pop("_id", None)

    return doc


# ============================================================
# BATCH STOCK ENTRY
# ============================================================

@api.post("/stock/batch")
async def create_stock_batch(
    body: StockBatchIn,
    user: dict = Depends(get_current_user)
):
    docs = []

    for entry in body.items:

        # Check that item exists
        item = await db.items.find_one({
            "id": entry.item_id
        })

        if not item:
            raise HTTPException(
                status_code=404,
                detail=f"Item not found: {entry.item_name}"
            )

        doc = entry.model_dump()

        doc["id"] = str(uuid.uuid4())

        doc["receipt_date"] = _iso(
            _parse_date(doc["receipt_date"])
        )

        doc["expiry_date"] = _iso(
            _parse_date(doc["expiry_date"])
        )

        doc["created_at"] = _iso(
            datetime.now(timezone.utc)
        )

        doc["created_by"] = user["email"]

        docs.append(doc)

    if docs:
        await db.stock_entries.insert_many(docs)

    for doc in docs:
        doc.pop("_id", None)

    return docs


# ============================================================
# GET STOCK ENTRIES
# ============================================================

@api.get("/stock")
async def get_stock(
    department: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}

    if department:
        query["department"] = department

    if program:
        query["program"] = program

    if search:
        query["$or"] = [
            {
                "item_name": {
                    "$regex": search,
                    "$options": "i"
                }
            },
            {
                "lot_number": {
                    "$regex": search,
                    "$options": "i"
                }
            },
            {
                "manufacturer": {
                    "$regex": search,
                    "$options": "i"
                }
            },
            {
                "supplier": {
                    "$regex": search,
                    "$options": "i"
                }
            }
        ]

    if from_date:
        query.setdefault("receipt_date", {})
        query["receipt_date"]["$gte"] = from_date

    if to_date:
        query.setdefault("receipt_date", {})
        query["receipt_date"]["$lte"] = to_date

    entries = await db.stock_entries.find(
        query,
        {"_id": 0}
    ).sort(
        "receipt_date",
        -1
    ).to_list(10000)

    return entries


# ============================================================
# NEVER STOCK ENTERED
# IMPORTANT:
# THIS MUST COME BEFORE /stock/{sid}
# ============================================================

async def _never_stocked_items(
    department: Optional[str] = None
):
    item_filter = {}

    if department:
        item_filter["department"] = department

    items = await db.items.find(
        item_filter,
        {"_id": 0}
    ).sort(
        "name",
        1
    ).to_list(10000)

    stock_filter = {}

    if department:
        stock_filter["department"] = department

    stocked_item_ids = await db.stock_entries.distinct(
        "item_id",
        stock_filter
    )

    stocked_item_ids = set(stocked_item_ids)

    result = []

    for item in items:

        item_id = item.get("id")

        if item_id not in stocked_item_ids:

            result.append({
                "id": item_id,
                "department": item.get(
                    "department",
                    ""
                ),
                "item_name": item.get(
                    "name",
                    ""
                ),
                "pack_size": item.get(
                    "pack_size",
                    ""
                )
            })

    return result


@api.get("/stock/never-entered")
async def stock_never_entered(
    department: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    return await _never_stocked_items(
        department
    )


# ============================================================
# DELETE STOCK ENTRY
# IMPORTANT:
# THIS MUST COME AFTER /stock/never-entered
# ============================================================

@api.delete("/stock/{sid}")
async def del_stock(
    sid: str,
    user: dict = Depends(require_admin)
):
    result = await db.stock_entries.delete_one({
        "id": sid
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Not found"
        )

    return {
        "ok": True
    }

# ============================================================
# ISSUES
# ============================================================

async def _check_issue_stock(
    body: IssueIn
):

    received = await db.stock_entries.aggregate([
        {
            "$match": {
                "item_id": body.item_id,
                "lot_number": body.lot_number,
                "expiry_date": _iso(
                    _parse_date(body.expiry_date)
                )
            }
        },
        {
            "$group": {
                "_id": None,
                "qty": {
                    "$sum": "$quantity"
                }
            }
        }
    ]).to_list(1)

    issued = await db.issues.aggregate([
        {
            "$match": {
                "item_id": body.item_id,
                "lot_number": body.lot_number,
                "expiry_date": _iso(
                    _parse_date(body.expiry_date)
                )
            }
        },
        {
            "$group": {
                "_id": None,
                "qty": {
                    "$sum": "$quantity"
                }
            }
        }
    ]).to_list(1)

    received_qty = (
        received[0]["qty"]
        if received
        else 0
    )

    issued_qty = (
        issued[0]["qty"]
        if issued
        else 0
    )

    available = received_qty - issued_qty

    if available < body.quantity:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Stock not available. "
                f"Available balance: {available}"
            )
        )


@api.post("/issues")
async def create_issue(
    body: IssueIn,
    user: dict = Depends(get_current_user)
):

    item = await db.items.find_one({
        "id": body.item_id
    })

    if not item:
        raise HTTPException(
            404,
            "Item not found"
        )

    # Check available stock
    await _check_issue_stock(body)

    doc = body.model_dump()

    doc["id"] = str(uuid.uuid4())

    doc["expiry_date"] = _iso(
        _parse_date(doc["expiry_date"])
    )

    doc["issue_date"] = (
        _iso(
            _parse_date(doc["issue_date"])
        )
        if doc.get("issue_date")
        else _iso(
            datetime.now(timezone.utc)
        )
    )

    doc["created_at"] = _iso(
        datetime.now(timezone.utc)
    )

    doc["created_by"] = user["email"]

    await db.issues.insert_one(doc)

    doc.pop("_id", None)

    return doc


@api.get("/issues")
async def list_issues(
    department: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    program: Optional[str] = None,
    section: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    q = {}

    if department:
        q["department"] = department

    if search:
        q["item_name"] = {
            "$regex": search,
            "$options": "i"
        }

    if program:
        q["program"] = program

    if section:
        q["issued_section"] = section

    if from_date or to_date:

        r = {}

        if from_date:
            r["$gte"] = _iso(
                _parse_date(from_date)
            )

        if to_date:
            r["$lte"] = _iso(
                _parse_date(to_date)
                + timedelta(days=1)
            )

        q["issue_date"] = r

    docs = await db.issues.find(
        q,
        {"_id": 0}
    ).sort(
        "issue_date",
        -1
    ).to_list(5000)

    return docs


@api.post("/issues/batch")
async def create_issue_batch(
    body: IssueBatchIn,
    user: dict = Depends(get_current_user)
):

    created = []

    for it in body.items:

        item = await db.items.find_one({
            "id": it.item_id
        })

        if not item:
            raise HTTPException(
                404,
                f"Item not found: {it.item_name}"
            )

        doc = it.model_dump()

        doc["id"] = str(uuid.uuid4())

        doc["expiry_date"] = _iso(
            _parse_date(doc["expiry_date"])
        )

        doc["issue_date"] = (
            _iso(
                _parse_date(doc["issue_date"])
            )
            if doc.get("issue_date")
            else _iso(
                datetime.now(timezone.utc)
            )
        )

        doc["created_at"] = _iso(
            datetime.now(timezone.utc)
        )

        doc["created_by"] = user["email"]

        await db.issues.insert_one(doc)

        doc.pop("_id", None)

        created.append(doc)

    return {
        "created": len(created),
        "items": created
    }


@api.delete("/issues/{iid}")
async def del_issue(
    iid: str,
    user: dict = Depends(require_admin)
):

    r = await db.issues.delete_one({
        "id": iid
    })

    if r.deleted_count == 0:
        raise HTTPException(
            404,
            "Not found"
        )

    return {"ok": True}


# ============================================================
# CURRENT STOCK
# ============================================================

async def _current_stock_rows(
    department: Optional[str] = None,
    program: Optional[str] = None
):

    q = {}

    if department:
        q["department"] = department

    if program:
        q["program"] = program

    entries = await db.stock_entries.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    q2 = {}

    if department:
        q2["department"] = department

    if program:
        q2["program"] = program

    issues = await db.issues.find(
        q2,
        {"_id": 0}
    ).to_list(20000)

    balances = {}

    for e in entries:

        k = (
            e["department"],
            e["item_name"],
            e["pack_size"],
            e["expiry_date"],
            e.get("lot_number", ""),
            e.get("manufacturer", ""),
            e.get("supplier", ""),
            e.get("program", "")
        )

        b = balances.setdefault(
            k,
            {
                "received": 0,
                "issued": 0
            }
        )

        b["received"] += int(
            e["quantity"]
        )

    issue_map = {}

    for i in issues:

        k = (
            i["department"],
            i["item_name"],
            i["pack_size"],
            i["expiry_date"]
        )

        issue_map[k] = (
            issue_map.get(k, 0)
            + int(i["quantity"])
        )

    for k, qty in issue_map.items():

        matches = [
            rk
            for rk in balances
            if rk[:4] == k
        ]

        matches.sort()

        remaining = qty

        for rk in matches:

            avail = (
                balances[rk]["received"]
                - balances[rk]["issued"]
            )

            take = min(
                avail,
                remaining
            )

            balances[rk]["issued"] += take

            remaining -= take

            if remaining <= 0:
                break

        if remaining > 0 and matches:

            balances[
                matches[0]
            ]["issued"] += remaining

    rows = []

    for k, v in balances.items():

        (
            dep,
            name,
            pack,
            exp,
            lot,
            mfr,
            sup,
            prog
        ) = k

        rows.append({
            "department": dep,
            "item_name": name,
            "pack_size": pack,
            "expiry_date": exp,
            "lot_number": lot,
            "manufacturer": mfr,
            "supplier": sup,
            "program": prog,
            "received": v["received"],
            "issued": v["issued"],
            "balance": (
                v["received"]
                - v["issued"]
            ),
        })

    rows.sort(
        key=lambda r: (
            r["department"],
            r["item_name"],
            r["expiry_date"]
        )
    )

    return rows


@api.get("/reports/current-stock")
async def current_stock(
    department: Optional[str] = None,
    search: Optional[str] = None,
    program: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    rows = await _current_stock_rows(
        department,
        program
    )

    if search:

        s = search.lower()

        rows = [
            r for r in rows
            if s in r["item_name"].lower()
        ]

    return rows


# ============================================================
# SHORT EXPIRY
# ============================================================

@api.get("/reports/short-expiry")
async def short_expiry(
    days: int = 90,
    department: Optional[str] = None,
    program: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    rows = await _current_stock_rows(
        department,
        program
    )

    now = datetime.now(timezone.utc)

    cutoff = now + timedelta(
        days=days
    )

    grouped = {}

    for r in rows:

        key = (
            r["department"],
            r["item_name"],
            r["pack_size"]
        )

        if key not in grouped:

            grouped[key] = {
                "rows": [],
                "total_balance": 0
            }

        if r["balance"] > 0:

            grouped[key]["rows"].append(r)

            grouped[key]["total_balance"] += (
                r["balance"]
            )

    out = []

    for key, data in grouped.items():

        if search and search.lower() not in key[1].lower():
            continue

        available_rows = data["rows"]

        if not available_rows:
            continue

        has_sufficient_expiry_stock = False

        short_expiry_rows = []

        for r in available_rows:

            exp = _parse_date(
                r["expiry_date"]
            )

            if exp <= cutoff:

                short_expiry_rows.append(r)

            else:

                has_sufficient_expiry_stock = True

        if has_sufficient_expiry_stock:
            continue

        for r in short_expiry_rows:

            r2 = dict(r)

            exp = _parse_date(
                r["expiry_date"]
            )

            r2["days_to_expiry"] = (
                exp - now
            ).days

            out.append(r2)

    out.sort(
        key=lambda x: x["days_to_expiry"]
    )

    return out


# ============================================================
# MONTHLY UTILISATION
# ============================================================

async def _utilisation_by_month(
    department: Optional[str] = None
):

    q = (
        {"department": department}
        if department
        else {}
    )

    issues = await db.issues.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    data = {}

    for i in issues:

        d = _parse_date(
            i["issue_date"]
        )

        m = d.strftime("%Y-%m")

        k = (
            i["department"],
            i["item_name"],
            i["pack_size"]
        )

        row = data.setdefault(
            k,
            {}
        )

        row[m] = (
            row.get(m, 0)
            + int(i["quantity"])
        )

    return data


@api.get("/reports/monthly-utilisation")
async def monthly_util(
    year: Optional[int] = None,
    department: Optional[str] = None,
    program: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    year = (
        year
        or datetime.now(timezone.utc).year
    )

    q = {}

    if department:
        q["department"] = department

    if program:
        q["program"] = program

    issues = await db.issues.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    data = {}

    for i in issues:

        d = _parse_date(
            i["issue_date"]
        )

        m = d.strftime("%Y-%m")

        k = (
            i["department"],
            i["item_name"],
            i["pack_size"]
        )

        row = data.setdefault(
            k,
            {}
        )

        row[m] = (
            row.get(m, 0)
            + int(i["quantity"])
        )

    result = []

    for (
        dep,
        name,
        pack
    ), months in data.items():

        if search and search.lower() not in name.lower():
            continue

        row = {
            "department": dep,
            "item_name": name,
            "pack_size": pack,
            "total": 0
        }

        for m in range(1, 13):

            key = f"{year}-{m:02d}"

            v = months.get(
                key,
                0
            )

            row[f"m{m}"] = v

            row["total"] += v

        if row["total"] > 0:
            result.append(row)

    result.sort(
        key=lambda r: (
            r["department"],
            r["item_name"]
        )
    )

    return result


# ============================================================
# INDENT NEXT YEAR
# ============================================================

@api.get("/reports/indent-next-year")
async def indent_next_year(
    department: Optional[str] = None,
    program: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    now = datetime.now(timezone.utc)

    start = now - timedelta(
        days=365
    )

    q = {
        "issue_date": {
            "$gte": _iso(start)
        }
    }

    if department:
        q["department"] = department

    if program:
        q["program"] = program

    issues = await db.issues.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    agg = {}

    for i in issues:

        k = (
            i["department"],
            i["item_name"],
            i["pack_size"]
        )

        agg[k] = (
            agg.get(k, 0)
            + int(i["quantity"])
        )

    rows = []

    for (
        dep,
        name,
        pack
    ), total in agg.items():

        if search and search.lower() not in name.lower():
            continue

        rows.append({
            "department": dep,
            "item_name": name,
            "pack_size": pack,
            "yearly_utilisation": total,
            "avg_monthly": round(
                total / 12,
                2
            ),
            "indent_next_year": total,
        })

    rows.sort(
        key=lambda r: (
            r["department"],
            -r["indent_next_year"]
        )
    )

    return rows


# ============================================================
# CRITICAL VALUE
# ============================================================

async def _critical_value(
    department: Optional[str] = None
):

    now = datetime.now(timezone.utc)

    start = now - timedelta(
        days=90
    )

    q = {
        "issue_date": {
            "$gte": _iso(start)
        }
    }

    if department:
        q["department"] = department

    issues = await db.issues.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    agg = {}

    for i in issues:

        k = (
            i["department"],
            i["item_name"],
            i["pack_size"]
        )

        agg[k] = (
            agg.get(k, 0)
            + int(i["quantity"])
        )

    return agg


# ============================================================
# LOW STOCK
# ============================================================

@api.get("/reports/low-stock")
async def low_stock(
    department: Optional[str] = None,
    program: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    cv = await _critical_value(
        department
    )

    rows = await _current_stock_rows(
        department,
        program
    )

    balances = {}

    for r in rows:

        k = (
            r["department"],
            r["item_name"],
            r["pack_size"]
        )

        balances[k] = (
            balances.get(k, 0)
            + r["balance"]
        )

    out = []

    for k, bal in balances.items():

        c = cv.get(
            k,
            0
        )

        if search and search.lower() not in k[1].lower():
            continue

        if (
            c > 0
            and bal > 0
            and c >= bal
        ):

            out.append({
                "department": k[0],
                "item_name": k[1],
                "pack_size": k[2],
                "balance": bal,
                "critical_value": c
            })

    out.sort(
        key=lambda r: (
            r["department"],
            r["item_name"]
        )
    )

    return out


# ============================================================
# NIL STOCK
# ============================================================

@api.get("/reports/nil-stock")
async def nil_stock(
    department: Optional[str] = None,
    program: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    rows = await _current_stock_rows(
        department,
        program
    )

    balances = {}

    for r in rows:

        k = (
            r["department"],
            r["item_name"],
            r["pack_size"]
        )

        balances[k] = (
            balances.get(k, 0)
            + r["balance"]
        )

    out = []

    for k, b in balances.items():

        if b > 0:
            continue

        if search and search.lower() not in k[1].lower():
            continue

        out.append({
            "department": k[0],
            "item_name": k[1],
            "pack_size": k[2],
            "balance": b
        })

    out.sort(
        key=lambda r: (
            r["department"],
            r["item_name"]
        )
    )

    return out


# ============================================================
# SUPPLY ORDER
# ============================================================

@api.get("/reports/supply-order")
async def supply_order(
    department: Optional[str] = None,
    program: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    low = await low_stock(
        department,
        program,
        search,
        user
    )

    nil = await nil_stock(
        department,
        program,
        search,
        user
    )

    short = await short_expiry(
        90,
        department,
        program,
        search,
        user
    )

    seen = {}

    def key(x):
        return (
            x["department"],
            x["item_name"],
            x["pack_size"]
        )

    for r in nil:

        k = key(r)

        seen[k] = {
            "department": r["department"],
            "item_name": r["item_name"],
            "pack_size": r["pack_size"],
            "balance": r["balance"],
            "critical_value": 0,
            "reasons": ["NIL Stock"]
        }

    for r in low:

        k = key(r)

        if k in seen:

            if "Low Stock" not in seen[k]["reasons"]:
                seen[k]["reasons"].append(
                    "Low Stock"
                )

            seen[k]["critical_value"] = (
                r["critical_value"]
            )

        else:

            seen[k] = {
                "department": r["department"],
                "item_name": r["item_name"],
                "pack_size": r["pack_size"],
                "balance": r["balance"],
                "critical_value": r["critical_value"],
                "reasons": ["Low Stock"]
            }

    for r in short:

        k = key(r)

        if k in seen:

            if "Short Expiry" not in seen[k]["reasons"]:
                seen[k]["reasons"].append(
                    "Short Expiry"
                )

        else:

            seen[k] = {
                "department": r["department"],
                "item_name": r["item_name"],
                "pack_size": r["pack_size"],
                "balance": r.get(
                    "balance",
                    0
                ),
                "critical_value": 0,
                "reasons": ["Short Expiry"]
            }

    out = list(
        seen.values()
    )

    out.sort(
        key=lambda r: (
            r["department"],
            r["item_name"]
        )
    )

    return out


# ============================================================
# PROGRAM CONSUMPTION
# ============================================================

@api.get("/reports/program-consumption")
async def program_consumption(
    department: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    q = (
        {"department": department}
        if department
        else {}
    )

    issues = await db.issues.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    entries = await db.stock_entries.find(
        q,
        {"_id": 0}
    ).to_list(20000)

    entry_prog = {
        (
            e["department"],
            e["item_name"],
            e["pack_size"],
            e["expiry_date"]
        ): e.get(
            "program",
            ""
        )
        for e in entries
    }

    prog_totals = {}

    for i in issues:

        prog = (
            i.get("program")
            or entry_prog.get(
                (
                    i["department"],
                    i["item_name"],
                    i["pack_size"],
                    i["expiry_date"]
                ),
                "Unassigned"
            )
            or "Unassigned"
        )

        prog_totals[prog] = (
            prog_totals.get(prog, 0)
            + int(i["quantity"])
        )

    return [
        {
            "program": k,
            "total_issued": v
        }
        for k, v in sorted(
            prog_totals.items(),
            key=lambda x: -x[1]
        )
    ]


# ============================================================
# DASHBOARD
# ============================================================

@api.get("/reports/dashboard")
async def dashboard(
    user: dict = Depends(get_current_user)
):

    rows = await _current_stock_rows()

    total_items = await db.items.count_documents({})

    total_entries = await db.stock_entries.count_documents({})

    total_issues = await db.issues.count_documents({})

    total_balance = sum(
        r["balance"]
        for r in rows
        if r["balance"] > 0
    )

    low = await low_stock(
        None,
        None,
        None,
        user
    )

    nil = await nil_stock(
        None,
        None,
        None,
        user
    )

    short = await short_expiry(
        90,
        None,
        None,
        None,
        user
    )

    dept_balance = {
        "MDS": 0,
        "VPD": 0,
        "Media": 0
    }

    for r in rows:

        if (
            r["balance"] > 0
            and r["department"]
            in dept_balance
        ):

            dept_balance[
                r["department"]
            ] += r["balance"]

    return {
        "total_items": total_items,
        "total_entries": total_entries,
        "total_issues": total_issues,
        "total_balance": total_balance,
        "low_stock_count": len(low),
        "nil_stock_count": len(nil),
        "short_expiry_count": len(short),
        "dept_balance": dept_balance,
    }


# ============================================================
# EXCEL EXPORT
# ============================================================

def _rows_to_xlsx(
    rows: List[dict],
    sheet_name: str = "Sheet1"
) -> bytes:

    wb = Workbook()

    ws = wb.active

    ws.title = (
        sheet_name[:31]
        or "Sheet1"
    )

    if rows:

        headers = list(
            rows[0].keys()
        )

        ws.append(headers)

        for r in rows:

            ws.append([
                r.get(h, "")
                for h in headers
            ])

    else:

        ws.append([
            "(no data)"
        ])

    buf = io.BytesIO()

    wb.save(buf)

    buf.seek(0)

    return buf.read()


@api.get("/export/{resource}")
async def export_xlsx(
    resource: str,
    department: Optional[str] = None,
    user: dict = Depends(get_current_user)
):

    # --------------------------------------------------------
    # Normal data exports
    # --------------------------------------------------------

    fetch_map = {

        "items": lambda: db.items.find(
            {
                "department": department
            }
            if department
            else {},
            {
                "_id": 0
            }
        ).sort(
            "name",
            1
        ).to_list(5000),

        "stock": lambda: db.stock_entries.find(
            {
                "department": department
            }
            if department
            else {},
            {
                "_id": 0
            }
        ).sort(
            "receipt_date",
            -1
        ).to_list(20000),

        "issues": lambda: db.issues.find(
            {
                "department": department
            }
            if department
            else {},
            {
                "_id": 0
            }
        ).sort(
            "issue_date",
            -1
        ).to_list(20000),

        # NEW:
        # Items in Items master which have NEVER
        # appeared in Stock Entry.
        "never-stocked": lambda: _never_stocked_items(
            department
        ),
    }

    # --------------------------------------------------------
    # Report exports
    # --------------------------------------------------------

    reports = {

        "current-stock":
            lambda: current_stock(
                department,
                None,
                None,
                user
            ),

        "monthly-utilisation":
            lambda: monthly_util(
                None,
                department,
                None,
                None,
                user
            ),

        "indent-next-year":
            lambda: indent_next_year(
                department,
                None,
                None,
                user
            ),

        "short-expiry":
            lambda: short_expiry(
                90,
                department,
                None,
                None,
                user
            ),

        "low-stock":
            lambda: low_stock(
                department,
                None,
                None,
                user
            ),

        "nil-stock":
            lambda: nil_stock(
                department,
                None,
                None,
                user
            ),

        "supply-order":
            lambda: supply_order(
                department,
                None,
                None,
                user
            ),
    }

    # --------------------------------------------------------
    # Select resource
    # --------------------------------------------------------

    if resource in fetch_map:

        rows = await fetch_map[
            resource
        ]()

    elif resource in reports:

        rows = await reports[
            resource
        ]()

    else:

        raise HTTPException(
            404,
            "Unknown resource"
        )

    # --------------------------------------------------------
    # Sanitize Excel values
    # --------------------------------------------------------

    clean = []

    for r in rows:

        cr = {}

        for k, v in r.items():

            if isinstance(v, list):

                v = ", ".join(
                    map(str, v)
                )

            cr[k] = v

        clean.append(cr)

    # --------------------------------------------------------
    # Create XLSX
    # --------------------------------------------------------

    data = _rows_to_xlsx(
        clean,
        resource
    )

    filename = f"{resource}.xlsx"

    return StreamingResponse(
        io.BytesIO(data),
        media_type=(
            "application/vnd."
            "openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                f'attachment; filename="{filename}"'
        }
    )


# ============================================================
# IMPORT ITEMS
# ============================================================

@api.post("/import/items")
async def import_items(
    department: Department,
    file: UploadFile = File(...),
    user: dict = Depends(require_admin)
):

    if department not in DEPARTMENTS:

        raise HTTPException(
            400,
            "Invalid department"
        )

    content = await file.read()

    try:

        wb = load_workbook(
            io.BytesIO(content),
            data_only=True
        )

    except Exception as e:

        raise HTTPException(
            400,
            f"Invalid xlsx: {e}"
        )

    ws = wb.active

    rows = list(
        ws.iter_rows(
            values_only=True
        )
    )

    if not rows:

        return {
            "inserted": 0,
            "skipped": 0
        }

    headers = [
        str(h).strip().lower()
        if h
        else ""
        for h in rows[0]
    ]

    if (
        "name" not in headers
        or "pack_size" not in headers
    ):

        raise HTTPException(
            400,
            "Excel must have 'name' and 'pack_size' columns"
        )

    ni = headers.index(
        "name"
    )

    pi = headers.index(
        "pack_size"
    )

    inserted = 0
    skipped = 0

    for r in rows[1:]:

        if (
            not r
            or r[ni] is None
        ):
            continue

        name = str(
            r[ni]
        ).strip()

        pack = (
            str(r[pi]).strip()
            if r[pi] is not None
            else ""
        )

        if not name:
            continue

        exists = await db.items.find_one({
            "department": department,
            "name": {
                "$regex": f"^{name}$",
                "$options": "i"
            },
            "pack_size": pack
        })

        if exists:

            skipped += 1

            continue

        await db.items.insert_one({
            "id": str(uuid.uuid4()),
            "name": name,
            "pack_size": pack,
            "department": department,
            "created_at": _iso(
                datetime.now(timezone.utc)
            )
        })

        inserted += 1

    return {
        "inserted": inserted,
        "skipped": skipped
    }


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup():

    await db.users.create_index(
        "email",
        unique=True
    )

    await db.items.create_index([
        ("department", 1),
        ("name", 1)
    ])

    await db.stock_entries.create_index([
        ("department", 1),
        ("item_name", 1)
    ])

    await db.issues.create_index([
        ("department", 1),
        ("item_name", 1)
    ])

    async def _seed(
        email_env,
        pw_env,
        name,
        role
    ):

        email = os.environ.get(
            email_env,
            ""
        ).lower()

        pwd = os.environ.get(
            pw_env,
            ""
        )

        if not email or not pwd:
            return

        existing = await db.users.find_one({
            "email": email
        })

        if existing is None:

            await db.users.insert_one({

                "id": str(uuid.uuid4()),

                "email": email,

                "name": name,

                "role": role,

                "password_hash":
                    hash_password(pwd),

                "created_at":
                    _iso(
                        datetime.now(
                            timezone.utc
                        )
                    ),
            })

            logger.info(
                "Seeded %s user %s",
                role,
                email
            )

        else:

            if not verify_password(
                pwd,
                existing["password_hash"]
            ):

                await db.users.update_one(
                    {
                        "email": email
                    },
                    {
                        "$set": {
                            "password_hash":
                                hash_password(pwd)
                        }
                    }
                )

                logger.info(
                    "Updated password for %s",
                    email
                )

    await _seed(
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "Administrator",
        "admin"
    )

    await _seed(
        "STAFF_EMAIL",
        "STAFF_PASSWORD",
        "Staff User",
        "staff"
    )


# ============================================================
# SHUTDOWN
# ============================================================

@app.on_event("shutdown")
async def shutdown():

    client.close()


# ============================================================
# ROUTERS
# ============================================================

app.include_router(api)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "https://stock-and-issue-tracker-frontend.onrender.com"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)
