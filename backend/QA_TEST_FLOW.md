# QA Test Flow

Manual frontend test plan covering all features with special focus on wallet snapshots, transaction versioning, and cross-module relationships.

---

## Phase 0 — Setup (prerequisites)

- [x] Register and login as a fresh user
- [x] Create wallet: `BRL Wallet` (BRL)
- [x] Create wallet: `USD Wallet` (USD)
- [x] Create tag: `food`
- [x] Create tag: `salary`
- [x] Create tag: `freelance`
- [x] Create contact: `Client A`
- [x] Create contact: `Supplier B`

---

## Phase 1 — Wallet Fundamentals

**W1 — Initial state**

- [x] Open each wallet detail → verify `currentBalance = 0` and no snapshots

**W2 — Manual adjustment (positive)**

- [x] Adjust `BRL Wallet` to `500.00`
- [x] Verify: snapshot created, `source = manual`, `amount = 500`, `delta = +500`

**W3 — Manual adjustment (negative)**

- [x] Adjust `BRL Wallet` to `300.00`
- [x] Verify: new snapshot `amount = 300`, `delta = -200`

**W4 — Wallet rename**

- [x] Rename `BRL Wallet` to something else and back
- [x] Verify: only name changes, balance and snapshots unchanged

**W5 — Reorder**

- [ ] Drag wallets to swap positions
- [ ] Reload page and verify order persists

---

## Phase 2 — Transaction → Wallet Snapshot Integration

> Most critical area — each action must produce the correct snapshot and balance.

**T1 — Income transaction with wallet**

- [x] Create `income` transaction: `200.00 BRL`, linked to `BRL Wallet`, tag `salary`
- [x] Verify wallet: new snapshot `source = transaction`, `delta = +200`, `amount = 500` (300 + 200)

**T2 — Outcome transaction with wallet**

- [x] Create `outcome` transaction: `50.00 BRL`, linked to `BRL Wallet`, tag `food`
- [x] Verify wallet: new snapshot `delta = -50`, `amount = 450`

**T3 — Transaction without wallet**

- [x] Create a transaction with no wallet linked
- [x] Verify: no new snapshot appears in any wallet

**T4 — Update transaction (same wallet, change amount)**

- [x] Edit T1 amount from `200` to `300`
- [x] Verify wallet: old delta (+200) reversed, new delta (+300) applied, final balance correct
      _Result: It actually has added a new snapshot (delta:+100, balance: 550)_
      **T5 — Update transaction (change wallet)**

- [x] Edit T2 to link to `USD Wallet` instead of `BRL Wallet`
- [x] Verify `BRL Wallet`: reversal snapshot applied (balance increases by 50)
- [x] Verify `USD Wallet`: new snapshot `delta = -50 USD` applied

**T6 — Update transaction (remove wallet link)**

- [x] Edit a transaction to remove its wallet link
- [x] Verify: reversal snapshot applied to the previously linked wallet

**T7 — Soft delete transaction**

- [x] Soft-delete T1
- [x] Verify: wallet balance reversed by T1's amount
- [x] Verify: transaction appears when `deleted=true` filter is active

**T8 — Restore transaction to previous version**

- [x] Restore T1 to its original (v1) data
- [x] Verify: new version created with incremented version number
- [x] Verify: wallet snapshot reapplied with restored version's amount
- [x] Verify: final wallet balance is correct

---

## Phase 3 — Transaction Versioning

**V1 — Update creates new version**

- [x] Create a transaction, edit it, then edit it again
- [x] Open transaction history and verify v1, v2, v3 entries exist
- [x] Verify stable `id` (originalId) is consistent across all versions
- [x] Verify each version has a different `versionId`

**V2 — Restore to v1**

- [x] Restore to v1 data → verify v4 is created with v1's content
- [x] Verify wallet balance reflects v1's amount

**V3 — Hard delete**

- [x] Hard-delete a transaction
- [x] Verify: completely gone even with `deleted=true` filter
- [ ] Verify: wallet snapshot was reversed before removal (balance correct)
      _NOTE: it updates delta twice (soft/hard delete)_

---

## Phase 4 — Invoice → Transaction → Wallet Chain

> Tests the deepest relationship: invoice status + transaction creation + wallet snapshot all in one flow.

**I1 — Create payable invoice**

- [x] Create payable invoice: `Client A`, `1000.00 BRL`, due date 7 days from now
- [x] Verify: `status = pending`, history shows `created` event

