# Project: Church Tithe Management System

Build a secure web app (mobile-friendly, since staff will often use phones) for recording church tithes, sending SMS acknowledgements to members, and exporting records. Start by proposing a short plan and folder structure, then build it step by step, running and testing as you go.

## Tech stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Firebase Authentication (email/password). There is NO public sign-up page. Accounts are created manually in the Firebase console. Only a login page and a "forgot password" flow exist.
- Cloud Firestore for data
- Firebase Admin SDK, used only in server code (route handlers / server actions) for verifying ID tokens, reading roles and sending SMS
- mNotify SMS API, called ONLY from the server. The API key must never reach the browser.
- Validation with zod. Export libraries: exceljs (xlsx) and csv generation, plus PDF export (e.g. pdfkit or @react-pdf/renderer).
- Deployable to Vercel. Provide a .env.example and a README with setup steps.

## Users and roles
- Two roles stored as Firebase custom claims (set via a small script I can run: `node scripts/set-role.js <email> <admin|recorder>`):
  - admin: everything, including managing members, SMS templates, settings, voiding entries, exports.
  - recorder: can record tithes, search members, view and export records.
- Every API route must verify the Firebase ID token and check the role server-side. Don't rely on UI hiding.
- Write Firestore security rules that deny all direct client writes to tithes, templates, SMS logs and settings. Writes go through server routes. Include the rules file and explain how to deploy it.
- Auto sign-out after inactivity (e.g. 30 minutes).

## Data model (Firestore)
- members: id, fullName, phone (stored normalized as 233XXXXXXXXX), memberNumber (optional, unique if given), status (active/inactive), createdAt, updatedAt
- tithes: id, memberId, memberNameSnapshot, phoneSnapshot, amount (store as integer pesewas, not float), currency ("GHS"), paymentDate (the date the tithe was paid), paymentMethod (cash / mobile money / bank / cheque / other), reference (optional), note (optional), recordedBy (uid + email), createdAt, status (active/voided), voidedBy, voidReason, smsStatus (pending/sent/failed/skipped), smsLogId
- smsTemplates: id as "YYYY-MM" (month it applies to), body, updatedBy, updatedAt. Also a default template stored in settings, used when no template exists for the month.
- smsLogs: id, tithId, memberId, phone, messageText, status, providerResponse, providerMessageId (if returned), attempts, createdAt, sentAt
- settings: churchName, senderId, defaultTemplate, defaultCurrency, timezone (default Africa/Accra)
- auditLogs: who did what and when (create, edit, void, template change, export, settings change)

Never hard-delete tithe records. Use "void" with a required reason. Corrections are an edit (logged in the audit trail) or a void plus a new entry.

## Core features

### 1. Members
- Add, edit and deactivate members (admin). Search by name, phone or member number (recorder and admin).
- Phone validation and normalization to mNotify's required format. Reject duplicates.
- Bulk import of members from CSV (admin), with a preview and error report.

