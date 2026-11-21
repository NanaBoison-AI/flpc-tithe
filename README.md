# Church Tithe Management System

A mobile-friendly web app for recording church tithes, sending SMS acknowledgements through mNotify, and exporting records.

- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Firebase Auth + Firestore · mNotify SMS · zod · exceljs · pdfkit
- **Access:** staff only. There is no public sign-up. Accounts are created by hand in the Firebase console.
- **Roles** (Firebase custom claims): `admin` (everything) and `recorder` (record tithes, search members, view and export records).

Staff guide: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

---

## 1. Firebase setup (one-time)

1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.** (Leave "Email link" off.)
3. **Build → Firestore Database → Create database** → production mode, pick a region close to Ghana (e.g. `europe-west1`).
4. **Project settings → General → Your apps → Web (`</>`)** → register an app. Copy the config values into `.env.local` (`NEXT_PUBLIC_FIREBASE_*`).
5. **Project settings → Service accounts → Generate new private key.** From the downloaded JSON copy `project_id`, `client_email` and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. **Never commit this file or expose these values to the browser.**
6. **Authentication → Templates → Password reset:** customise the sender name/wording if you like (the "forgot password" page uses this).
7. **Authentication → Settings → Authorized domains:** add your Vercel domain once deployed.

## 2. Create users and assign roles

There is no sign-up page, so:

1. **Firebase console → Authentication → Users → Add user** (email + temporary password).
2. Assign a role (needs the service-account env vars from step 1.5 in `.env.local`):

```bash
node scripts/set-role.js admin@yourchurch.org admin
node scripts/set-role.js clerk@yourchurch.org recorder
```

3. The person must **sign in again** for the role to take effect (the script revokes their old sessions). A user with no role can sign in but sees nothing.

Every API route re-checks the token **and** the role on the server. The role-based menu is only a convenience.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | Firebase web config (public by design) |
| `NEXT_PUBLIC_USE_EMULATORS` | `true` to point the browser at the local Auth emulator |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Admin SDK credentials (**server only**) |
| `MNOTIFY_API_KEY` | mNotify API key (**server only**) |
| `MNOTIFY_SENDER_ID` | Registered sender ID, max 11 characters (fallback; can also be set in Settings) |
| `MNOTIFY_BASE_URL` | Defaults to `https://api.mnotify.com/api` |
| `SMS_LOW_BALANCE_THRESHOLD` | Dashboard warns below this many SMS credits (default 50) |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` | Auto sign-out after inactivity (default 30) |

## 4. mNotify setup

1. Sign in to your mNotify account (the developer docs are at <https://developer.mnotify.com>, which redirects to <https://developer.bms.africa>).
2. Create/copy your **API key** at <https://app.bms.africa/settings/developer> and put it in `MNOTIFY_API_KEY`.
3. **Register a sender ID** (max 11 characters, e.g. your church's short name) in your mNotify account and wait for it to be approved. Unapproved sender IDs will cause sends to fail.
4. Set it in `MNOTIFY_SENDER_ID` or in the app under **Settings**.
5. Buy SMS credits. The dashboard shows your balance and warns when it's low.

The integration (`src/lib/sms/mnotify.ts`) uses `POST /sms/quick` and `GET /balance/sms`, checked against the official OpenAPI spec. A send counts as successful only when the response is `status: "success"` with `code: "2000"`. The provider sits behind a small interface (`src/lib/sms/provider.ts`) so it can be swapped later.

## 5. Deploy Firestore rules and indexes

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # choose your project
firebase deploy --only firestore:rules,firestore:indexes
```

- `firestore.rules` denies **all** client writes; the browser never talks to Firestore directly. All writes go through the server (Admin SDK bypasses rules).
- `firestore.indexes.json` defines the composite indexes. They take a few minutes to build; queries that need one fail until it is ready. If the console shows a "create index" link for a query I didn't anticipate, accept it and add it to the file.

## 6. Run locally

