# Daily check-in rewards

The signed-in app shell shows a daily check-in popup when today's reward is unclaimed,
including when opening a deep link. A confirmed claim immediately closes the popup;
server state prevents it returning on reload or another device that day. Home has no
permanent check-in panel. Player Journey (`/experience#daily-check-in`) contains the
monthly calendar, card studio, wallet balance and recent coin activity.

A permanent Check-in Calendar icon sits immediately beside the light/dark-mode
control in the top bar. It opens the calendar even after today's popup is collected
or dismissed. Compact headers keep icon controls aligned with 44px touch targets.

The popup supports keyboard focus containment, Escape and a Not now action so an
unavailable reward service never blocks using the app. Not now skips only the prompt
for that account/day in the current browser session; it does not collect any coins.

- Players explicitly collect 10 Arena Coins once per calendar day in Asia/Kolkata.
- Every seventh consecutive check-in gives 30 additional coins (40 that day).
- Missing a day resets the current streak; existing coins and the longest streak remain.
- Coins unlock card cosmetics only. They do not change match XP, levels, standings or rankings.
- Midnight Grid costs 70 coins, Royal Stripe 100 and Arena Spark 50. Unlocking and equipping
  are separate actions; the classic background and removing a badge are free.
- Equipped cosmetics appear on the profile, public player card and downloaded PNG.

## API and integrity

All routes require an active authenticated account and accept no target user, date or amount.

- `GET /api/experience/me/check-in?month=YYYY-MM` reads rewards without creating a wallet.
- `POST /api/experience/me/check-in` requires `{ "intent": "DAILY_CHECK_IN" }`.
- `POST /api/experience/me/cosmetics/purchase` requires `{ "itemId": "ROYAL_STRIPE" }`.
- `PATCH /api/experience/me/cosmetics/equip` requires an owned item, `CLASSIC` or `NONE_BADGE`.
- Mutations can include the same optional month query to retain the calendar selection.

The PostgreSQL clock determines the reward day. Transactions lock the account and wallet;
unique daily receipts and ledger references prevent duplicate grants or purchases across
processes, devices and retries. Prices come from the server catalog. Non-negative balance
constraints provide an additional database safeguard. Each balance change appends a ledger
entry in the same transaction. Account deletion erases the wallet and its dependent records.
Only equipped cosmetic identifiers are public; balances and reward history stay private.

The UI waits for server confirmation, prevents duplicate taps and reconciles the wallet after
an ambiguous network error without automatically replaying a mutation. Visible screens
refresh on focus, reconnection, reset and cross-tab reward changes.

## Validation

`daily-reward-policy.spec.ts` covers IST midnight, month boundaries, missed days and bonuses.
`test/daily-rewards.e2e-spec.ts` requires a disposable loopback `*_test` database and covers
concurrent claims/purchases, balance constraints, strict requests, private data and deletion.
`apps/android/tests/daily-rewards-regression.mjs` checks mobile/desktop light and dark layouts,
claim failure/retry, duplicate taps, offline state, calendar navigation, unlocking/equipping
and the actual exported PNG colors using intercepted test API responses.

Migration `20261103120000_daily_check_in_rewards` only adds reward tables. Older runtimes
can continue using the database after it is applied. A deployment rollback must retain the
additive schema and reward data rather than restore an old database backup over new activity.
