"""Backend tests for stock register — iteration 2 bug-fix verification."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].strip().split("\n")[0]
BASE_URL = BASE_URL.rstrip("/")

ADMIN = {"email": "admin@stockregister.com", "password": "admin123"}
STAFF = {"email": "staff@stockregister.com", "password": "staff123"}

TAG = f"TEST_{uuid.uuid4().hex[:6]}"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(**ADMIN)


@pytest.fixture(scope="module")
def staff():
    return _login(**STAFF)


@pytest.fixture(scope="module")
def seed_data(admin):
    """Create item + 3 stock entries with different lots for multi-line batch issue testing."""
    item_name = f"{TAG}_Reagent"
    r = admin.post(f"{BASE_URL}/api/items", json={
        "name": item_name, "pack_size": "50ml", "department": "MDS"})
    assert r.status_code == 200, r.text
    item = r.json()

    item2_name = f"{TAG}_Buffer"
    r2 = admin.post(f"{BASE_URL}/api/items", json={
        "name": item2_name, "pack_size": "100ml", "department": "MDS"})
    assert r2.status_code == 200
    item2 = r2.json()

    lots_created = []
    for lot in ["LOTA", "LOTB", "LOTC"]:
        r = admin.post(f"{BASE_URL}/api/stock", json={
            "item_id": item["id"], "department": "MDS", "item_name": item_name,
            "pack_size": "50ml", "quantity": 20, "receipt_date": "2026-01-05",
            "lot_number": lot, "expiry_date": "2027-06-01",
            "manufacturer": "Acme", "supplier": "TestSup",
            "program": f"{TAG}_ProgZ"
        })
        assert r.status_code == 200, r.text
        lots_created.append(r.json())

    # A stock entry for item2
    r = admin.post(f"{BASE_URL}/api/stock", json={
        "item_id": item2["id"], "department": "MDS", "item_name": item2_name,
        "pack_size": "100ml", "quantity": 10, "receipt_date": "2026-01-05",
        "lot_number": "LOTX", "expiry_date": "2027-06-01",
        "manufacturer": "Acme", "supplier": "TestSup",
        "program": f"{TAG}_ProgZ"
    })
    assert r.status_code == 200
    lots_created.append(r.json())

    return {"item": item, "item2": item2, "stocks": lots_created}


# -------- Auth ---------
class TestAuth:
    def test_login_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_login_bad(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@stockregister.com", "password": "wrong"})
        assert r.status_code == 401


# -------- Dashboard regression (was crashing due to _critical_value truncation) ---------
class TestDashboard:
    def test_dashboard_200(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/dashboard")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_items", "total_entries", "total_issues", "total_balance",
                  "low_stock_count", "nil_stock_count", "short_expiry_count", "dept_balance"]:
            assert k in d


# -------- Delete endpoints ---------
class TestDeletes:
    def test_delete_item_admin(self, admin):
        r = admin.post(f"{BASE_URL}/api/items", json={
            "name": f"{TAG}_ToDel", "pack_size": "1", "department": "VPD"})
        iid = r.json()["id"]
        d = admin.delete(f"{BASE_URL}/api/items/{iid}")
        assert d.status_code == 200
        # verify gone
        lst = admin.get(f"{BASE_URL}/api/items", params={"department": "VPD"}).json()
        assert not any(x["id"] == iid for x in lst)

    def test_delete_item_staff_forbidden(self, admin, staff):
        r = admin.post(f"{BASE_URL}/api/items", json={
            "name": f"{TAG}_StaffCant", "pack_size": "1", "department": "VPD"})
        iid = r.json()["id"]
        d = staff.delete(f"{BASE_URL}/api/items/{iid}")
        assert d.status_code == 403
        admin.delete(f"{BASE_URL}/api/items/{iid}")

    def test_delete_stock(self, admin, seed_data):
        sid = seed_data["stocks"][0]["id"]
        # Create an extra to delete so we keep the seed intact
        r = admin.post(f"{BASE_URL}/api/stock", json={
            "item_id": seed_data["item"]["id"], "department": "MDS",
            "item_name": seed_data["item"]["name"], "pack_size": "50ml",
            "quantity": 5, "receipt_date": "2026-01-05", "lot_number": "TMPDEL",
            "expiry_date": "2027-06-01", "manufacturer": "Acme", "supplier": "X",
            "program": f"{TAG}_ProgZ"})
        newid = r.json()["id"]
        d = admin.delete(f"{BASE_URL}/api/stock/{newid}")
        assert d.status_code == 200
        # 404 second time
        assert admin.delete(f"{BASE_URL}/api/stock/{newid}").status_code == 404
        _ = sid  # unused


# -------- Multi-item batch issue ---------
class TestIssueBatch:
    def test_batch_issue_multi_lot_multi_item(self, admin, seed_data):
        item = seed_data["item"]; item2 = seed_data["item2"]
        payload = {"items": [
            {"item_id": item["id"], "department": "MDS", "item_name": item["name"],
             "pack_size": "50ml", "expiry_date": "2027-06-01", "quantity": 3,
             "issued_section": f"{TAG}_Sec", "issue_date": "2026-01-10",
             "program": f"{TAG}_ProgZ", "lot_number": "LOTA"},
            {"item_id": item["id"], "department": "MDS", "item_name": item["name"],
             "pack_size": "50ml", "expiry_date": "2027-06-01", "quantity": 4,
             "issued_section": f"{TAG}_Sec", "issue_date": "2026-01-10",
             "program": f"{TAG}_ProgZ", "lot_number": "LOTB"},
            {"item_id": item2["id"], "department": "MDS", "item_name": item2["name"],
             "pack_size": "100ml", "expiry_date": "2027-06-01", "quantity": 2,
             "issued_section": f"{TAG}_Sec", "issue_date": "2026-01-10",
             "program": f"{TAG}_ProgZ", "lot_number": "LOTX"},
        ]}
        r = admin.post(f"{BASE_URL}/api/issues/batch", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["created"] == 3
        # verify all 3 present in issues list
        iss = admin.get(f"{BASE_URL}/api/issues",
                        params={"department": "MDS", "search": TAG}).json()
        lots = [x["lot_number"] for x in iss if TAG in x["item_name"]]
        assert "LOTA" in lots and "LOTB" in lots and "LOTX" in lots


# -------- Program-wise filter on report endpoints ---------
class TestReportFilters:
    def test_current_stock_program_filter(self, admin, seed_data):
        r = admin.get(f"{BASE_URL}/api/reports/current-stock",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ"})
        assert r.status_code == 200
        rows = r.json()
        assert all(row["program"] == f"{TAG}_ProgZ" for row in rows)
        # search filter narrows to reagent
        r2 = admin.get(f"{BASE_URL}/api/reports/current-stock",
                       params={"department": "MDS", "program": f"{TAG}_ProgZ",
                               "search": f"{TAG}_Reagent"})
        rows2 = r2.json()
        assert rows2 and all(f"{TAG}_Reagent" in row["item_name"] for row in rows2)

    def test_monthly_util_filters(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/monthly-utilisation",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ",
                              "search": TAG, "year": 2026})
        assert r.status_code == 200
        for row in r.json():
            assert TAG in row["item_name"]

    def test_indent_next_year_filters(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/indent-next-year",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ", "search": TAG})
        assert r.status_code == 200

    def test_short_expiry_filters(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/short-expiry",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ", "days": 3650})
        assert r.status_code == 200

    def test_low_stock_filters(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/low-stock",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ"})
        assert r.status_code == 200
        # critical_value key present when returned
        for row in r.json():
            assert "critical_value" in row

    def test_nil_stock_filters(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/nil-stock",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ"})
        assert r.status_code == 200

    def test_supply_order_filters(self, admin):
        r = admin.get(f"{BASE_URL}/api/reports/supply-order",
                      params={"department": "MDS", "program": f"{TAG}_ProgZ"})
        assert r.status_code == 200


# -------- Issue list program/section filter ---------
class TestIssueListFilters:
    def test_program_filter(self, admin):
        r = admin.get(f"{BASE_URL}/api/issues",
                      params={"program": f"{TAG}_ProgZ"})
        assert r.status_code == 200
        for row in r.json():
            assert row.get("program") == f"{TAG}_ProgZ"

    def test_section_filter(self, admin):
        r = admin.get(f"{BASE_URL}/api/issues",
                      params={"section": f"{TAG}_Sec"})
        assert r.status_code == 200
        for row in r.json():
            assert row.get("issued_section") == f"{TAG}_Sec"


# -------- cleanup ---------
def test_zzz_cleanup(admin):
    # Delete all TEST_-prefixed items to keep DB clean.
    for dep in ("MDS", "VPD", "Media"):
        items = admin.get(f"{BASE_URL}/api/items", params={"department": dep, "search": TAG}).json()
        for it in items:
            admin.delete(f"{BASE_URL}/api/items/{it['id']}")
    for st in admin.get(f"{BASE_URL}/api/stock", params={"search": TAG}).json():
        admin.delete(f"{BASE_URL}/api/stock/{st['id']}")
    for iss in admin.get(f"{BASE_URL}/api/issues", params={"search": TAG}).json():
        admin.delete(f"{BASE_URL}/api/issues/{iss['id']}")
