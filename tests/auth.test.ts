import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const verify = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({ adminAuth: () => ({ verifyIdToken: verify }) }));
import { requireRole, HttpError } from "@/lib/auth/server";
import { rateLimit, _resetRateLimits } from "@/lib/ratelimit";

const req = (t?: string) => new Request("http://x", { headers: t ? { authorization: `Bearer ${t}` } : {} });
beforeEach(() => { verify.mockReset(); _resetRateLimits(); });

describe("requireRole", () => {
  it("401 without token", async () => { await expect(requireRole(req())).rejects.toMatchObject({ status: 401 }); });
  it("401 on invalid token", async () => { verify.mockRejectedValue(new Error("bad")); await expect(requireRole(req("t"))).rejects.toMatchObject({ status: 401 }); });
  it("403 without role claim", async () => { verify.mockResolvedValue({ uid: "u" }); await expect(requireRole(req("t"))).rejects.toMatchObject({ status: 403 }); });
  it("403 recorder on admin route", async () => { verify.mockResolvedValue({ uid: "u", role: "recorder" }); await expect(requireRole(req("t"), ["admin"])).rejects.toBeInstanceOf(HttpError); });
  it("passes admin", async () => { verify.mockResolvedValue({ uid: "u", email: "a@b.c", role: "admin" }); await expect(requireRole(req("t"), ["admin"])).resolves.toEqual({ uid: "u", email: "a@b.c", role: "admin" }); });
  it("checks revocation", async () => { verify.mockResolvedValue({ uid: "u", role: "admin" }); await requireRole(req("t")); expect(verify).toHaveBeenCalledWith("t", true); });
});
describe("rateLimit", () => {
  it("blocks over limit then resets", () => {
    expect(rateLimit("k", 2, 1000, 0).ok).toBe(true); expect(rateLimit("k", 2, 1000, 1).ok).toBe(true);
    expect(rateLimit("k", 2, 1000, 2).ok).toBe(false); expect(rateLimit("k", 2, 1000, 1001).ok).toBe(true);
  });
});
