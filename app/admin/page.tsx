"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  email: string;
  role: string;
  createdAt: string;
};

type UsersResponse = {
  users: User[];
  currentUserId: number;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<number | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/admin/users");
        const data: UsersResponse = await res.json();

        if (!res.ok) {
          setError((data as any)?.error || "Ошибка загрузки");
          return;
        }

        setUsers(data.users);
        setCurrentUserId(data.currentUserId);
      } catch (e) {
        console.error(e);
        setError("Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const changeRole = async (userId: number, newRole: "admin" | "user") => {
    setError(null);
    setActionUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Не удалось изменить роль");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === data.id ? { ...u, role: data.role } : u))
      );
    } catch (e) {
      console.error(e);
      setError("Не удалось изменить роль");
    } finally {
      setActionUserId(null);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const regular = users.filter((u) => u.role !== "admin").length;
    return { total, admins, regular };
  }, [users]);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Панель администратора
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Просмотр пользователей и управление ролями
          </p>
        </div>
      </header>

      {/* Loading / Error */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Загрузка пользователей...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {/* Stats */}
      {!loading && !error ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Пользователей" value={stats.total} hint="Всего" />
          <StatCard title="Админов" value={stats.admins} hint="Доступ к управлению" />
          <StatCard title="Пользователей" value={stats.regular} hint="Обычные роли" />
        </div>
      ) : null}

      {/* Table card */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Пользователи</div>
              <div className="mt-1 text-sm text-slate-500">
                Нельзя менять собственную роль
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200">
          {!loading && !error && users.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">Пользователей пока нет.</div>
          ) : null}

          {!loading && !error && users.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Роль</th>
                    <th className="px-5 py-3 font-semibold">Создан</th>
                    <th className="px-5 py-3 font-semibold text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isCurrent = currentUserId === u.id;
                    const isAdmin = u.role === "admin";

                    return (
                      <tr
                        key={u.id}
                        className="border-t border-slate-100 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900">{u.email}</div>
                          {isCurrent ? (
                            <div className="mt-1 text-xs text-slate-500">(это вы)</div>
                          ) : null}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                              isAdmin
                                ? "bg-violet-500/10 text-violet-700 border-violet-200"
                                : "bg-slate-500/10 text-slate-700 border-slate-200"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {new Date(u.createdAt).toLocaleString("ru-RU")}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {isCurrent ? (
                            <span className="text-xs text-slate-400">
                              Нельзя менять собственную роль
                            </span>
                          ) : (
                            <div className="inline-flex gap-2">
                              {isAdmin ? (
                                <button
                                  type="button"
                                  disabled={actionUserId === u.id}
                                  onClick={() => changeRole(u.id, "user")}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                                >
                                  {actionUserId === u.id
                                    ? "Сохраняю..."
                                    : "Сделать пользователем"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionUserId === u.id}
                                  onClick={() => changeRole(u.id, "admin")}
                                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition"
                                >
                                  {actionUserId === u.id ? "Сохраняю..." : "Сделать админом"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
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
