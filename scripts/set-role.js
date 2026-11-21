#!/usr/bin/env node
// Usage: node scripts/set-role.js <email> <admin|recorder>
// Needs FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in env (or .env.local),
// or FIREBASE_AUTH_EMULATOR_HOST for the emulator.
const fs = require("fs");
const path = require("path");
for (const f of [".env.local", ".env"]) {
  const p = path.join(__dirname, "..", f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const admin = require("firebase-admin");
const [email, role] = process.argv.slice(2);
if (!email || !["admin", "recorder"].includes(role)) {
  console.error("Usage: node scripts/set-role.js <email> <admin|recorder>");
  process.exit(1);
}
const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY } = process.env;
admin.initializeApp(
  clientEmail && FIREBASE_PRIVATE_KEY
    ? { credential: admin.credential.cert({ projectId, clientEmail, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }
    : { projectId }
);
(async () => {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role });
  await admin.auth().revokeRefreshTokens(user.uid); // forces re-login so the new role applies
  console.log(`Role "${role}" set for ${email}. They must sign in again.`);
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
