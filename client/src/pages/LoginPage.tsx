import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Simple password gate. On success `useAuth().login` flips the reactive auth
 * flag (so the `/admin` route guard immediately admits us) and we navigate.
 * No page refresh needed — that was the old bug.
 */
export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(password);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl">♠</div>
          <h1 className="mt-2 text-2xl font-bold">Вход в админку</h1>
          <p className="mt-1 text-sm text-slate-400">
            Введите пароль для управления турниром
          </p>
        </div>

        <label className="mb-2 block text-sm font-medium text-slate-300">
          Пароль
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-gold"
          placeholder="••••••••"
        />

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-6 w-full rounded-lg bg-gold px-4 py-3 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Вход…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
