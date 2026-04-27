"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import Modal from "./components/Modal";

type Project = {
  id: number;
  name: string;
};

type ProjectSummary = {
  id: number;
  name: string;
  taskCount: number;
};

type Subtask = {
  id: number;
  title: string;
  completed: boolean;
  taskId?: number;
};

type Task = {
  id: number;
  title: string;
  description?: string | null;
  completed: boolean;
  priority: number;
  dueDate?: string | null; // YYYY-MM-DD
  createdAt: string; // ISO
  project?: Project | null;
  subtasks?: Subtask[];
};

type StatusFilter = "all" | "active" | "completed";
type SortOption =
  | "createdAt_desc"
  | "createdAt_asc"
  | "priority_desc"
  | "priority_asc"
  | "dueDate_asc"
  | "dueDate_desc";

type KanbanStatus = "todo" | "in_progress" | "done";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // поля создания задачи
  const [newTitle, setNewTitle] = useState<string>("");
  const [newProject, setNewProject] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newPriority, setNewPriority] = useState<number>(2);
  const [newDueDate, setNewDueDate] = useState<string>("");

  // поля для создания проекта
  const [newProjectName, setNewProjectName] = useState<string>("");

  // поля для создания подзадач (по id задачи)
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<
    Record<number, string>
  >({});

  // фильтры
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("priority_desc");

  // режим отображения
  const [viewMode, setViewMode] = useState<"list" | "board">("board");
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);

  // состояние загрузки/ошибок
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // редактирование задачи
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editProject, setEditProject] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPriority, setEditPriority] = useState<number>(2);
  const [editDueDate, setEditDueDate] = useState<string>("");

  // редактирование проекта
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editProjectName, setEditProjectName] = useState<string>("");

  // статус задачи на Kanban-доске (по id задачи, как строка)
  const [kanbanStatus, setKanbanStatus] = useState<Record<string, KanbanStatus>>(
    {}
  );

  // ================= ЗАГРУЗКА ДАННЫХ =================
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [tasksRes, projectsRes] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/projects"),
        ]);

        if (!tasksRes.ok) throw new Error("Failed to load tasks");
        if (!projectsRes.ok) throw new Error("Failed to load projects");

        const tasksData = await tasksRes.json();
        const projectsData = await projectsRes.json();

        const normalizedTasks: Task[] = tasksData.map((t: any) => ({
          ...t,
          createdAt: t.createdAt,
          dueDate: t.dueDate ? t.dueDate.slice(0, 10) : null,
          subtasks: t.subtasks ?? [],
        }));

        setTasks(normalizedTasks);
        setProjects(projectsData);

        // загрузим сохранённые статусы из localStorage и объединим
        let saved: Record<string, KanbanStatus> = {};
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem("kanbanStatus");
          if (raw) {
            try {
              saved = JSON.parse(raw);
            } catch {
              saved = {};
            }
          }
        }

        const merged: Record<string, KanbanStatus> = { ...saved };
        for (const t of normalizedTasks) {
          const key = t.id.toString();
          if (!merged[key]) merged[key] = t.completed ? "done" : "todo";
        }

        setKanbanStatus(merged);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("kanbanStatus", JSON.stringify(merged));
        }
      } catch (e) {
        console.error(e);
        setError("Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ================= ФУНКЦИИ ПОМОЩНИКИ =================
  const saveKanbanStatus = (
    updater: (prev: Record<string, KanbanStatus>) => Record<string, KanbanStatus>
  ) => {
    setKanbanStatus((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("kanbanStatus", JSON.stringify(next));
      }
      return next;
    });
  };

  const priorityLabel = (p: number) => {
    if (p === 1) return "Высокий";
    if (p === 3) return "Низкий";
    return "Средний";
  };

  const priorityPill = (p: number) => {
    if (p === 1) return "bg-red-500/10 text-red-700 border-red-200";
    if (p === 3) return "bg-slate-500/10 text-slate-700 border-slate-200";
    return "bg-amber-500/10 text-amber-800 border-amber-200";
  };

  // ================= РАБОТА С ЗАДАЧАМИ =================
  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setError(null);

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          projectName: newProject.trim() || null,
          description: newDescription.trim() || null,
          priority: newPriority,
          dueDate: newDueDate || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      const created = await res.json();
      const normalized: Task = {
        ...created,
        createdAt: created.createdAt,
        dueDate: created.dueDate ? created.dueDate.slice(0, 10) : null,
        subtasks: created.subtasks ?? [],
      };

      setTasks((prev) => [...prev, normalized]);
      saveKanbanStatus((prev) => ({
        ...prev,
        [normalized.id.toString()]: "todo",
      }));

      setNewTitle("");
      setNewProject("");
      setNewDescription("");
      setNewPriority(2);
      setNewDueDate("");
    } catch (e) {
      console.error(e);
      setError("Не удалось создать задачу");
    }
    setShowAddTaskForm(false);
  };

  const toggleTask = async (task: Task) => {
    try {
      setError(null);

      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, completed: !task.completed }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      const updated = await res.json();
      const normalized: Task = {
        ...updated,
        createdAt: updated.createdAt,
        dueDate: updated.dueDate ? updated.dueDate.slice(0, 10) : null,
        subtasks: updated.subtasks ?? [],
      };

      setTasks((prev) => prev.map((t) => (t.id === normalized.id ? normalized : t)));

      saveKanbanStatus((prev) => {
        const key = task.id.toString();
        const nextStatus: KanbanStatus = !task.completed ? "done" : "todo";
        return { ...prev, [key]: nextStatus };
      });
    } catch (e) {
      console.error(e);
      setError("Не удалось обновить задачу");
    }
  };

  const deleteTask = async (id: number) => {
    try {
      setError(null);

      const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete task");

      setTasks((prev) => prev.filter((t) => t.id !== id));

      saveKanbanStatus((prev) => {
        const next = { ...prev };
        delete next[id.toString()];
        return next;
      });

      if (editingTaskId === id) setEditingTaskId(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить задачу");
    }
  };

  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditProject(task.project?.name || "");
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate || "");
  };

  const cancelEditTask = () => setEditingTaskId(null);

  const saveEditTask = async (task: Task) => {
    if (!editTitle.trim()) return;

    try {
      setError(null);

      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          title: editTitle.trim(),
          projectName: editProject.trim(),
          description: editDescription.trim(),
          priority: editPriority,
          dueDate: editDueDate || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      const updated = await res.json();
      const normalized: Task = {
        ...updated,
        createdAt: updated.createdAt,
        dueDate: updated.dueDate ? updated.dueDate.slice(0, 10) : null,
        subtasks: updated.subtasks ?? [],
      };

      setTasks((prev) => prev.map((t) => (t.id === normalized.id ? normalized : t)));
      setEditingTaskId(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось сохранить изменения");
    }
  };

  // ================= РАБОТА С ПОДЗАДАЧАМИ =================
  const handleAddSubtask = async (taskId: number) => {
    const title = (newSubtaskTitles[taskId] || "").trim();
    if (!title) return;

    try {
      setError(null);

      const res = await fetch("/api/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, title }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create subtask");

      const created: Subtask = {
        id: data.id,
        title: data.title,
        completed: data.completed,
        taskId: data.taskId,
      };

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), created] } : t
        )
      );

      setNewSubtaskTitles((prev) => ({ ...prev, [taskId]: "" }));
    } catch (e) {
      console.error(e);
      setError("Не удалось создать подзадачу");
    }
  };

  const handleToggleSubtask = async (taskId: number, subtask: Subtask) => {
    try {
      setError(null);

      const res = await fetch("/api/subtasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subtask.id, completed: !subtask.completed }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update subtask");

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: (t.subtasks ?? []).map((s) =>
                  s.id === subtask.id ? { ...s, completed: data.completed, title: data.title } : s
                ),
              }
            : t
        )
      );
    } catch (e) {
      console.error(e);
      setError("Не удалось обновить подзадачу");
    }
  };

  const handleDeleteSubtask = async (taskId: number, subtaskId: number) => {
    try {
      setError(null);

      const res = await fetch(`/api/subtasks?id=${subtaskId}`, { method: "DELETE" });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to delete subtask");
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subtaskId) }
            : t
        )
      );
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить подзадачу");
    }
  };

  // ================= РАБОТА С ПРОЕКТАМИ =================
  const handleAddProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setError(null);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to create project");

      const created: ProjectSummary = await res.json();

      setProjects((prev) => {
        const exists = prev.find((p) => p.id === created.id);
        if (exists) return prev.map((p) => (p.id === created.id ? created : p));
        return [...prev, created];
      });

      setNewProjectName("");
    } catch (e) {
      console.error(e);
      setError("Не удалось создать проект");
    }
  };

  const startEditProject = (project: ProjectSummary) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name);
  };

  const cancelEditProject = () => setEditingProjectId(null);

  const saveEditProject = async (project: ProjectSummary) => {
    if (!editProjectName.trim()) return;

    try {
      setError(null);

      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, name: editProjectName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to update project");

      const updated: ProjectSummary = await res.json();

      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      // обновим имя проекта в задачах
      setTasks((prev) =>
        prev.map((t) =>
          t.project && t.project.id === updated.id
            ? { ...t, project: { ...t.project, name: updated.name } }
            : t
        )
      );

      setEditingProjectId(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось сохранить проект");
    }
  };

  const deleteProject = async (project: ProjectSummary) => {
    try {
      setError(null);

      const res = await fetch(`/api/projects?id=${project.id}`, { method: "DELETE" });

      if (!res.ok && res.status !== 204) throw new Error("Failed to delete project");

      setProjects((prev) => prev.filter((p) => p.id !== project.id));

      // у задач этого проекта убираем ссылку на проект
      setTasks((prev) =>
        prev.map((t) =>
          t.project && t.project.id === project.id ? { ...t, project: null } : t
        )
      );

      if (editingProjectId === project.id) setEditingProjectId(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить проект");
    }
  };

  // ================= ФИЛЬТРЫ, СОРТ, ПРОЕКТЫ =================
  const projectOptions = useMemo(() => {
    return Array.from(new Set(["Общий", ...projects.map((p) => p.name)]));
  }, [projects]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const projectName = task.project?.name || "Общий";
      if (statusFilter === "active" && task.completed) return false;
      if (statusFilter === "completed" && !task.completed) return false;
      if (projectFilter !== "all" && projectName !== projectFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, projectFilter]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      switch (sortOption) {
        case "priority_desc":
          return a.priority === b.priority ? 0 : a.priority - b.priority;
        case "priority_asc":
          return a.priority === b.priority ? 0 : b.priority - a.priority;
        case "dueDate_asc": {
          const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return ad - bd;
        }
        case "dueDate_desc": {
          const ad = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bd = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return bd - ad;
        }
        case "createdAt_asc": {
          const ad = new Date(a.createdAt).getTime();
          const bd = new Date(b.createdAt).getTime();
          return ad - bd;
        }
        case "createdAt_desc":
        default: {
          const ad = new Date(a.createdAt).getTime();
          const bd = new Date(b.createdAt).getTime();
          return bd - ad;
        }
      }
    });
  }, [filteredTasks, sortOption]);

  // ================= KANBAN =================
  const kanbanTasks = useMemo(() => {
    return sortedTasks.map((task) => {
      const key = task.id.toString();
      const status: KanbanStatus = kanbanStatus[key] ?? (task.completed ? "done" : "todo");
      return { ...task, boardStatus: status };
    });
  }, [sortedTasks, kanbanStatus]);

  const kanbanColumns: Record<KanbanStatus, typeof kanbanTasks> = useMemo(() => {
    const cols: Record<KanbanStatus, typeof kanbanTasks> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    kanbanTasks.forEach((t) => cols[t.boardStatus].push(t));
    return cols;
  }, [kanbanTasks]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId as KanbanStatus;
    const destStatus = destination.droppableId as KanbanStatus;
    if (sourceStatus === destStatus) return;

    saveKanbanStatus((prev) => ({ ...prev, [draggableId]: destStatus }));

    const movedToDone = destStatus === "done";
    const movedFromDone = sourceStatus === "done" && destStatus !== "done";

    if (movedToDone || movedFromDone) {
      const shouldBeCompleted = destStatus === "done";

      setTasks((prev) =>
        prev.map((t) =>
          t.id.toString() === draggableId ? { ...t, completed: shouldBeCompleted } : t
        )
      );

      fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(draggableId), completed: shouldBeCompleted }),
      }).catch((e) => console.error("Kanban update error:", e));
    }
  };

  // ================= Метрики для верхних карточек =================
  const stats = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter((t) => !t.completed).length;
    const done = tasks.filter((t) => t.completed).length;
    const urgent = tasks.filter((t) => !t.completed && t.priority === 1).length;
    return { total, active, done, urgent };
  }, [tasks]);

  // ================= RENDER =================
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Задачи
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Управление задачами и проектами — список или Kanban-доска
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                viewMode === "list"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Список
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                viewMode === "board"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Доска
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/logout", { method: "POST" });
              } catch (e) {
                console.error(e);
              } finally {
                window.location.href = "/login";
              }
            }}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Loading / Error */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Загрузка данных...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Активные" value={stats.active} hint={`${stats.total} всего`} />
        <StatCard title="Выполнено" value={stats.done} hint={stats.total ? `${Math.round((stats.done / stats.total) * 100)}%` : "0%"} />
        <StatCard title="Срочные" value={stats.urgent} hint="Высокий приоритет" />
        <StatCard title="Проекты" value={projects.length} hint="Группы задач" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-lg font-semibold text-slate-900">Управление</div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowAddTaskForm(true)}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 transition"
          >
            + Новая задача
          </button>
        </div>
      </div>

      {/* Add Task Modal */}
      <Modal open={showAddTaskForm} title="Новая задача" onClose={() => setShowAddTaskForm(false)}>
        <form onSubmit={handleAddTask} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Название задачи
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Что нужно сделать?"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Проект (необязательно)
            </label>
            <input
              type="text"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              placeholder="Например: Работа, Учёба, Личный"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Описание (необязательно)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              placeholder="Кратко распиши шаги, детали, ссылки..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Приоритет
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <option value={1}>Высокий</option>
                <option value={2}>Средний</option>
                <option value={3}>Низкий</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Срок (необязательно)
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 text-white text-sm font-medium py-2 hover:bg-violet-700 transition"
          >
            Добавить задачу
          </button>
        </form>
      </Modal>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Статус */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
              Статус
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  statusFilter === "all"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  statusFilter === "active"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Активные
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  statusFilter === "completed"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Выполненные
              </button>
            </div>
          </div>

          {/* Проект */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
              Проект
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="all">Все проекты</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          {/* Сортировка */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
              Сортировать по
            </div>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="priority_desc">Приоритет (высокий → низкий)</option>
              <option value="priority_asc">Приоритет (низкий → высокий)</option>
              <option value="dueDate_asc">Срок (ближайшие сначала)</option>
              <option value="dueDate_desc">Срок (дальние сначала)</option>
              <option value="createdAt_desc">Новые сначала</option>
              <option value="createdAt_asc">Старые сначала</option>
            </select>
          </div>
        </div>
      </section>

      {/* Content */}
      {viewMode === "list" ? (
        <section className="space-y-4">
          {sortedTasks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Задач, подходящих под выбранные фильтры, нет.
            </div>
          ) : (
            sortedTasks.map((task) => {
              const projectName = task.project?.name || "Общий";
              const isEditing = editingTaskId === task.id;

              const subtasks = task.subtasks ?? [];
              const doneSubtasks = subtasks.filter((s) => s.completed).length;
              const progress =
                subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : null;

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task)}
                        className="mt-1 h-4 w-4"
                      />

                      {!isEditing ? (
                        <div className="min-w-0">
                          <div
                            className={`text-sm font-semibold ${
                              task.completed ? "line-through text-slate-400" : "text-slate-900"
                            }`}
                          >
                            {task.title}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                              {projectName}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-1 ${priorityPill(task.priority)}`}
                            >
                              {priorityLabel(task.priority)}
                            </span>

                            {task.dueDate ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                Срок: {task.dueDate}
                              </span>
                            ) : null}

                            {subtasks.length > 0 ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                Чеклист: {doneSubtasks}/{subtasks.length}
                              </span>
                            ) : null}
                          </div>

                          {task.description ? (
                            <div className="mt-3 whitespace-pre-line text-xs text-slate-600">
                              {task.description}
                            </div>
                          ) : null}

                          {/* Progress */}
                          {progress !== null ? (
                            <div className="mt-4">
                              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                <span>Progress</span>
                                <span className="font-medium text-slate-700">{progress}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-slate-900"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          ) : null}

                          {/* Подзадачи */}
                          {subtasks.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              <div className="text-[11px] font-semibold text-slate-700">
                                Подзадачи
                              </div>

                              <div className="space-y-1">
                                {subtasks.map((subtask) => (
                                  <div
                                    key={subtask.id}
                                    className="flex items-center justify-between gap-2 text-[11px]"
                                  >
                                    <label className="inline-flex items-center gap-2 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={subtask.completed}
                                        onChange={() => handleToggleSubtask(task.id, subtask)}
                                        className="h-3 w-3"
                                      />
                                      <span
                                        className={
                                          subtask.completed
                                            ? "line-through text-slate-400"
                                            : "text-slate-700"
                                        }
                                      >
                                        {subtask.title}
                                      </span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                      className="text-[10px] text-red-600 hover:text-red-700"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Добавление подзадачи */}
                          <div className="mt-4 flex items-center gap-2">
                            <input
                              type="text"
                              value={newSubtaskTitles[task.id] ?? ""}
                              onChange={(e) =>
                                setNewSubtaskTitles((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.value,
                                }))
                              }
                              placeholder="Новая подзадача"
                              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddSubtask(task.id)}
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 transition"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                          />
                          <input
                            type="text"
                            value={editProject}
                            onChange={(e) => setEditProject(e.target.value)}
                            placeholder="Проект"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            placeholder="Описание"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-y"
                          />
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(Number(e.target.value))}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            >
                              <option value={1}>Высокий</option>
                              <option value={2}>Средний</option>
                              <option value={3}>Низкий</option>
                            </select>
                            <input
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row gap-2 md:flex-col md:items-end md:justify-start">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => startEditTask(task)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100 transition"
                          >
                            Удалить
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => saveEditTask(task)}
                            className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={cancelEditTask}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition"
                          >
                            Отмена
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : (
        <section>
          {sortedTasks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Задач, подходящих под выбранные фильтры, нет.
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid gap-4 md:grid-cols-3">
                {(["todo", "in_progress", "done"] as KanbanStatus[]).map((columnId) => {
                  const title =
                    columnId === "todo"
                      ? "Нужно сделать"
                      : columnId === "in_progress"
                      ? "В работе"
                      : "Готово";

                  const columnTasks = kanbanColumns[columnId];

                  return (
                    <Droppable droppableId={columnId} key={columnId}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                            snapshot.isDraggingOver ? "ring-2 ring-violet-500" : ""
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                              {columnTasks.length}
                            </span>
                          </div>

                          <div className="space-y-3 min-h-[120px]">
                            {columnTasks.map((task, index) => {
                              const projectName = task.project?.name || "Общий";
                              const subtasks = task.subtasks ?? [];
                              const doneSubtasks = subtasks.filter((s) => s.completed).length;

                              return (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id.toString()}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm ${
                                        snapshot.isDragging ? "ring-2 ring-violet-500 bg-white" : ""
                                      }`}
                                    >
                                      <div className="text-sm font-semibold text-slate-900">
                                        {task.title}
                                      </div>

                                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                          {projectName}
                                        </span>
                                        <span
                                          className={`rounded-full border px-2 py-1 ${priorityPill(
                                            task.priority
                                          )}`}
                                        >
                                          {priorityLabel(task.priority)}
                                        </span>
                                        {task.dueDate ? (
                                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                            {task.dueDate}
                                          </span>
                                        ) : null}
                                        {subtasks.length > 0 ? (
                                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                            {doneSubtasks}/{subtasks.length}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </section>
      )}

      {/* Projects */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Проекты</h2>
            <p className="mt-1 text-sm text-slate-500">
              Группировка задач по направлениям
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddProjectForm((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            {showAddProjectForm ? "Скрыть форму" : "+ Новый проект"}
          </button>
        </div>

        {showAddProjectForm ? (
          <form onSubmit={handleAddProject} className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Название проекта"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
            >
              Добавить
            </button>
          </form>
        ) : null}

        <div className="space-y-2">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Пока нет проектов. Создай первый, чтобы группировать задачи.
            </div>
          ) : (
            projects.map((project) => {
              const isEditing = editingProjectId === project.id;

              return (
                <div
                  key={project.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    {!isEditing ? (
                      <>
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {project.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Задач: {project.taskCount}
                        </div>
                      </>
                    ) : (
                      <input
                        type="text"
                        value={editProjectName}
                        onChange={(e) => setEditProjectName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => startEditProject(project)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition"
                        >
                          Переименовать
                        </button>
                        <button
                          onClick={() => deleteProject(project)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100 transition"
                        >
                          Удалить
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveEditProject(project)}
                          className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={cancelEditProject}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition"
                        >
                          Отмена
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-500">{hint}</div> : null}
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-100" />
    </div>
  );
}
