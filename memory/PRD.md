# Stock & Issue Register — PRD

## Original problem
Build a register app to track stock and issue across 3 departments (MDS, VPD, Media) with items master, stock entry, issue, current stock, monthly utilisation, indent for next year, short expiry (90d), low stock (bal ≤ 3-month utilisation), NIL stock, and a consolidated supply order tab. Multi-user (Admin/Staff), Excel import/export.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor). JWT auth (httpOnly cookie + Bearer). `openpyxl` for Excel export/import.
- **Frontend**: React 19 + React Router + shadcn/ui + Tailwind + Recharts + Sonner. Font: Manrope + IBM Plex Sans.
- **Design theme**: Clinical Swiss & High-Contrast (deep-indigo #1E1B4B primary, flat surfaces, white bg).

## Users
- Admin (seeded): `admin@stockregister.com / admin123` — full CRUD, import.
- Staff (seeded): `staff@stockregister.com / staff123` — record stock entries + issues; no master edits.

## Implemented (2026-02)
- Auth (login/me/logout) with cookie + token fallback.
- Items master (MDS/VPD/Media) with add/delete/search + Excel import + export.
- Stock Entry (item typeahead, pack, qty, receipt date, lot, expiry, mfr/supplier/program autocomplete).
- Issue (item typeahead, expiry batch chooser from live balance, section, program).
- Current Stock report (lot-level balance).
- Monthly Utilisation (per year, 12-month matrix per item).
- Indent Next Year (avg × 12).
- Short Expiry (90d cut-off).
- Low Stock (bal ≤ 3-month utilisation).
- NIL Stock (bal = 0).
- Supply Order (union with reason badges).
- Program-wise consumption dashboard + department balance pie.
- Excel export for every table.

## Backlog (P1/P2)
- P1: Advanced filters on reports (multiple items).
- P2: Batch issue against multiple lots.
- P2: Email alerts for short-expiry.
- P2: Multi-org (tenant) support.
