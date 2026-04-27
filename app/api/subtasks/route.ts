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

// POST /api/subtasks — создать подзадачу
export async function POST(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await request.json();
    const { taskId, title } = body as { taskId?: number; title?: string };

    if (!taskId || !title || !title.trim()) {
      return NextResponse.json({ error: "taskId и title обязательны" }, { status: 400 });
    }

    const task = await prisma.task.findFirst({
      where: isAdmin(role) ? { id: taskId } : { id: taskId, userId },
    });

    if (!task) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    const subtask = await prisma.subtask.create({
      data: {
        title: title.trim(),
        taskId: task.id,
      },
      select: {
        id: true,
        title: true,
        completed: true,
        taskId: true,
      },
    });

    return NextResponse.json(subtask, { status: 201 });
  } catch (error) {
    console.error("POST /api/subtasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PUT /api/subtasks — обновить подзадачу
export async function PUT(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await request.json();
    const { id, title, completed } = body as {
      id?: number;
      title?: string;
      completed?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    const subtask = await prisma.subtask.findUnique({
      where: { id },
      include: {
        task: true,
      },
    });

    if (!subtask) {
      return NextResponse.json({ error: "Подзадача не найдена" }, { status: 404 });
    }

    if (!isAdmin(role) && subtask.task.userId !== userId) {
      return NextResponse.json({ error: "Подзадача не найдена" }, { status: 404 });
    }

    const updated = await prisma.subtask.update({
      where: { id },
      data: {
        title:
          typeof title === "string" && title.trim() ? title.trim() : subtask.title,
        completed: typeof completed === "boolean" ? completed : subtask.completed,
      },
      select: {
        id: true,
        title: true,
        completed: true,
        taskId: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/subtasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE /api/subtasks?id=123
export async function DELETE(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    const id = Number(idParam);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "id должен быть числом" }, { status: 400 });
    }

    const subtask = await prisma.subtask.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!subtask) {
      return NextResponse.json({ error: "Подзадача не найдена" }, { status: 404 });
    }

    if (!isAdmin(role) && subtask.task.userId !== userId) {
      return NextResponse.json({ error: "Подзадача не найдена" }, { status: 404 });
    }

    await prisma.subtask.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/subtasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
