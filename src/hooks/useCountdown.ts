// ============================================================
// WAYTERO ADMIN — USE COUNTDOWN HOOK
// Ticks every second, returns the remaining minutes/seconds
// until `deadline` (ISO string). `expired` flips to true once
// the deadline passes. Used by the partner acceptance banner.
// ============================================================
import { useEffect, useState } from "react";

export interface Countdown {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  expired: boolean;
}

function compute(deadlineISO: string | null | undefined): Countdown {
  if (!deadlineISO) {
    return { minutes: 0, seconds: 0, totalSeconds: 0, expired: true };
  }
  const now = Date.now();
  const deadlineMs = new Date(deadlineISO).getTime();
  const totalSeconds = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    expired: totalSeconds === 0,
  };
}

export function useCountdown(deadlineISO: string | null | undefined): Countdown {
  const [state, setState] = useState<Countdown>(() => compute(deadlineISO));

  useEffect(() => {
    setState(compute(deadlineISO));
    if (!deadlineISO) return;
    const id = window.setInterval(() => {
      const next = compute(deadlineISO);
      setState(next);
      if (next.expired) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadlineISO]);

  return state;
}
