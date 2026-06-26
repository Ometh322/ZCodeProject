import type { CLIENT_EVENTS, TournamentState } from "@poker-club/shared";

interface ControlsBarProps {
  state: TournamentState;
  send: <E extends keyof typeof CLIENT_EVENTS>(event: E, payload?: unknown) => void;
}

/**
 * Timer control bar: play/pause, prev/next level, +1m / +5m, reset.
 *
 * All actions are fire-and-forget Socket.IO emits; the server applies them and
 * pushes the new state back over `state:full`, so this component never mutates
 * anything locally — it just sends intent.
 */
export function ControlsBar({ state, send }: ControlsBarProps) {
  const isRunning = state.status === "running";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isRunning ? (
        <PrimaryButton onClick={() => send("PAUSE")} tone="amber">
          ⏸ Пауза
        </PrimaryButton>
      ) : (
        <PrimaryButton onClick={() => send("RESUME")} tone="green">
          ▶ {state.status === "setup" ? "Старт" : "Продолжить"}
        </PrimaryButton>
      )}

      <SecondaryButton onClick={() => send("PREVIOUS_LEVEL")}>◀ Уровень</SecondaryButton>
      <SecondaryButton onClick={() => send("NEXT_LEVEL")}>Уровень ▶</SecondaryButton>

      <div className="mx-2 h-8 w-px bg-white/10" />

      <SecondaryButton onClick={() => send("ADD_TIME", 60)}>+1 мин</SecondaryButton>
      <SecondaryButton onClick={() => send("ADD_TIME", 300)}>+5 мин</SecondaryButton>
      <SecondaryButton onClick={() => send("ADD_TIME", -60)} disabled={state.remainingSeconds <= 0}>
        −1 мин
      </SecondaryButton>

      <div className="mx-2 h-8 w-px bg-white/10" />

      <DangerButton
        onClick={() => {
          if (confirm("Сбросить турнир к началу?")) send("RESET");
        }}
      >
        ⟲ Сброс
      </DangerButton>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "green" | "amber";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-500 text-black hover:bg-emerald-400"
      : "bg-amber-400 text-black hover:bg-amber-300";
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-6 py-2.5 font-bold transition ${cls}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function DangerButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-medium text-red-300 transition hover:bg-red-500/20"
    >
      {children}
    </button>
  );
}
