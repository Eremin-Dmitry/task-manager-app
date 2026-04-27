import { NextRequest } from "next/server";

export function getSession(request: NextRequest) {
  const sessionUserIdRaw = request.cookies.get("sessionUserId")?.value;
  const role = request.cookies.get("sessionRole")?.value ?? null;

  const userId = sessionUserIdRaw ? Number(sessionUserIdRaw) : NaN;
  if (!sessionUserIdRaw || Number.isNaN(userId)) {
    return { userId: null as number | null, role: null as string | null };
  }

  return { userId, role };
}

export function requireAuth(request: NextRequest) {
  const s = getSession(request);
  if (!s.userId) throw new Error("UNAUTHORIZED");
  return s as { userId: number; role: string | null };
}
