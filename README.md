# jStack FS-01 — P2P Wallet Transfer

Full-stack MERN assignment: **React + TypeScript**, **Express + TypeScript**, **MongoDB/Mongoose**. All API money values are **integer paise**, not rupees. **Test money only; not connected to banks or a payment processor.**

## Quick start

1. Install Node.js 20+ and MongoDB Atlas (M0 replica set works for transactions).
2. `npm install`
3. Copy `.env.example` to `server/.env` and set **your own** `MONGODB_URI` and strong `JWT_SECRET`. Never commit `.env`.
4. `npm run dev`
5. Open `http://localhost:5173`.

**Seeded demo users:** `asha@example.com`, `rohan@example.com`, `meera@example.com`, all with password `password123` and ₹10,000 initial test balance. Missing demo users are inserted idempotently on first demo login; existing balances/passwords are not reset. This seed approach is for assessment/demo only.

## API

All routes are under `/api`:

- `POST /api/auth/login` `{ "email": "asha@example.com", "password": "password123" }` → JWT.
- `GET /api/wallet` → `{balance:1000000,currency:"INR",unit:"paise"}`.
- `GET /api/users` → recipient dropdown.
- `POST /api/wallet/transfer` → `{ "toUserId":"...", "amount":50000 }` with `Authorization: Bearer <JWT>` and `Idempotency-Key: <uuid>`.
- `GET /api/transactions` → latest 100 sent and received transactions, newest first.

The API returns 400 for missing key, invalid receiver, self transfer, or amounts outside 100–5,000,000 paise; 409 for insufficient balance or a reused key with different payload. A replay of the **same** key and payload returns the original result without a second debit.

## Optional tasks (all four implemented in source)

1. **MongoDB indexes:** `WalletUser.email` unique for login; `WalletKey(senderId,key)` unique to prevent repeated processing per sender; `WalletTx(fromUserId,createdAt)` and `WalletTx(toUserId,createdAt)` support transaction history filtering and sorting. MongoDB may still need to merge the two query branches for the `$or` query.
2. **MongoDB transactions:** debit with `balance >= amount`, credit, transaction record and idempotency record are all written inside a single `session.withTransaction`. Requires a MongoDB replica set (Atlas supports it).
3. **Tests:** `npm test` runs Vitest unit tests for minimum/maximum amount, invalid amounts, self transfer, invalid receiver, required key, replay of same payload, conflict on reused key with different payload. Database concurrency and integration tests are **not** included.
4. **TypeScript:** frontend, backend and rules are authored in `.tsx` / `.ts` with strict compiler options.

## Required design questions

**1. What if the server crashes after debit but before credit?** The debit and credit happen in the same MongoDB transaction. If it fails before commit, MongoDB aborts/rolls back both; no partial transfer is committed. If the server crashes after commit but before returning the HTTP response, retry the **same Idempotency-Key** to retrieve the committed result. The client preserves the key for retries.

**2. What if two transfers from the same wallet happen simultaneously?** The sender debit uses an atomic conditional update (`balance >= amount`). MongoDB transactions also detect conflicting writes; a transaction may be retried by the driver. A transfer only commits when the debit, credit, transaction record, and idempotency record all succeed. The unique `(senderId,key)` index prevents two successful commits for the same key.

## Tests and builds

- `npm test` — unit tests for transfer validation and idempotency rules.
- `npm run typecheck` — strict TS type checks for both apps.
- `npm run build` — builds frontend and server.

## Deployment

The existing live demo is hosted at https://jstack-fs01-wallet.vercel.app but may run a **previous JavaScript implementation**. This ZIP is the improved React + Express + TypeScript source, **not automatically deployed** to that URL. This ZIP now includes `vercel.json` and `api/index.ts` to build the React frontend and expose the Express backend through a Vercel Node function. Deploy from the project root with the Vercel Vite preset. Set `MONGODB_URI` and `JWT_SECRET` as server-only Vercel environment variables. GitHub Actions in `.github/workflows/verify.yml` runs typecheck, tests, and build on push. The new deployment has not yet been executed or verified. Set secrets only in host environment variables. Do not expose the database URI to Vite.

## Limitations

This is an assessment demo, not a regulated payment wallet. Known demo credentials must not be used in production. A real payment system needs identity verification, secure onboarding, payment rails, audits, fraud controls, and legal compliance. Unit tests do not replace end-to-end tests against a real MongoDB replica set. No actual bank money is moved.
