"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }

      router.push("/login");
    } catch (error) {
      console.error(error);
      setError("Ошибка подключения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Регистрация</h1>
          <p className="text-sm text-slate-500">
            Создай аккаунт, чтобы начать работу
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@example.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                         bg-white text-slate-900 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                         bg-white text-slate-900 placeholder:text-slate-500
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white
                       hover:bg-violet-700 transition disabled:opacity-60"
          >
            {loading ? "Создаю аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <a href="/login" className="font-medium text-violet-600 hover:underline">
            Войти
          </a>
        </div>
      </div>
    </div>
  );
}
