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

async function getDefaultDepartmentId() {
  const department = await prisma.department.upsert({
    where: { name: "Общий" },
    update: {},
    create: { name: "Общий" },
  });
  return department.id;
}

// GET /api/tasks
export async function GET(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const tasks = await prisma.task.findMany({
      where: isAdmin(role) ? {} : { createdById: userId },
      include: {
        project: true,
        subtasks: {
          select: {
            id: true,
            title: true,
            completed: true,
          },
          orderBy: {
            id: "asc",
          },
        },
      },
      orderBy: [
        { completed: "asc" },
        { priority: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// POST /api/tasks — создать задачу
export async function POST(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await request.json();
    const { title, projectName, description, priority, dueDate } = body as {
      title: string;
      projectName?: string | null;
      description?: string | null;
      priority?: number;
      dueDate?: string | null;
    };

    if (!title || !title.trim()) {
      return new NextResponse("Title is required", { status: 400 });
    }

    let projectId: number | null = null;

    if (projectName && projectName.trim()) {
      const name = projectName.trim();
      const departmentId = await getDefaultDepartmentId();

      // проект подбираем в рамках владельца и отдела
      const existingProject = await prisma.project.findFirst({
        where: { name, createdById: userId, departmentId },
      });

      const project =
        existingProject ??
        (await prisma.project.create({
          data: { name, createdById: userId, departmentId },
        }));

      projectId = project.id;
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        completed: false,
        priority: typeof priority === "number" ? priority : 2,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        createdById: userId, // автор задачи всегда текущий пользователь
      },
      include: {
        project: true,
        subtasks: {
          select: {
            id: true,
            title: true,
            completed: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PUT /api/tasks — обновление задачи
export async function PUT(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await request.json();
    const { id, completed, title, description, priority, dueDate, projectName } = body as {
      id: number;
      completed?: boolean;
      title?: string;
      description?: string | null;
      priority?: number;
      dueDate?: string | null;
      projectName?: string | null;
    };

    if (!id) return new NextResponse("ID is required", { status: 400 });

    // доступ: админ может любую, пользователь — только свою
    const existing = await prisma.task.findFirst({
      where: isAdmin(role) ? { id } : { id, createdById: userId },
      include: { project: true },
    });

    if (!existing) return new NextResponse("Task not found", { status: 404 });

    let projectId = existing.projectId;

    // ВАЖНО: если админ редактирует чужую задачу и меняет projectName,
    // проект ищем/создаём у ВЛАДЕЛЬЦА задачи (existing.userId), а не у админа.
    if (typeof projectName === "string") {
      const name = projectName.trim();

      if (name) {
        const ownerUserId = existing.createdById;
        const departmentId = existing.project?.departmentId ?? (await getDefaultDepartmentId());

        const existingProject = await prisma.project.findFirst({
          where: { name, createdById: ownerUserId, departmentId },
        });

        const project =
          existingProject ??
          (await prisma.project.create({
            data: { name, createdById: ownerUserId, departmentId },
          }));

        projectId = project.id;
      } else {
        projectId = null;
      }
    }

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data: {
        completed: typeof completed === "boolean" ? completed : existing.completed,
        title:
          typeof title === "string" && title.trim() ? title.trim() : existing.title,
        description:
          typeof description === "string" ? description.trim() || null : existing.description,
        priority: typeof priority === "number" ? priority : existing.priority,
        dueDate:
          typeof dueDate === "string"
            ? dueDate
              ? new Date(dueDate)
              : null
            : existing.dueDate,
        projectId,
      },
      include: {
        project: true,
        subtasks: {
          select: {
            id: true,
            title: true,
            completed: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/tasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE /api/tasks?id=123
export async function DELETE(request: NextRequest) {
  try {
    const { userId, role } = getSession(request);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) return new NextResponse("ID is required", { status: 400 });

    const id = Number(idParam);
    if (Number.isNaN(id)) return new NextResponse("ID must be a number", { status: 400 });

    const existing = await prisma.task.findFirst({
      where: isAdmin(role) ? { id } : { id, createdById: userId },
    });

    if (!existing) return new NextResponse("Task not found", { status: 404 });

    await prisma.task.delete({ where: { id: existing.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/tasks error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
