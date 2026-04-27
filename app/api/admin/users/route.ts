import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["admin", "manager", "user"] as const;

export async function GET(request: NextRequest) {
  const role = request.cookies.get("sessionRole")?.value;
  const sessionUserId = Number(request.cookies.get("sessionUserId")?.value);

  if (role !== "admin" || Number.isNaN(sessionUserId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      department: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      department: u.department
        ? { id: u.department.id, name: u.department.name }
        : null,
      createdAt: u.createdAt,
    })),
    departments,
    currentUserId: sessionUserId,
  });
}

export async function PATCH(request: NextRequest) {
  const role = request.cookies.get("sessionRole")?.value;
  const adminId = Number(request.cookies.get("sessionUserId")?.value);

  if (role !== "admin" || Number.isNaN(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, role: newRole, departmentId } = await request.json();

  if (!id || id === adminId) {
    return NextResponse.json(
      { error: "Нельзя изменять самого себя" },
      { status: 400 }
    );
  }

  if (newRole && !ALLOWED_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      role: newRole,
      departmentId: departmentId ?? undefined,
    },
    include: { department: true },
  });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    role: updated.role,
    department: updated.department
      ? { id: updated.department.id, name: updated.department.name }
      : null,
  });
}
