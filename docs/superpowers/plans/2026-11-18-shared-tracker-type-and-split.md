# Shared tracker: row type + split-and-propagate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the shared tracker editor label each row as a bill/expense/income/installment, split its amount across chosen people, and have marking it Paid create (and marking it Unpaid remove) a real record in that type's own table — so it shows up on the normal pages and the Dashboard/Summary exactly like a manually entered one.

**Architecture:** Three new nullable columns on `SharedTrackerRow` (`row_type`, `due_day`, `total_terms`, `linked_master_id`) and four on `SharedTrackerEntry` (`participants`, `participant_amounts`, `linked_record_type`, `linked_record_id`). A new module, `shared_tracker_propagation.py`, holds three functions (`propagate_paid`, `reverse_paid`, `sync_paid`) that create/delete/update the matching Income/Expense/Bill+BillPayment/Installment+InstallmentPayment record. `shared_tracker.py`'s existing `_update_entry` calls them on the relevant state transition. The frontend adds a type dropdown and a reused `ParticipantsEditor` split picker to the existing row card.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), React + TanStack Query (frontend), Postgres (Supabase) dev database.

**Spec:** `docs/superpowers/specs/2026-11-18-shared-tracker-type-and-split-design.md`

## Global Constraints

- Manual settlement only: propagation never creates `*ParticipantSettlement` rows.
- Both the authenticated and the public share-link PATCH routes call the same `_update_entry`, so a viewer can trigger propagation exactly like the owner — no separate viewer/editor branch.
- `participants`/`participant_amounts` live on `SharedTrackerEntry` (per month), never on `SharedTrackerRow` — editing a split must never rewrite an already-paid prior month's real record.
- Income/Expense `period` is an integer code; use `1`, never a string.
- `row_type` is immutable once the row has any paid history (`linked_master_id` set, or any entry with `linked_record_id` set) — enforced with a 400.
- Toggling Unpaid reverses propagation (deletes the linked record / that month's payment row, undoes `terms_paid`/`status`) so repeated toggling never leaves duplicates.
- Editing amount/participants/participant_amounts while an entry is already `"paid"` updates the existing linked record in place; it never creates a second one.
- A row with `row_type == None` behaves exactly as today when toggled Paid (no propagation at all).

## Review Focus

- Toggling Paid → Unpaid → Paid → Unpaid on the same month must never leave more than one linked record behind, and must leave none behind at the end.
- Marking Paid on a bill row with no `due_day` set (or an installment row with no `total_terms` set) must fail with a clean 400, not a 500 from a missing required column.
- Marking Paid on a row with `row_type` still `None` must be a true no-op — no record created, no error.
- Unpaying an installment-type entry must decrement `terms_paid` and flip `status` back to `"active"` when it drops below `total_terms`, not just delete the payment row.
- Editing an entry's amount while it's already linked and paid must update the existing linked record (`Income`/`Expense` row or `BillPayment.amount_paid`), never create a second one for the same month.

---

## Task 1: Data model — migration, models, schemas

**Files:**
- Create: `backend/alembic/versions/f7a2c9e4b1d8_shared_tracker_type_and_split.py`
- Modify: `backend/app/models/shared_tracker.py`
- Modify: `backend/app/schemas/shared_tracker.py`

**Interfaces:**
- Produces: `SharedTrackerRow.row_type: str | None`, `.due_day: int | None`, `.total_terms: int | None`, `.linked_master_id: int | None`; `SharedTrackerEntry.participants: list[int]`, `.participant_amounts: dict`, `.linked_record_type: str | None`, `.linked_record_id: int | None`. These are consumed by every later task.

- [ ] **Step 1: Write the migration**

`revision = 'f7a2c9e4b1d8'`, `down_revision = 'b4e7f2c8a1d3'` (current head). `upgrade()` adds, via `op.add_column`: on `shared_tracker_rows` — `row_type` (`sa.String()`, nullable), `due_day` (`sa.Integer()`, nullable), `total_terms` (`sa.Integer()`, nullable), `linked_master_id` (`sa.Integer()`, nullable); on `shared_tracker_entries` — `participants` (`sa.JSON()`, nullable), `participant_amounts` (`sa.JSON()`, nullable), `linked_record_type` (`sa.String()`, nullable), `linked_record_id` (`sa.Integer()`, nullable). `downgrade()` drops all eight in reverse order. Follow the exact style of `backend/alembic/versions/b4e7f2c8a1d3_add_allowed_holders_to_shared_tracker.py`.

- [ ] **Step 2: Run the migration**

Run (from `backend/`): `alembic upgrade head`
Expected: prints `... -> f7a2c9e4b1d8, shared tracker type and split` (or similar) and exits 0.

- [ ] **Step 3: Add the columns to the models**

In `backend/app/models/shared_tracker.py`: add the four `SharedTrackerRow` columns and the four `SharedTrackerEntry` columns from the migration, matching types. `participants` defaults to `list`, `participant_amounts` defaults to `dict` (same convention as `Income.participants`/`Income.participant_amounts`).

- [ ] **Step 4: Add the fields to the schemas**

In `backend/app/schemas/shared_tracker.py`, add `from typing import Literal` and:
- `SharedTrackerRowCreate`/`SharedTrackerRowUpdate`: `row_type: Optional[Literal["bill", "expense", "income", "installment"]] = None`, `due_day: Optional[int] = None`, `total_terms: Optional[int] = None`.
- `SharedTrackerRowOut`: same three fields, plus `linked_master_id: Optional[int] = None`.
- `SharedTrackerEntryUpdate`: `participants: Optional[list[int]] = None`, `participant_amounts: Optional[dict] = None`.
- `SharedTrackerEntryOut`: `participants: list[int] = []`, `participant_amounts: dict = {}`, `linked_record_type: Optional[str] = None`, `linked_record_id: Optional[int] = None`.

- [ ] **Step 5: Manually verify the schema**

Run (from `backend/`):
```
python -c "from app.schemas.shared_tracker import SharedTrackerRowCreate as R; print(R(label='x', row_type='income').row_type)"
```
Expected: prints `income`.
Run:
```
python -c "from app.schemas.shared_tracker import SharedTrackerRowCreate as R; R(label='x', row_type='bogus')"
```
Expected: raises `pydantic.ValidationError` (confirms bad `row_type` values are rejected).

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/f7a2c9e4b1d8_shared_tracker_type_and_split.py backend/app/models/shared_tracker.py backend/app/schemas/shared_tracker.py
git commit -m "Add row type and split columns to shared tracker"
```

---

## Task 2: Propagation — income & expense

**Files:**
- Create: `backend/app/routers/shared_tracker_propagation.py`

**Interfaces:**
- Consumes: `SharedTrackerRow`/`SharedTrackerEntry` from Task 1 (`row.row_type`, `row.label`; `entry.month`, `.year`, `.amount`, `.participants`, `.participant_amounts`, `.linked_record_type`, `.linked_record_id`).
- Produces: `propagate_paid(db: Session, user_id: int, row: SharedTrackerRow, entry: SharedTrackerEntry) -> None`, `reverse_paid(db: Session, row: SharedTrackerRow, entry: SharedTrackerEntry) -> None`, `sync_paid(db: Session, entry: SharedTrackerEntry) -> None`. All three are a no-op when `row.row_type` is `None` (propagate) or `entry.linked_record_id` is `None` (reverse, sync). Tasks 3 and 4 extend these same three functions with `elif row.row_type == "bill"` / `"installment"` branches. The caller (Task 5) is responsible for committing entry field changes before calling these; each function commits its own writes.

- [ ] **Step 1: Implement `propagate_paid` for `"income"` and `"expense"`**

In `shared_tracker_propagation.py`, dispatch on `row.row_type`:
- `"income"`: create `Income(user_id=user_id, source=row.label, amount=entry.amount, date=date(entry.year, entry.month, 1), type="Other", period=1, month=entry.month, year=entry.year, participants=entry.participants or [], participant_amounts=entry.participant_amounts or {})`. Add, commit, refresh. Set `entry.linked_record_type = "income"`, `entry.linked_record_id = income.id`, commit.
- `"expense"`: create `Expense(user_id=user_id, name=row.label, amount=entry.amount, category=row.label, date=date(entry.year, entry.month, 1), period=1, month=entry.month, year=entry.year, participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {})`. Same linking (`linked_record_type = "expense"`).
- Anything else (`None`, `"bill"`, `"installment"` for now): `pass`.

- [ ] **Step 2: Implement `reverse_paid` and `sync_paid` for `"income"` and `"expense"`**

`reverse_paid`: if `entry.linked_record_type == "income"`, delete the `Income` row with id `entry.linked_record_id`; if `"expense"`, delete the `Expense` row. Either way clear `entry.linked_record_type = None`, `entry.linked_record_id = None`, commit.
`sync_paid`: if `entry.linked_record_type == "income"`, fetch that `Income` row and set `amount`, `participants`, `participant_amounts` from `entry`, commit. Same for `"expense"`.

- [ ] **Step 3: Manually verify against the dev database**

Write a throwaway script (don't commit it) at `backend/_verify_propagation.py` that, using `app.database.SessionLocal` directly:
1. Creates a `SharedTrackerRow(user_id=<your real user id>, label="Verify Income", row_type="income")` and a `SharedTrackerEntry(row_id=row.id, month=1, year=2027, amount=100, participants=[0])`.
2. Calls `propagate_paid(db, user_id, row, entry)`, then asserts a matching `Income` row exists with `amount == 100` and `source == "Verify Income"`.
3. Calls `sync_paid` after changing `entry.amount` to `150`, asserts the same `Income` row's amount is now `150` (not a second row).
4. Calls `reverse_paid`, asserts the `Income` row is gone and `entry.linked_record_id is None`.
5. Deletes the `SharedTrackerRow`/`SharedTrackerEntry` it created, prints `OK`.

Run: `python backend/_verify_propagation.py`
Expected: prints `OK` with no assertion errors. Delete the script afterward.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/shared_tracker_propagation.py
git commit -m "Add income/expense propagation for shared tracker rows"
```

---

## Task 3: Propagation — bill

**Files:**
- Modify: `backend/app/routers/shared_tracker_propagation.py`

**Interfaces:**
- Consumes: `row.due_day`, `row.linked_master_id` (Task 1); `propagate_paid`/`reverse_paid`/`sync_paid` signatures (Task 2).
- Produces: same three functions, now also handling `row.row_type == "bill"`; sets `row.linked_master_id` the first time a bill row is paid.

- [ ] **Step 1: Extend `propagate_paid` with the `"bill"` branch**

- If `row.due_day is None`: `raise HTTPException(status_code=400, detail="Set a due day before marking a bill row paid")`.
- If `row.linked_master_id is None`: create `Bill(user_id=user_id, name=row.label, due_day=row.due_day, category=row.label, start_month=entry.month, start_year=entry.year, participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {})`, add/commit/refresh, set `row.linked_master_id = bill.id`, commit.
- Query `BillPayment` for `(bill_id=row.linked_master_id, month=entry.month, year=entry.year)`. If found, set its `amount_paid = entry.amount`; else create `BillPayment(bill_id=row.linked_master_id, month=entry.month, year=entry.year, amount_paid=entry.amount)`, add. Commit, refresh.
- Set `entry.linked_record_type = "bill_payment"`, `entry.linked_record_id = payment.id`, commit.

- [ ] **Step 2: Extend `reverse_paid` and `sync_paid` with the `"bill_payment"` branch**

`reverse_paid`: if `entry.linked_record_type == "bill_payment"`, delete the `BillPayment` with id `entry.linked_record_id`, clear the entry's link fields, commit. (Leave the master `Bill` and `row.linked_master_id` in place.)
`sync_paid`: if `entry.linked_record_type == "bill_payment"`, fetch that `BillPayment` and set `amount_paid = entry.amount`, commit.

- [ ] **Step 3: Manually verify (due_day guard, master reuse, payment upsert, unpay)**

Extend (or rewrite) the Step-3 scratch script from Task 2 to also:
1. Create a `row_type="bill"` row with `due_day=None`; call `propagate_paid`; assert it raises `HTTPException` with `status_code == 400`.
2. Set `row.due_day = 5`; call `propagate_paid` for month 1/2027; assert a `Bill` row now exists (`due_day == 5`) and `row.linked_master_id` is set, and a `BillPayment` exists for that month with `amount_paid == entry.amount`.
3. Call `propagate_paid` again for month 2/2027 on the same row (new entry); assert `row.linked_master_id` is unchanged (same `Bill`, not a second one) and a second `BillPayment` now exists for month 2.
4. Call `reverse_paid` on the month-2 entry; assert that month's `BillPayment` is gone but the `Bill` row and `row.linked_master_id` still exist.
5. Clean up every row created, print `OK`.

Run: `python backend/_verify_propagation.py`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/shared_tracker_propagation.py
git commit -m "Add bill propagation for shared tracker rows"
```

---

## Task 4: Propagation — installment

**Files:**
- Modify: `backend/app/routers/shared_tracker_propagation.py`

**Interfaces:**
- Consumes: `row.total_terms`, `row.linked_master_id` (Task 1).
- Produces: same three functions, now also handling `row.row_type == "installment"`.

- [ ] **Step 1: Extend `propagate_paid` with the `"installment"` branch**

- If `row.total_terms is None`: `raise HTTPException(status_code=400, detail="Set the number of terms before marking an installment row paid")`.
- If `row.linked_master_id is None`: create `Installment(user_id=user_id, name=row.label, installment_amount=entry.amount or 0, total_terms=row.total_terms, start_month=entry.month, start_year=entry.year, participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {})`, add/commit/refresh, set `row.linked_master_id = inst.id`, commit.
- Fetch the `Installment` by `row.linked_master_id`. Create `InstallmentPayment(installment_id=row.linked_master_id, month=entry.month, year=entry.year)`, add. Increment `inst.terms_paid += 1`; if `inst.terms_paid >= inst.total_terms`, set `inst.status = "completed"`. Commit, refresh.
- Set `entry.linked_record_type = "installment_payment"`, `entry.linked_record_id = payment.id`, commit.

- [ ] **Step 2: Extend `reverse_paid` with the `"installment_payment"` branch**

If `entry.linked_record_type == "installment_payment"`: fetch the `InstallmentPayment` by `entry.linked_record_id` and its parent `Installment`; delete the payment; set `inst.terms_paid = max(0, inst.terms_paid - 1)`; if `inst.status == "completed"` and `inst.terms_paid < inst.total_terms`, set `inst.status = "active"`; clear the entry's link fields; commit. (`sync_paid` needs no `"installment_payment"` branch — `InstallmentPayment` has no amount field to sync.)

- [ ] **Step 3: Manually verify (total_terms guard, terms_paid/status increment and revert)**

Extend the scratch script to also:
1. Create a `row_type="installment"` row with `total_terms=None`; call `propagate_paid`; assert `HTTPException` with `status_code == 400`.
2. Set `row.total_terms = 2`; call `propagate_paid` for month 1; assert the `Installment` has `terms_paid == 1`, `status == "active"`.
3. Call `propagate_paid` again for month 2 (new entry, same row); assert `terms_paid == 2`, `status == "completed"`.
4. Call `reverse_paid` on the month-2 entry; assert `terms_paid == 1`, `status == "active"` again.
5. Clean up, print `OK`.

Run: `python backend/_verify_propagation.py`
Expected: `OK`. Delete the scratch script after this task.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/shared_tracker_propagation.py
git commit -m "Add installment propagation for shared tracker rows"
```

---

## Task 5: Wire propagation into the router

**Files:**
- Modify: `backend/app/routers/shared_tracker.py:28-62` (`_month_view`), `:92-110` (`_update_entry`), `:125-151` (`add_row`, `update_row`)

**Interfaces:**
- Consumes: `propagate_paid`, `reverse_paid`, `sync_paid` from `shared_tracker_propagation` (Tasks 2-4).
- Produces: `GET /shared-tracker`, `POST /shared-tracker/rows`, `PUT /shared-tracker/rows/{id}`, `PATCH /shared-tracker/entries/{id}` (and their public equivalents) now read/write `row_type`, `due_day`, `total_terms`, `participants`, `participant_amounts`, and trigger propagation on the relevant transitions.

- [ ] **Step 1: Carry `participants`/`participant_amounts` over month-to-month in `_month_view`**

In the "create this month's entry" block, add `participants=prev.participants if prev else [], participant_amounts=prev.participant_amounts if prev else {}` to the new `SharedTrackerEntry(...)`, alongside the existing `amount`/`held_by` carryover. Add `row_type=row.row_type, due_day=row.due_day, total_terms=row.total_terms, linked_master_id=row.linked_master_id` to the `SharedTrackerRowOut(...)` construction.

- [ ] **Step 2: Accept the new row fields in `add_row` and `update_row`**

`add_row`: pass `row_type=data.row_type, due_day=data.due_day, total_terms=data.total_terms` into the `SharedTrackerRow(...)` constructor; add the same three keys to the returned dict.
`update_row`: before the `setattr` loop, if `"row_type" in fields` and `fields["row_type"] != row.row_type`, check whether `row.linked_master_id is not None` or `db.query(SharedTrackerEntry).filter(SharedTrackerEntry.row_id == row.id, SharedTrackerEntry.linked_record_id.isnot(None)).first()` is truthy; if either, `raise HTTPException(status_code=400, detail="Can't change type after this row has paid history")`. Add `row_type`, `due_day`, `total_terms` to the returned dict.

- [ ] **Step 3: Call propagation from `_update_entry`**

Capture `old_state = entry.state` before the `setattr` loop. Always fetch `row = db.query(SharedTrackerRow).filter(SharedTrackerRow.id == entry.row_id).first()` (replacing the conditional fetch that currently only happens for the `held_by` check — reuse it there too). After the existing `db.commit(); db.refresh(entry)`:
```python
if "state" in fields and old_state != "paid" and entry.state == "paid":
    propagate_paid(db, user_id, row, entry)
elif "state" in fields and old_state == "paid" and entry.state != "paid":
    reverse_paid(db, row, entry)
elif entry.state == "paid" and fields.keys() & {"amount", "participants", "participant_amounts"}:
    sync_paid(db, entry)
```
`db.refresh(entry)` once more before returning, so the response reflects any `linked_record_id` set by propagation.

- [ ] **Step 4: Manually verify end-to-end (income, toggle cycle, type lock, untyped no-op)**

Start the backend (`cd backend && uvicorn app.main:app --reload`). Log in (`POST /auth/login`) to get a bearer token; use it as `Authorization: Bearer <token>` on everything below. Use `MONTH`/`YEAR` for the current period.

1. `POST /shared-tracker/rows` `{"label": "Verify Wiring", "row_type": "income"}` → 201, capture `row_id`.
2. `GET /shared-tracker?month=MONTH&year=YEAR` → find the row, capture `entry_id`.
3. `PATCH /shared-tracker/entries/{entry_id}` `{"amount": 100, "participants": [0], "state": "paid"}` → 200.
4. `GET /income?month=MONTH&year=YEAR` → a new row with `source: "Verify Wiring"`, `amount: 100`. Capture its `id`.
5. `PATCH /shared-tracker/entries/{entry_id}` `{"amount": 150}` → 200. Re-run step 4's GET → the **same** income id now shows `amount: 150` (not a second row).
6. `PATCH /shared-tracker/entries/{entry_id}` `{"state": "unpaid"}` → 200. Re-run step 4's GET → that income row is gone.
7. `PATCH /shared-tracker/entries/{entry_id}` `{"state": "paid"}` again → 200. Re-run step 4's GET → exactly one new income row again (not two).
8. `PUT /shared-tracker/rows/{row_id}` `{"row_type": "expense"}` → 400 (type is locked — this row has paid history).
9. `DELETE /shared-tracker/rows/{row_id}` to clean up (cascades the entry; manually `DELETE` the leftover income row from step 7 via `DELETE /income/{id}` if one exists).
10. `POST /shared-tracker/rows` `{"label": "Untyped"}` (no `row_type`) → capture `row_id`; `GET` for its entry; `PATCH` `{"state": "paid"}` → 200, no error, and `GET /income`/`GET /expenses` show nothing new. `DELETE` the row to clean up.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/shared_tracker.py
git commit -m "Wire propagation into the shared tracker entry/row endpoints"
```

---

## Task 6: Frontend — type dropdown and conditional fields

**Files:**
- Modify: `frontend/src/components/shared/SharedTrackerTable.jsx`
- Modify: `frontend/src/pages/SharedTracker.jsx`

**Interfaces:**
- Consumes: `row.row_type`, `row.due_day`, `row.total_terms`, `row.linked_master_id`, `row.entry.linked_record_id` (Task 5's API response).
- Produces: a new `onRowChange(rowId, data)` prop on `SharedTrackerTable`, wired in `SharedTracker.jsx` to the existing `rowMutation` (same pattern as `onAllowedHoldersChange`).

- [ ] **Step 1: Add `onRowChange` wiring in `SharedTracker.jsx`**

Add `onRowChange={(id, data) => rowMutation.mutate({ id, data })}` as a new prop passed to `<SharedTrackerTable>` (the existing `rowMutation` already handles arbitrary row field patches — no new mutation needed).

- [ ] **Step 2: Add the type dropdown and conditional inputs to `Row` in `SharedTrackerTable.jsx`**

Accept `onRowChange` as a new prop on `SharedTrackerTable`/`Row`. In the editor-only block (next to "Who can hold this"), add:
- A `<Select>` bound to `row.row_type ?? ''` with options `''` (blank), `'bill'`, `'expense'`, `'income'`, `'installment'`; `onChange` calls `onRowChange(row.id, { row_type: e.target.value || null })`. Compute `const typeLocked = row.linked_master_id != null || row.entry.linked_record_id != null` and set the `<Select>`'s `disabled` to `typeLocked`.
- When `row.row_type === 'bill'`: a small number `<Input>` labeled "Due day", bound to `row.due_day ?? ''`, `onBlur` calls `onRowChange(row.id, { due_day: val === '' ? null : parseInt(val) })`.
- When `row.row_type === 'installment'`: a small number `<Input>` labeled "Number of terms", bound to `row.total_terms ?? ''`, same `onRowChange` pattern with `total_terms`.

- [ ] **Step 3: Manually verify in the browser**

Start the frontend dev server (`cd frontend && npm run dev`) and the backend. Open the Shared Tracker page as the owner.
1. Confirm a new "Type" dropdown appears on each row, defaulting to blank.
2. Pick "Bill" on a row → confirm a "Due day" input appears; set a value, reload the page, confirm it persisted.
3. Pick "Installment" on another row → confirm "Number of terms" appears instead of "Due day".
4. Mark a typed row Paid, reload the page, confirm its Type dropdown is now disabled.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/SharedTrackerTable.jsx frontend/src/pages/SharedTracker.jsx
git commit -m "Add row type dropdown to the shared tracker editor"
```

---

## Task 7: Frontend — distribute-among picker

**Files:**
- Modify: `frontend/src/components/shared/SharedTrackerTable.jsx`

**Interfaces:**
- Consumes: `ParticipantsEditor` from `frontend/src/components/shared/ParticipantsEditor.jsx` (`participants`, `participantAmounts`, `onParticipantsChange`, `onAmountsChange`, `people`, `totalAmount` props); the existing `onEntryChange(entryId, data)` prop already wired to `entryMutation` in both `SharedTracker.jsx` and `PublicSharedTracker.jsx`.
- Produces: no new props — reuses `onEntryChange` for `participants`/`participant_amounts`, exactly like the existing `amount`/`notes` fields do.

- [ ] **Step 1: Add the picker to `Row` in `SharedTrackerTable.jsx`**

Import `ParticipantsEditor` and `ME_ID` from `@/components/shared/ParticipantsEditor`. In the editor-only block, when `row.row_type` is set (any of the four), render:
```jsx
<ParticipantsEditor
  participants={row.entry.participants || []}
  participantAmounts={row.entry.participant_amounts || {}}
  onParticipantsChange={(participants) => onEntryChange({ participants })}
  onAmountsChange={(participant_amounts) => onEntryChange({ participant_amounts })}
  people={people}
  totalAmount={row.entry.amount}
/>
```
(`onEntryChange` here is the `Row`-local callback already bound to `row.entry.id`, same as the existing amount/notes handlers — not a new prop.)

- [ ] **Step 2: Manually verify in the browser**

With both servers running: pick a type on a row, open its distribute picker, select two people (including "Me"), confirm the equal-split preview amount shown matches the row's amount divided by 2. Override one person's amount and confirm the "amounts add up" / mismatch indicator (already built into `ParticipantsEditor`) reacts correctly. Reload the page and confirm the selection persisted.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/SharedTrackerTable.jsx
git commit -m "Add distribute-among split picker to shared tracker rows"
```

---

## Task 8: End-to-end verification — bill, installment, and viewer-triggered propagation

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-7.

- [ ] **Step 1: Verify a bill-type row end-to-end through the API**

Using the same login/curl approach as Task 5 Step 4:
1. `POST /shared-tracker/rows` `{"label": "Verify Bill", "row_type": "bill", "due_day": 10}`.
2. Get its entry, `PATCH` `{"amount": 50, "state": "paid"}`.
3. `GET /bills` → a new `Bill` named "Verify Bill" with a `BillPayment` for the current month/year, `amount_paid: 50`.
4. `PATCH` the entry `{"state": "unpaid"}` → the `BillPayment` for that month is gone from the `Bill`'s `payments`, but the `Bill` itself still exists.
5. Clean up: `DELETE /shared-tracker/rows/{row_id}`, then `DELETE /bills/{bill_id}`.

- [ ] **Step 2: Verify an installment-type row end-to-end through the API**

1. `POST /shared-tracker/rows` `{"label": "Verify Installment", "row_type": "installment", "total_terms": 2}`.
2. Get its entry, `PATCH` `{"amount": 25, "state": "paid"}` → `GET /installments` shows a new `Installment` with `terms_paid: 1`, `status: "active"`.
3. Advance to next month (or use the row's next entry) and `PATCH` that entry `{"state": "paid"}` → `terms_paid: 2`, `status: "completed"`.
4. `PATCH` that second entry `{"state": "unpaid"}` → `terms_paid: 1`, `status: "active"` again.
5. Clean up: `DELETE /shared-tracker/rows/{row_id}`, then `DELETE /installments/{installment_id}`.

- [ ] **Step 3: Verify the public share-link viewer can trigger propagation**

1. `GET /shared-tracker/share-link` → capture `token`.
2. `POST /shared-tracker/rows` `{"label": "Verify Viewer", "row_type": "income"}`, get its entry id via `GET /shared-tracker`.
3. Without any auth header, `PATCH /public/shared-tracker/{token}/entries/{entry_id}` `{"amount": 10, "participants": [0], "state": "paid"}` → 200.
4. `GET /income` (authenticated) → confirm a new "Verify Viewer" income row exists — the unauthenticated viewer call created a real record.
5. Clean up: `DELETE /shared-tracker/rows/{row_id}`, then delete the created income row.

- [ ] **Step 4: Report results**

If every check in Steps 1-3 matched its expected outcome, the feature is done. If anything didn't match, note exactly which check failed and its actual vs. expected result before fixing — don't move on silently.