**I2 — Add partial payment**

- [x] Add transaction to invoice: `400.00 BRL`, linked to `BRL Wallet`
- [x] Verify: invoice `status = partial`, `paidAmount = 400`
- [x] Verify: history shows `transaction_added` event
- [x] Verify: `BRL Wallet` gets new `outcome` snapshot, `delta = -400`
- [x] Verify: transaction appears in transaction list linked to invoice

**I3 — Add second payment (completes invoice)**

- [x] Add transaction: `600.00 BRL`
- [x] Verify: invoice `status = paid` automatically (600 + 400 = 1000)
- [x] Verify: wallet balance updated again

**I4 — Currency mismatch guard**

- [x] Try to add a `USD` transaction to a `BRL` invoice → expect 400 error

**I5 — Mark paid (force)**

- [x] Create a new invoice, add a partial payment, then use "Mark Paid"
- [x] Verify: `status = paid` even though full amount not reached
- [x] Verify: history records the `mark_paid` event

**I6 — Cancelled invoice guard**

- [x] Cancel an invoice
- [x] Try to add a transaction to the cancelled invoice → expect error

**I7 — Overdue flag**

- [x] Create an invoice with a past due date and `status = pending`
- [x] Verify: `isOverdue = true` is displayed correctly

---

## Phase 5 — Tags

**G1 — Inline tag creation**

- [x] Create a transaction using a tag name that does not exist yet
- [x] Verify: tag auto-created and appears in the tags list

**G2 — Duplicate tag guard**

- [x] Try to create a tag with an already-existing name → expect 409 conflict

**G3 — Tag merge on invoice transaction**

- [x] Create invoice with tag `salary`; add transaction with tag `food`
- [x] Verify: invoice now has both `[salary, food]`

**G4 — Filter by tag**

- [x] Filter transactions by tag `food` → verify only food-tagged transactions appear

---

## Phase 6 — Contacts & Deletion Restriction

**C1 — Contact with invoices cannot be hard-deleted**

- [ ] Try to hard-delete `Client A` (who has invoices) → expect 403 error

**C2 — Contact with no invoices can be deleted**

- [x] Create a fresh contact with no invoices, hard-delete it → success

**C3 — Soft-delete and restore contact**

- [x] Soft-delete a contact → verify gone from default list
- [x] Restore the contact → verify it reappears in the list

---

## Phase 7 — Soft Delete / Restore Flows

**D1 — Soft-delete wallet**

- [x] Soft-delete `USD Wallet`
- [x] Verify: not shown in default wallet list
- [x] Verify: transactions previously linked to it still exist (wallet field set to null)

**D2 — Restore wallet**

- [x] Restore `USD Wallet`
- [x] Verify: reappears in list with snapshots and history intact

**D3 — Hard-delete wallet**

- [x] Create a throwaway wallet, add a manual snapshot, then hard-delete it
- [x] Verify: wallet is completely gone
- [x] Verify: its snapshots are cascade-deleted
- [x] Verify: transactions that were linked to it now have wallet = null

---

## Phase 8 — Edge Cases & Guards

**E1 — Pagination**

- [x] Create 10+ transactions
- [x] Verify page 1 and page 2 are non-overlapping and cover all records

**E2 — Date range filter**

- [x] Create transactions on different dates
- [x] Filter by `startDate` / `endDate` → verify only transactions within range appear

**E3 — Sorting**

- [x] Sort transactions by `total` ascending → verify order is correct
- [x] Sort transactions by `total` descending → verify order is correct

**E4 — Session refresh**

- [x] Let access token expire (or simulate expiry)
- [x] Verify: refresh token silently renews it without requiring re-login

**E5 — Logout all sessions**

- [x] Logout from all sessions
- [x] Verify: all tokens invalidated and re-login is required

---

## Wallet Snapshot Verification Checklist

For every test that touches a wallet, verify all three:

- [x] **Latest snapshot amount** matches the expected running balance
- [x] **Snapshot delta sign** is correct (`+` for income, `-` for outcome, `±` for manual)
- [x] **Snapshot source** is `transaction` or `manual` as appropriate

---

> **Note:** Run phases in order — each phase builds on data created in the previous one. The highest regression risk is in **Phase 2 (T4–T8)**, since snapshot reversal/reapplication bugs silently corrupt balances without throwing errors.
