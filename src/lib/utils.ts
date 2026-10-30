import clsx, { type ClassValue } from "clsx";
export const cn = (...i: ClassValue[]) => clsx(i);
export const STATUS_LABEL = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
} as const;
export type Status = keyof typeof STATUS_LABEL;
export const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
} as const;
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const isOverdue = (due: string | null, status: string) =>
  !!due && status !== "completed" && due < todayISO();
export function fmtDate(
  d: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) {
  if (!d) return "—";
  const date =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? new Date(d + "T00:00:00")
      : new Date(d);
  return date.toLocaleDateString("en-GB", opts);
}
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function timeAgo(d: string | Date) {
  const s = Math.max(
    1,
    Math.round((Date.now() - new Date(d).getTime()) / 1000),
  );
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
