import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Staff } from "@/lib/auth/server";

export type AuditAction = "create" | "edit" | "void" | "template_change" | "export" | "settings_change" | "member_change" | "sms_retry";

export async function audit(staff: Staff, action: AuditAction, target: string, details: Record<string, unknown> = {}) {
  await adminDb().collection("auditLogs").add({
    action, target, details,
    by: { uid: staff.uid, email: staff.email },
    at: new Date(), // stored as UTC timestamp
  });
}
