import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
export const runtime = "nodejs";
export const GET = route(["admin", "recorder"], async (_req, staff) => NextResponse.json({ uid: staff.uid, email: staff.email, role: staff.role }));