### 2. Record today's tithe (main screen, built for speed)
- Default payment date = today in the church's timezone (editable for back-dated entries; block future dates).
- Type-ahead member search. Fields: amount, payment method, reference, note.
- A "Save & send acknowledgement" action. Also support adding several people in a batch session: a list of entries for the day that I can add to quickly, then submit all at once.
- Warn (don't block) on a likely duplicate: same member, same date, same amount.
- After saving, the record shows its SMS status (sent / failed / pending) and a "Retry SMS" button on failures.
- Show a running total of the day's entries.
- Allow saving without sending an SMS (option per entry, e.g. a "don't notify" toggle).

### 3. SMS acknowledgement via mNotify
- Check the current mNotify API documentation (https://developer.mnotify.com) and implement the quick SMS endpoint accordingly: API key as a query parameter or header per the docs, recipient list, sender ID, message. Do not rely on memory for endpoint paths, parameters or response codes. Verify them from the docs, and put the base URL in config.
- Env vars: MNOTIFY_API_KEY, MNOTIFY_SENDER_ID (max 11 characters, must be a registered sender ID), and others as needed.
- Wrap it in a single `sendSms()` service in `lib/sms/` with a provider interface, so the provider can be swapped later.
- The message template can change every month:
  - Admin screen to create or edit a template for any month (YYYY-MM) and to set the default template.
  - Supported placeholders: {name}, {firstName}, {amount}, {currency}, {date}, {month}, {year}, {churchName}, {total_this_month} (the member's total tithe for the month so far, including this payment).
  - Live preview with sample data, and a character and SMS-segment counter (GSM-7 vs Unicode; warn if the message goes over one segment).
  - When sending, the template is chosen by the payment date's month, falling back to the default template. Save the final rendered text in smsLogs.
  - Validate that unknown placeholders are rejected on save.
- Failure handling: never lose the tithe record if SMS fails. Mark smsStatus=failed, log the provider response, and allow retry (individually and "retry all failed"). Prevent double-sending on retry or double-click (idempotency keyed on tithe ID).
- Show the mNotify SMS balance on the admin dashboard (balance endpoint per docs) with a low-balance warning.
- Admin SMS log page: filter by date, status and member.

### 4. Records and exports
- Records page with filters: date range (from and to), member, payment method, status, SMS status. Show totals (count and sum).
- Export for a period (date range):
  a) All members who paid in that period, as CSV, XLSX and PDF.
     - Columns: date, member name, member number, phone, amount, method, reference, recorded by.
     - Include a summary sheet or section: number of payers, total amount, and a per-member subtotal view.
  b) A single member's records for a period, as CSV, XLSX and PDF. Show the member's name, the period, a table of payments and the total. Make the PDF look like a clean statement that could be given to a member.
- Voided records are excluded by default, with an option to include them (clearly marked).
- Quick period presets: this month, last month, this year, custom.
- Handle large exports safely (paginate Firestore reads, stream where practical).
- Also useful: a "members who have NOT paid this month" report.
- Log every export in the audit log.

### 5. Dashboard
- This month's total, number of payers, today's entries, SMS failures awaiting retry, and SMS balance (admin).

## Non-functional requirements
- Security: server-side auth and role checks on every route, input validation with zod, rate limiting on the login and SMS routes, no secrets in client bundles, and no PII in console logs.
- Privacy: tithe data is sensitive. Only authenticated staff can see it, and exports are served with no caching headers.
- Money: amounts stored as integer minor units, formatted consistently (e.g. GHS 1,250.00).
- Time: store timestamps in UTC, and display and bucket dates using the church's timezone so month boundaries are correct.
- UX: clean, simple and fast, with large tap targets, clear success and error toasts, and loading and empty states.
- Firestore: define the composite indexes needed (firestore.indexes.json) for the date-range, member and status queries.
- Testing: unit tests for template rendering, phone normalization, month and timezone bucketing and amount formatting. Integration tests for the record-tithe flow with a mocked SMS provider. Use the Firebase Emulator Suite for local development.
- Developer experience: seed script with sample members and tithes, plus scripts for setting roles.

## Deliverables
1. Working code with the structure above
2. README covering: Firebase project setup, how to create users and assign roles, env vars, mNotify setup (API key, sender ID registration), deploying Firestore rules and indexes, and deploying to Vercel
3. .env.example
4. Short user guide for church staff (how to record tithes, change the monthly SMS template, and export)

## Working approach
- First, confirm your plan and flag any assumption or ambiguity. If something is unclear, make a sensible default and list it at the end instead of blocking.
- Build in this order: project setup and auth, then roles and rules, then members, then tithe entry, then the SMS service and templates, then records and exports, then the dashboard, then tests and docs.
- After each stage, run the build, lint and tests, and fix failures before moving on.
- At the end, give me a checklist of manual steps I must do myself (Firebase console setup, creating users, mNotify sender ID and API key, deploying rules).