```bash
npm install
cp .env.example .env.local      # fill it in
npm run dev                     # http://localhost:3000
```

Checks: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.

### Optional: Firebase Emulator Suite

The emulators need Java and a bit of memory, and aren't required for day-to-day work (the tests don't use them). When you do want them:

```bash
npm run emulators               # Auth :9099, Firestore :8080, UI :4000
# in .env.local:
#   NEXT_PUBLIC_USE_EMULATORS=true
#   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
#   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
#   FIREBASE_PROJECT_ID=demo-tithe
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-tithe npm run seed
```

`npm run seed` adds 12 fake members and tithes (SMS marked "skipped", nothing is sent). It **refuses to touch a real project** unless you pass `--production`.

`docs/members-sample.csv` is a sample file for the member import screen.

## 7. Deploy to Vercel

1. Push the repo to GitHub → <https://vercel.com/new> → import it (framework: Next.js, no build overrides).
2. **Settings → Environment Variables:** add every variable from section 3 (for `FIREBASE_PRIVATE_KEY` paste the whole key; keep the `\n` sequences).
3. Deploy, then add the Vercel domain to Firebase **Authentication → Authorized domains**.
4. Smoke test: sign in, record a test tithe with "Don't send SMS" ticked, export a PDF (this checks the PDF fonts are bundled), then record one with SMS to your own number.

Notes: exports and SMS batches run in functions with a 60 s limit (`maxDuration`); very large exports may need a Vercel plan that allows longer functions. In-memory rate limits and caches are per server instance (best-effort).

---

## Project layout

```
src/app/            pages (login, dashboard, record, records, members, reports, admin/*) and /api routes
src/lib/auth/       server token+role checks (requireRole/route), client AuthProvider (idle sign-out)
src/lib/sms/        provider interface, mNotify client, sendSms(), templates, idempotent send/retry
src/lib/tithes/     validation + save/void/edit
src/lib/members/    validation, CSV import, search
src/lib/records/    filters and paginated Firestore reads
src/lib/export/     CSV / XLSX / PDF writers and report builders
scripts/            set-role.js, seed.js
tests/              unit + integration tests (mocked SMS provider, in-memory Firestore stand-in)
firestore.rules  firestore.indexes.json  firebase.json
```

## Design decisions and assumptions

- **Money** is stored as integer pesewas; **dates** are stored as `YYYY-MM-DD` (payment date) and UTC timestamps (created/updated), and bucketed in the church timezone (default `Africa/Accra`).
- **Phones:** Ghana numbers only, normalised to `233XXXXXXXXX`.
- **Idempotency:** each saved entry carries a unique key that is also its document ID, so a double-click can't create two tithes. SMS sends take a transactional lock per tithe, so retries and double-clicks can't double-send. A tithe is never lost if SMS fails.
- **Edit/void are admin-only.** Recorders record and view. Voiding needs a reason; records are never hard-deleted.
- **Login rate limiting:** Firebase throttles sign-ins itself, and the login page adds a 1-minute client-side lockout after 5 failures. There is no server-side login route to rate-limit. SMS, export and save routes are rate-limited per user (in memory, per instance).
- **PDF font:** the built-in font is Latin-1 only, so Twi letters (ɛ, ɔ) print as e/o in PDFs (CSV/XLSX keep them). Embed a TTF font in `src/lib/export/pdf.ts` if that matters.
- **Search** loads the member list into a 30 s server cache and filters it in memory, which suits a few thousand members.
- **Free-tier note:** Firestore's free (Spark) plan allows 50k reads and 20k writes per day. Normal use is far below that, but exports and the dashboard read many documents, so avoid repeatedly exporting huge periods.
- **Known dependency advisories** (`npm audit`): the flagged `firebase`/`grpc` package is the browser Firestore client, which this app does not use (browser only uses Firebase Auth). `postcss` is build-time only. `uuid` (via exceljs) concerns a call pattern exceljs doesn't use. The suggested `--force` fixes downgrade packages, so they were deliberately not applied; review again when upgrading Next.js.
