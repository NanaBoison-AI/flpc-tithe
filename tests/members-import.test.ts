import { describe, it, expect } from "vitest";
import { parseMemberCsv } from "@/lib/members/import";
import { memberCreate, memberUpdate } from "@/lib/members/schema";

const none = new Set<string>();
describe("member schema", () => {
  it("normalizes phone", () => expect(memberCreate.parse({ fullName: "Ama K", phone: "024 123 4567" }).phone).toBe("233241234567"));
  it("rejects bad phone", () => expect(memberCreate.safeParse({ fullName: "Ama K", phone: "123" }).success).toBe(false));
  it("blank member number -> undefined", () => expect(memberCreate.parse({ fullName: "Ama K", phone: "0241234567", memberNumber: "  " }).memberNumber).toBeUndefined());
  it("update allows null member number", () => expect(memberUpdate.parse({ memberNumber: null }).memberNumber).toBeNull());
});
describe("parseMemberCsv", () => {
  it("accepts aliases, BOM, normalizes", () => {
    const { rows } = parseMemberCsv("﻿Name,Mobile,Member No\nAma Mensah,0241234567,A1\n", none, none);
    expect(rows[0]).toMatchObject({ fullName: "Ama Mensah", phone: "233241234567", memberNumber: "A1", errors: [] });
  });
  it("flags invalid, in-file duplicates and existing", () => {
    const csv = "name,phone,member number\nA One,0241234567,1\nB Two,0241234567,2\nC Three,bad,3\nD Four,0201111111,1\nE Five,0502222222,\n";
    const { rows } = parseMemberCsv(csv, new Set(["233502222222"]), none);
    expect(rows.map((r) => r.errors.length > 0)).toEqual([false, true, true, true, true]);
    expect(rows[1].errors[0]).toMatch(/duplicate phone/); expect(rows[3].errors[0]).toMatch(/duplicate member number/); expect(rows[4].errors[0]).toMatch(/already exists/);
    expect(rows[2].line).toBe(4);
  });
  it("fatal on missing columns / empty", () => {
    expect(parseMemberCsv("foo,bar\n1,2", none, none).fatal).toMatch(/needs/);
    expect(parseMemberCsv("name,phone\n", none, none).fatal).toMatch(/no data/);
  });
});
