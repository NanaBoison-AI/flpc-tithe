import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
import { getDashboard } from "@/lib/dashboard.server";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = route(["admin", "recorder"], async () => NextResponse.json(await getDashboard()));
