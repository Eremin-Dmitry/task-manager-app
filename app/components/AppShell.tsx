"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: ReactNode;
};

type MeResponse = {
  user: { id: number; role: string | null } | null;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isAuthPage = pathname === "/login" || pathname === "/register";

  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthPage) return;

    fetch("/api/me")
      .then((r) => r.json())
      .then((data: MeResponse) => setRole(data?.user?.role ?? null))
      .catch(() => setRole(null));
  }, [isAuthPage]);

  const isAdmin = role === "admin";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-6 flex flex-col gap-4">
        <div className="text-sm font-semibold text-slate-900 mb-4">
          Task Manager
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          <a
            href="/"
            className={`px-2 py-1 rounded-md hover:bg-slate-100 ${
              pathname === "/"
                ? "bg-slate-900 text-white hover:bg-slate-900"
                : "text-slate-800"
            }`}
          >
            Задачи
          </a>

          {/* показываем только админу */}
          {isAdmin && (
            <a
              href="/admin"
              className={`px-2 py-1 rounded-md hover:bg-slate-100 ${
                pathname.startsWith("/admin")
                  ? "bg-slate-900 text-white hover:bg-slate-900"
                  : "text-slate-800"
              }`}
            >
              Админ-панель
            </a>
          )}
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
