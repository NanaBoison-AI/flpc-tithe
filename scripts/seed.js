#!/usr/bin/env node
// Seeds sample members, tithes, a settings doc and a template. Fake data only.
// Safe by default: runs only against the local emulator unless you pass --production.
//   Emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-tithe node scripts/seed.js
//   Real DB:   node scripts/seed.js --production      (writes sample data into your real project!)
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
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (!emulator && !process.argv.includes("--production")) {
  console.error("Refusing to seed a real project. Start the emulator and set FIRESTORE_EMULATOR_HOST, or pass --production if you really mean it.");
  process.exit(1);
}
const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY } = process.env;
admin.initializeApp(
  !emulator && clientEmail && FIREBASE_PRIVATE_KEY
    ? { credential: admin.credential.cert({ projectId, clientEmail, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) }
    : { projectId: projectId || "demo-tithe" }
);
const db = admin.firestore();

const ymd = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const monthStart = (offset) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
const NAMES = ["Ama Mensah", "Kofi Boateng", "Efua Owusu", "Kwame Asante", "Abena Agyei", "Yaw Darko", "Akosua Frimpong", "Kojo Addo", "Adwoa Sarpong", "Nana Yeboah", "Esi Quartey", "Kwabena Ofori"];
const METHODS = ["cash", "mobile_money", "bank", "cheque", "other"];

(async () => {
  const now = new Date();
  await db.collection("settings").doc("app").set({
    churchName: "Sample Church", senderId: process.env.MNOTIFY_SENDER_ID || "", defaultCurrency: "GHS", timezone: "Africa/Accra",
    defaultTemplate: "Dear {firstName}, we acknowledge your tithe of {currency} {amount} received on {date}. Total for {month}: {currency} {total_this_month}. God bless you. - {churchName}",
  }, { merge: true });
  await db.collection("smsTemplates").doc(ymd(today).slice(0, 7)).set({ body: "Thank you {firstName}! Your {month} tithe of {currency} {amount} is received. Total so far: {currency} {total_this_month}. {churchName}", updatedBy: "seed", updatedAt: now });

  const members = [];
  for (const [i, name] of NAMES.entries()) {
    const ref = db.collection("members").doc();
    const m = { fullName: name, nameLower: name.toLowerCase(), phone: `23320000${String(1000 + i)}`, memberNumber: `M${String(i + 1).padStart(3, "0")}`, status: i === 11 ? "inactive" : "active", createdAt: now, updatedAt: now };
    await ref.set(m); members.push({ id: ref.id, ...m });
  }
  let n = 0;
  for (const offset of [-1, 0]) {
    const start = monthStart(offset);
    for (const [i, m] of members.entries()) {
      if (m.status !== "active" || (offset === 0 && i % 4 === 3)) continue; // leave a few unpaid this month
      const day = new Date(start); day.setUTCDate(1 + ((i * 3) % 7));
      if (day > today) continue;
      await db.collection("tithes").add({
        memberId: m.id, memberNameSnapshot: m.fullName, phoneSnapshot: m.phone, amount: (5 + (i % 6) * 5) * 10000 / 10, currency: "GHS",
        paymentDate: ymd(day), paymentMethod: METHODS[i % METHODS.length], ...(i % 2 ? { reference: `REF${1000 + n}` } : {}),
        recordedBy: { uid: "seed", email: "seed@example.com" }, createdAt: now, status: "active", smsStatus: "skipped", smsLogId: null,
      });
      n++;
    }
  }
  console.log(`Seeded ${members.length} members and ${n} tithes (SMS marked "skipped" — nothing was sent).`);
})().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
