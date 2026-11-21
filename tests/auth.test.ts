import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const verify = vi.fn();
const userDoc = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ verifyIdToken: verify }),
  adminDb: () => ({ collection: (c: string) => ({ doc: (id: string) => ({ get: async () => userDoc(c, id) }) }) }),
}));
import { requireRole, HttpError, _resetRoleCache } from "@/lib/auth/server";
const roleDoc = (role?: unknown) => ({ exists: role !== undefined, data: () => ({ role }) });
import { rateLimit, _resetRateLimits } from "@/lib/ratelimit";

const req = (t?: string) => new Request("http://x", { headers: t ? { authorization: `Bearer ${t}` } : {} });
beforeEach(() => { verify.mockReset(); userDoc.mockReset(); _resetRoleCache(); _resetRateLimits(); });

describe("requireRole (role from users/{uid})", () => {
  it("401 without token", async () => { await expect(requireRole(req())).rejects.toMatchObject({ status: 401 }); });
  it("401 on invalid token", async () => { verify.mockRejectedValue(new Error("bad")); await expect(requireRole(req("t"))).rejects.toMatchObject({ status: 401 }); });
  it("403 when there is no users/{uid} document", async () => { verify.mockResolvedValue({ uid: "u" }); userDoc.mockResolvedValue(roleDoc()); await expect(requireRole(req("t"))).rejects.toMatchObject({ status: 403 }); });
  it("403 for an unknown role value", async () => { verify.mockResolvedValue({ uid: "u" }); userDoc.mockResolvedValue(roleDoc("superuser")); await expect(requireRole(req("t"))).rejects.toMatchObject({ status: 403 }); });
  it("403 recorder on an admin route", async () => { verify.mockResolvedValue({ uid: "u" }); userDoc.mockResolvedValue(roleDoc("recorder")); await expect(requireRole(req("t"), ["admin"])).rejects.toBeInstanceOf(HttpError); });
  it("passes admin and reads users/{uid}", async () => {
    verify.mockResolvedValue({ uid: "u1", email: "a@b.c" }); userDoc.mockResolvedValue(roleDoc("admin"));
    await expect(requireRole(req("t"), ["admin"])).resolves.toEqual({ uid: "u1", email: "a@b.c", role: "admin" });
    expect(userDoc).toHaveBeenCalledWith("users", "u1");
  });
  it("ignores any role claim in the token", async () => { verify.mockResolvedValue({ uid: "u", role: "admin" }); userDoc.mockResolvedValue(roleDoc()); await expect(requireRole(req("t"))).rejects.toMatchObject({ status: 403 }); });
  it("checks token revocation", async () => { verify.mockResolvedValue({ uid: "u" }); userDoc.mockResolvedValue(roleDoc("admin")); await requireRole(req("t")); expect(verify).toHaveBeenCalledWith("t", true); });
  it("caches a role briefly but never caches 'no role'", async () => {
    verify.mockResolvedValue({ uid: "u" });
    userDoc.mockResolvedValue(roleDoc("recorder")); await requireRole(req("t")); await requireRole(req("t")); expect(userDoc).toHaveBeenCalledTimes(1);
    _resetRoleCache(); userDoc.mockReset(); userDoc.mockResolvedValue(roleDoc());
    await expect(requireRole(req("t"))).rejects.toBeTruthy();
    userDoc.mockResolvedValue(roleDoc("admin")); await expect(requireRole(req("t"))).resolves.toMatchObject({ role: "admin" });
  });
});
describe("rateLimit", () => {
  it("blocks over limit then resets", () => {
    expect(rateLimit("k", 2, 1000, 0).ok).toBe(true); expect(rateLimit("k", 2, 1000, 1).ok).toBe(true);
    expect(rateLimit("k", 2, 1000, 2).ok).toBe(false); expect(rateLimit("k", 2, 1000, 1001).ok).toBe(true);
  });
});
