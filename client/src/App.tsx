import { Link, Outlet } from "react-router-dom";

/**
 * Minimal shell with a small top nav. On the display page the nav is hidden by
 * the page itself (it renders fullscreen), so this mostly serves /admin and
 * /login.
 */
export function App() {
  return (
    <div className="min-h-screen bg-felt-dark text-slate-100">
      <nav className="flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3">
        <Link to="/display" className="flex items-center gap-2 font-bold">
          <span className="text-2xl">♠</span>
          <span>Texas</span>
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/display" className="text-slate-300 hover:text-white">
            Экран зала
          </Link>
          <Link to="/admin" className="text-slate-300 hover:text-white">
            Админка
          </Link>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
