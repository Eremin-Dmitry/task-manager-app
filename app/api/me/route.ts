import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sessionUserId = request.cookies.get("sessionUserId")?.value || null;
  const role = request.cookies.get("sessionRole")?.value || null;

  if (!sessionUserId) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const userId = Number(sessionUserId);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: { id: userId, role },
  });
}
