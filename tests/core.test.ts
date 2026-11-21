import { describe, it, expect } from "vitest";
import { formatMoney, cediToPesewas } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { monthRange, presetRange, dateInTz, isFutureDate, shiftMonth } from "@/lib/time";
import { renderTemplate, findUnknownPlaceholders, smsStats } from "@/lib/sms/template";

describe("money", () => {
  it("formats", () => { expect(formatMoney(125000)).toBe("GHS 1,250.00"); expect(formatMoney(5)).toBe("GHS 0.05"); });
  it("converts without float drift", () => { expect(cediToPesewas("19.99")).toBe(1999); expect(cediToPesewas("1,250")).toBe(125000); });
  it("rejects bad", () => { expect(() => cediToPesewas("0")).toThrow(); expect(() => cediToPesewas("abc")).toThrow(); });
});
describe("phone", () => {
  it.each([["0241234567","233241234567"],["+233 24 123 4567","233241234567"],["241234567","233241234567"],["233241234567","233241234567"],["00233241234567","233241234567"]])("%s", (i,o) => expect(normalizePhone(i)).toBe(o));
  it("rejects invalid", () => { expect(normalizePhone("12345")).toBeNull(); expect(normalizePhone("abc")).toBeNull(); });
});
describe("time", () => {
  it("buckets by Accra tz (UTC)", () => { expect(dateInTz(new Date("2026-03-31T23:30:00Z"), "Africa/Accra")).toBe("2026-03-31"); });
  it("respects non-UTC tz month boundary", () => { expect(dateInTz(new Date("2026-03-31T23:30:00Z"), "Africa/Lagos")).toBe("2026-04-01"); });
  it("month ranges", () => { expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" }); expect(shiftMonth("2026-01", -1)).toBe("2025-12"); });
  it("presets", () => { const now = new Date("2026-01-15T10:00:00Z"); expect(presetRange("last_month","Africa/Accra",now)).toEqual({ from: "2025-12-01", to: "2025-12-31" }); expect(presetRange("this_year","Africa/Accra",now).from).toBe("2026-01-01"); });
  it("future date", () => { const now = new Date("2026-01-15T10:00:00Z"); expect(isFutureDate("2026-01-16","Africa/Accra",now)).toBe(true); expect(isFutureDate("2026-01-15","Africa/Accra",now)).toBe(false); });
});
describe("template", () => {
  const v = { fullName: "Ama Mensah", amount: 20000, totalThisMonth: 50000, currency: "GHS", paymentDate: "2026-03-08", churchName: "FLPC" };
  it("renders", () => expect(renderTemplate("Hi {firstName}, {currency} {amount} on {date} ({month} {year}). Total {total_this_month}. {churchName}", v)).toBe("Hi Ama, GHS 200.00 on 2026-03-08 (March 2026). Total 500.00. FLPC"));
  it("flags unknown", () => expect(findUnknownPlaceholders("{name} {foo} {bar}")).toEqual(["foo","bar"]));
  it("segments", () => { expect(smsStats("a".repeat(160)).segments).toBe(1); expect(smsStats("a".repeat(161)).segments).toBe(2); expect(smsStats("é".repeat(10)).encoding).toBe("GSM-7"); expect(smsStats("😀").encoding).toBe("Unicode"); expect(smsStats("a".repeat(71)+"😀").segments).toBe(2); });
});
import { dayStartUtc, dayEndUtc } from "@/lib/time";
describe("tz day bounds", () => {
  it("Accra = UTC", () => { expect(dayStartUtc("2026-03-01", "Africa/Accra").toISOString()).toBe("2026-03-01T00:00:00.000Z"); });
  it("Lagos (UTC+1)", () => { expect(dayStartUtc("2026-03-01", "Africa/Lagos").toISOString()).toBe("2026-02-28T23:00:00.000Z"); expect(dayEndUtc("2026-03-01", "Africa/Lagos").toISOString()).toBe("2026-03-01T23:00:00.000Z"); });
  it("DST zone", () => { expect(dayStartUtc("2026-07-01", "America/New_York").toISOString()).toBe("2026-07-01T04:00:00.000Z"); });
});
