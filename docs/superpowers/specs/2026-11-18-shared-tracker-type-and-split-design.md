# Shared tracker: row type + split-and-propagate on Paid

## Intent / why

The shared tracker today is a standalone list: a free-text label, a monthly amount, a paid/unpaid flag, and a "Held By" picker that restricts who can be assigned to an entry. It has no connection to the real Income/Expense/Bill/Installment tables or to the Dashboard/Summary.

The user wants to classify each row as one of the app's real item types (bill, expense, income, installment), add a way to split a row's amount across a chosen set of people, and have marking a row "Paid" actually create a real record of that type — so it shows up on the normal Income/Expenses/Bills/Installments pages and in the main Dashboard/Summary, not just inside the shared tracker.

## Goals

- Editor can set a `row_type` (bill | expense | income | installment) per shared tracker row.
- Editor can pick a set of people to split the row's amount across ("distribute among"), separate from the existing "Held By" set. Defaults to an equal split; editor can override individual amounts.
- Marking an entry Paid creates (or updates) a real record in the matching table, using the split as that record's `participants`/`participant_amounts`, so it appears in that type's own page and in the Dashboard/Summary exactly as if entered there directly.
- Marking an entry back to Unpaid reverses that — deletes/undoes the created record so repeated toggling never leaves duplicates or drifted state (e.g. an installment's `terms_paid`).
- Editing amount/split while an entry is already Paid keeps the linked record in sync instead of creating a second one.

## Non-goals

- No auto-settlement. Marking Paid does **not** create per-person settlement rows. Each person's individual balance still gets settled the same explicit way it does everywhere else in the app (`POST .../settle/{person}/{month}/{year}`). This was a direct decision — the rest of the app never auto-settles on creation, and this shouldn't be the one place that does.
- No retroactive reclassification: once a row has any paid history (a linked master record or a linked monthly record), its `row_type` is locked. Change the type before the first time you mark it Paid.
- No UI inside the shared tracker for viewing/editing the linked record directly — it just exists in its normal page.

## Anti-goals

- Don't let repeated paid/unpaid toggling create duplicate Income/Expense rows or duplicate BillPayment/InstallmentPayment rows for the same month.
- Don't change how `dashboard.py` aggregates totals or balances — new records must flow through the exact same queries every other record does, with zero special-casing for "came from the shared tracker."

## Constraints (from how the app already works)

- Income/Expense rows have no "paid" gate in the dashboard summary at all — they count the moment they exist for that month/year. So an income/expense-type row just needs a row created with the right `month`/`year`/`participants`/`participant_amounts`.
- Bill/Installment are recurring **definitions**: a master `Bill`/`Installment` row exists once, and a `BillPayment`/`InstallmentPayment` row per month/term is what actually marks that month paid in the dashboard. Installments also auto-increment `terms_paid` and flip `status` to `"completed"` when `terms_paid >= total_terms`.
- `IncomeCreate`/`ExpenseCreate`/`BillCreate`/`InstallmentCreate` each require a few fields the shared tracker doesn't currently collect (`type`/`period` for income, `category` for expense/bill, `due_day` for bill, `total_terms` for installment). These need either a sensible default or a small extra input — see "How" below.
- There's no shared internal "create with participants" service function today; every router inlines `Model(**data.model_dump())`. New propagation code will call into the same models/creation shape each router already uses, not a new abstraction.

## Approaches considered

**A. Auto-settle on Paid** — also create a settlement row per participant when marking Paid, so the balances view shows everyone squared away immediately.
**B. Manual settlement (chosen)** — marking Paid only creates the record itself (so it counts in totals); each person's share still needs its own explicit settle action, matching how Income/Expense/Bill/Installment already work everywhere else in the app.

B was picked because A would make the shared tracker behave differently from every other part of the app for no stated reason, and would hide the per-person "did they actually pay me back" step the rest of the app treats as a deliberate, separate action.

## Decisions made with the user

1. **Paid → real record.** Confirmed: Paid should create a genuine Income/Expense/Bill/Installment record (reusing the existing `participants`/`participant_amounts` fields), not a shared-tracker-only summary.
2. **Held By vs. distribute.** Confirmed: these stay separate concepts. "Held By" (who's responsible for the row this month) is unchanged. "Distribute among" is a new, independent list of people the amount is split across.
3. **Split method.** Confirmed: equal split by default, with the editor able to override individual people's amounts (same `participant_amounts` override convention the rest of the app uses).
4. **Scope.** Confirmed: build the dropdown, distribute picker, and paid-propagation for all four types now, not income-only.
5. **Settlement on Paid.** Confirmed: manual settlement, not auto-settle (Approach B above).
6. **Viewer access.** Confirmed: the public share-link viewer (not just the logged-in editor) can trigger propagation — marking a typed row Paid from the public page creates the same real Income/Expense/Bill/Installment record it would if the owner did it. Both the authenticated `PATCH /entries/{id}` and the public `PATCH /{token}/entries/{id}` routes call the same `_update_entry`, so propagation lives there once and applies identically to both callers — no editor/viewer branch needed.

## How (left to the builder, decisions made where they affect behavior)

### Data model

`SharedTrackerRow` gains:
- `row_type: str | None` — `"bill" | "expense" | "income" | "installment"`, nullable (existing rows have none until the editor sets one).
- `due_day: int | None` — only used/required when `row_type == "bill"`.
- `total_terms: int | None` — only used/required when `row_type == "installment"`.
- `linked_master_id: int | None` — the created `Bill.id`/`Installment.id`, set the first time that row is ever marked Paid. Irrelevant for expense/income types.
- Once `linked_master_id` is set (or any entry below has a `linked_record_id`), `row_type` becomes immutable — enforced in the row update endpoint (400 on attempted change).

`SharedTrackerEntry` gains:
- `participants: JSON list[int]`, default `[]` — person ids in that month's distribute set; `0` means "Me," matching the existing `participants: list[int]=[0]` convention used by Expense/Bill/Installment. **Scoped per month, not per row** — like `amount`/`held_by`, `_month_view` carries it over from the prior month as a starting point, but editing it only affects that month, so changing a split after the fact never rewrites a previously-paid month's real record.
- `participant_amounts: JSON dict`, default `{}` — optional per-person override for that month; any participant missing from this dict falls back to an equal share, same fallback rule `_participant_share`/`effective_shares` already use elsewhere.
- `linked_record_type: str | None` — mirrors the row's type at the time it was linked (`"income" | "expense" | "bill_payment" | "installment_payment"`).
- `linked_record_id: int | None` — the created `Income.id`/`Expense.id`/`BillPayment.id`/`InstallmentPayment.id` for that month.

One migration adds all of the above. Propagation only ever runs when `row_type` is set — a row with no type chosen yet behaves exactly as it does today when toggled Paid (no-op beyond the existing flag flip), so existing rows keep working unchanged until their editor opts them into a type.

### Propagation logic (in `shared_tracker.py`, where entry `state` is set)

On transition to `"paid"`, per `row_type`:
- **income** — create an `Income` row: `source=row.label`, `amount=entry.amount`, `date`/`month`/`year` from the entry, `type="other"`, `period=1` (the model's `period` is an integer code, not a string — `1` matches the convention used elsewhere for a one-off/monthly cadence), `participants=entry.participants`, `participant_amounts=entry.participant_amounts`. Store `linked_record_type/id` on the entry.
- **expense** — create an `Expense` row: `category=row.label` (no separate category input — the label doubles as the category string, which is all `Expense.category` is), `amount`, `date`/`month`/`year`, `period=1`, `participants`, `participant_amounts`. Store the link.
- **bill** — if `row.linked_master_id` is unset, create the master `Bill` once (`name=row.label`, `category=row.label`, `due_day=row.due_day`, `start_month/year` = this entry's month/year, `participants=entry.participants`, `participant_amounts=entry.participant_amounts`) and store its id on the row. Either way, create/update that month's `BillPayment` (`bill_id=linked_master_id`, `month`, `year`, `amount_paid=entry.amount`) — same upsert-by-(bill_id, month, year, period) the existing `pay` endpoint already does. Store the link on the entry.
- **installment** — if `row.linked_master_id` is unset, create the master `Installment` once (`name=row.label`, `installment_amount=entry.amount`, `total_terms=row.total_terms`, `start_month/year` = this entry's month/year, `participants=entry.participants`, `participant_amounts=entry.participant_amounts`) and store its id. Either way, create that term's `InstallmentPayment`, incrementing `terms_paid` and flipping `status` to `"completed"` at the threshold — identical to the existing `pay` endpoint's behavior (including its 400 on double-pay for the same period, which can't happen here since we gate on the entry's own state transition).

Note: the master `Bill`/`Installment` is created once from whichever month's split happened to be set at that time; later months can still carry their own independent `participants`/`participant_amounts` on their own linked `BillPayment`/`InstallmentPayment`-triggering entry, but the master record's own fields (set at creation) aren't retroactively updated by later months' splits.

On transition back to `"unpaid"`, reverse whichever of the above happened for that entry: delete the `Income`/`Expense` row, or delete that month's `BillPayment`, or delete that term's `InstallmentPayment` and decrement `terms_paid`/revert `status`. Clear `linked_record_type/id` on the entry. The master `Bill`/`Installment` row and `linked_master_id` are left in place (so the row stays locked to its type and the next Paid toggle reuses the same master).

If amount or the distribute list/overrides are edited while an entry is already `"paid"`, update the linked record in place (`Income`/`Expense` row's `amount`/`participants`/`participant_amounts`, or `BillPayment.amount_paid`) rather than creating a second record.

### Frontend (`SharedTrackerTable`, `SharedTracker` page)

- New "Type" `<Select>` per row (editor only): Bill / Expense / Income / Installment. Disabled once the row has any paid history (`linked_master_id` set or any entry with a `linked_record_id` — surfaced from the row payload).
- New "Distribute among" chip picker (editor only), same visual pattern as the existing "Who can hold this" picker, plus a small per-person amount input next to each selected chip (prefilled with the equal share, editable). "Me" appears as a person option alongside everyone else.
- When `row_type === "bill"`, show a small "Due day" number input next to the type dropdown. When `row_type === "installment"`, show a "Number of terms" number input instead. Neither shows for expense/income.
- No change to the Paid/Unpaid toggle UI itself — same badge, same click-to-flip behavior; the propagation happens server-side on the PATCH.

### What's left to the builder

- Exact validation messages for the 400s (type-locked, bill/installment missing `due_day`/`total_terms` before first Paid).
- Whether `IncomeCreate.type` should be `"other"` literally or a new catch-all value — pick whatever the Income page's own dropdown already offers as its most generic option.
- Test coverage: one test per type covering paid → unpaid → paid (no duplicate records, `terms_paid` lands back where it started), and one covering type-lock-after-paid.
