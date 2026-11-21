# Staff guide

## Signing in
Open the app, enter your email and password, and tap **Sign in**. Forgot your password? Tap **Forgot password?** and follow the email. You are signed out automatically after 30 minutes without activity.

## Recording tithes (everyone)
1. Tap **Record**.
2. **Member:** type a name, phone number or member number and tap the right person.
3. **Amount** (in cedis), **Payment date** (today by default; change it for back-dated entries; future dates aren't allowed), **Method** and optionally a **Reference** or **Note**.
4. Tap **Save & send acknowledgement**. The member gets an SMS, and the entry appears under *Today's entries* with an SMS badge.
   - Tick **Don't send SMS acknowledgement** to save without messaging the member.
   - A yellow warning means this member already has the same amount on the same date. You can still save it if it's genuine.

**Many entries at once:** fill in each person and tap **Add to batch**. When you're done, tap **Submit all**. Every entry is saved; if one fails, the others still go through and the failed one stays in the list so you can fix it.

**If an SMS fails:** the tithe is still saved. The badge shows *SMS failed*; tap **Retry SMS**. Tapping twice will not send two messages.

The total for the day (count and amount) is shown above the list.

## Looking up records and exporting
- **Records** shows payments for a period. Pick *This month*, *Last month*, *This year* or *Custom* dates. You can also filter by member, payment method, status and SMS status. The count and total are shown at the top.
- **Voided** payments are hidden by default; choose *Include voided* to see them. They are clearly marked and are never counted in totals.
- **Export all payers:** choose the period, then tap **CSV**, **XLSX** or **PDF**. The file lists date, member, member number, phone, amount, method, reference and who recorded it, plus a summary (number of payers, total, and a subtotal per member).
- **Member statement:** choose a member and a period, then tap their **PDF** button for a clean statement you can give to the member (or CSV/XLSX).
- **Not paid:** the **Not paid** page lists active members with no payment in a chosen month and can export it.

## Members
Everyone can search members. Administrators can add, edit and deactivate them, and import a list from a CSV file (columns: `name`, `phone`, optional `member number`). The import shows a preview first, flags problems row by row, and lets you download an error report. Duplicate phone numbers and member numbers are rejected.

## Administrators only
**Correcting a mistake:** on *Records*, tap **Edit** to fix the amount, date, method, reference or note, or **Void** (a reason is required) and record a new entry. Nothing is ever deleted, and every change is in the **Audit log**.

**Changing the monthly SMS message:**
1. Open **SMS templates** and choose the month (or tap *Edit default template* for the message used when a month has none).
2. Type the message. Tap the placeholders to insert them: `{name}`, `{firstName}`, `{amount}`, `{currency}`, `{date}`, `{month}`, `{year}`, `{churchName}`, `{total_this_month}` (the member's total for the month including this payment).
3. Check the preview and the character counter. One SMS is 160 characters (70 if the message contains special characters). Longer messages cost more credits.
4. Tap **Save template**. Unknown placeholders are rejected.

A tithe uses the template for the month of its **payment date**, falling back to the default.

**SMS logs:** see every message sent, filter by date, status or member, and use **Retry all failed**. The dashboard shows your **SMS balance** and warns when it's low; top up your mNotify account when you see it.

**Settings:** church name (used in messages), sender ID and timezone.
