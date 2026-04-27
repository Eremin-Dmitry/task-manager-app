import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getSession(request: NextRequest): { userId: number | null; role: string | null } {
  const sessionUserId = request.cookies.get("sessionUserId")?.value;
  const role = request.cookies.get("sessionRole")?.value ?? null;

  if (!sessionUserId) return { userId: null, role };
  const id = Number(sessionUserId);
  if (Number.isNaN(id)) return { userId: null, role };
  return { userId: id, role };
}

function isAdmin(role: string | null) {
  return role === "admin";
}

async function getUserDepartmentId(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (user?.departmentId) return user.departmentId;

  const department = await prisma.department.upsert({
    where: { name: "Общий" },
    update: {},
    create: { name: "Общий" },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { departmentId: department.id },
  });

  return department.id;
}

// GET /api/projects — список проектов + количество задач
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const projects = await prisma.project.findMany({
      where: isAdmin(role) ? {} : { createdById: userId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      taskCount: p._count.tasks,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// POST /api/projects — создать проект для текущего пользователя
export async function POST(request: NextRequest) {
  try {
    const { userId } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return new NextResponse("Name is required", { status: 400 });
    }

    const trimmedName = name.trim();
    const departmentId = await getUserDepartmentId(userId);

    // Проект создаётся "моим" (авторским) и в моём отделе — даже если я админ
    const existing = await prisma.project.findFirst({
      where: { name: trimmedName, createdById: userId, departmentId },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    if (existing) {
      return NextResponse.json(
        { id: existing.id, name: existing.name, taskCount: existing._count.tasks },
        { status: 200 }
      );
    }

    const created = await prisma.project.create({
      data: { name: trimmedName, createdById: userId, departmentId },
      include: { _count: { select: { tasks: true } } },
    });

    return NextResponse.json(
      { id: created.id, name: created.name, taskCount: created._count.tasks },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PUT /api/projects — переименовать проект
export async function PUT(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id, name } = await request.json();

    if (!id) return new NextResponse("ID is required", { status: 400 });
    if (!name || !name.trim()) return new NextResponse("Name is required", { status: 400 });

    const trimmedName = name.trim();

    const existing = await prisma.project.findFirst({
      where: isAdmin(role) ? { id } : { id, createdById: userId },
      include: { _count: { select: { tasks: true } } },
    });

    if (!existing) return new NextResponse("Project not found", { status: 404 });

    const updated = await prisma.project.update({
      where: { id: existing.id },
      data: { name: trimmedName },
      include: { _count: { select: { tasks: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      taskCount: updated._count.tasks,
    });
  } catch (error) {
    console.error("PUT /api/projects error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE /api/projects?id=123 — удалить проект
export async function DELETE(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) return new NextResponse("ID is required", { status: 400 });

    const id = Number(idParam);
    if (Number.isNaN(id)) return new NextResponse("ID must be a number", { status: 400 });

    const existing = await prisma.project.findFirst({
      where: isAdmin(role) ? { id } : { id, createdById: userId },
    });

    if (!existing) return new NextResponse("Project not found", { status: 404 });

    // Сбросим projectId у задач этого проекта.
    // Если админ удаляет чужой проект — сбрасываем для владельца проекта.
    await prisma.task.updateMany({
      where: { projectId: existing.id },
      data: { projectId: null },
    });


    await prisma.project.delete({ where: { id: existing.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/projects error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
