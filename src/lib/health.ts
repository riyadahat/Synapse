import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "./utils";
/**  * Context Health (0–100). Fully deterministic — computed from live rows, never by an LLM.  *  *  Metric                         Weight   Score (0–1)  *  Open tasks have an owner         20     owned / open  *  Open tasks have a deadline       15     with due date / open  *  Meetings document decisions      20     past meetings with ≥1 decision / past meetings  *  Work is on schedule              20     1 − overdue / open  *  Work is unblocked                10     1 − blocked / open  *  Handovers are acknowledged       15     acknowledged / (acknowledged + pending older than 48h)  *  * A metric with nothing to measure (e.g. zero open tasks) is "n/a": it is dropped and the remaining  * weights are renormalised, so an empty team isn't rewarded or punished for data it doesn't have.  */ export const HEALTH_WEIGHTS =
  {
    owners: 20,
    deadlines: 15,
    decisions: 20,
    onTime: 20,
    unblocked: 10,
    handovers: 15,
  } as const;
export interface HealthMetric {
  key: keyof typeof HEALTH_WEIGHTS;
  label: string;
  weight: number;
  value: number | null;
  numerator: number;
  denominator: number;
  detail: string;
}
export interface HealthRisk {
  severity: "high" | "medium";
  text: string;
  href: string;
}
export interface Health {
  score: number | null;
  band: "Strong" | "Healthy" | "Needs attention" | "At risk" | "No data";
  metrics: HealthMetric[];
  risks: HealthRisk[];
  recommendations: string[];
  counts: {
    open: number;
    overdue: number;
    blocked: number;
    unowned: number;
    noDeadline: number;
  };
}
export async function computeHealth(
  supabase: SupabaseClient,
  teamId: string,
): Promise<Health> {
  const today = todayISO();
  const [{ data: tasks }, { data: meetings }, { data: handovers }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id,status,assignee_id,due_date")
        .eq("team_id", teamId),
      supabase
        .from("meetings")
        .select("id,scheduled_at,decisions(count)")
        .eq("team_id", teamId)
        .lte("scheduled_at", new Date().toISOString()),
      supabase
        .from("handovers")
        .select("id,status,created_at")
        .eq("team_id", teamId),
    ]);
  const open = (tasks ?? []).filter((t) => t.status !== "completed");
  const unowned = open.filter((t) => !t.assignee_id);
  const noDeadline = open.filter((t) => !t.due_date);
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const blocked = open.filter((t) => t.status === "blocked");
  const past = (meetings ?? []) as unknown as {
    id: string;
    decisions: { count: number }[];
  }[];
  const withDecisions = past.filter((m) => (m.decisions[0]?.count ?? 0) > 0);
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const acked = (handovers ?? []).filter(
    (h) => h.status === "acknowledged",
  ).length;
  const stale = (handovers ?? []).filter(
    (h) => h.status === "pending" && new Date(h.created_at).getTime() < cutoff,
  );
  const m = (
    key: HealthMetric["key"],
    label: string,
    num: number,
    den: number,
    detail: string,
  ): HealthMetric => ({
    key,
    label,
    weight: HEALTH_WEIGHTS[key],
    value: den === 0 ? null : Math.max(0, Math.min(1, num / den)),
    numerator: num,
    denominator: den,
    detail,
  });
  const metrics: HealthMetric[] = [
    m(
      "owners",
      "Open tasks have an owner",
      open.length - unowned.length,
      open.length,
      `${open.length - unowned.length} of ${open.length} open tasks are assigned`,
    ),
    m(
      "deadlines",
      "Open tasks have a deadline",
      open.length - noDeadline.length,
      open.length,
      `${open.length - noDeadline.length} of ${open.length} open tasks have a due date`,
    ),
    m(
      "decisions",
      "Meetings document decisions",
      withDecisions.length,
      past.length,
      `${withDecisions.length} of ${past.length} past meetings have a recorded decision`,
    ),
    m(
      "onTime",
      "Work is on schedule",
      open.length - overdue.length,
      open.length,
      `${overdue.length} of ${open.length} open tasks are overdue`,
    ),
    m(
      "unblocked",
      "Work is unblocked",
      open.length - blocked.length,
      open.length,
      `${blocked.length} of ${open.length} open tasks are blocked`,
    ),
    m(
      "handovers",
      "Handovers are acknowledged",
      acked,
      acked + stale.length,
      `${acked} acknowledged, ${stale.length} waiting more than 48h`,
    ),
  ];
  const applicable = metrics.filter((x) => x.value !== null);
  const totalW = applicable.reduce((s, x) => s + x.weight, 0);
  const score =
    totalW === 0
      ? null
      : Math.round(
          (applicable.reduce((s, x) => s + x.weight * (x.value as number), 0) /
            totalW) *
            100,
        );
  const band: Health["band"] =
    score === null
      ? "No data"
      : score >= 85
        ? "Strong"
        : score >= 70
          ? "Healthy"
          : score >= 50
            ? "Needs attention"
            : "At risk";
  const risks: HealthRisk[] = [];
  if (overdue.length)
    risks.push({
      severity: "high",
      text: `${overdue.length} open task${overdue.length > 1 ? "s are" : " is"} past the deadline`,
      href: "/tasks?owner=all",
    });
  if (blocked.length)
    risks.push({
      severity: "high",
      text: `${blocked.length} task${blocked.length > 1 ? "s are" : " is"} blocked with no recorded resolution`,
      href: "/tasks?owner=all&status=blocked",
    });
  if (stale.length)
    risks.push({
      severity: "high",
      text: `${stale.length} handover${stale.length > 1 ? "s have" : " has"} waited over 48 hours for acknowledgement`,
      href: "/handovers",
    });
  if (unowned.length)
    risks.push({
      severity: "medium",
      text: `${unowned.length} open task${unowned.length > 1 ? "s have" : " has"} no owner`,
      href: "/tasks?owner=none",
    });
  if (noDeadline.length)
    risks.push({
      severity: "medium",
      text: `${noDeadline.length} open task${noDeadline.length > 1 ? "s have" : " has"} no deadline`,
      href: "/tasks?owner=all",
    });
  if (past.length - withDecisions.length > 0)
    risks.push({
      severity: "medium",
      text: `${past.length - withDecisions.length} past meeting${past.length - withDecisions.length > 1 ? "s have" : " has"} no recorded decisions`,
      href: "/meetings",
    });
  const recommendations: string[] = [];
  if (unowned.length)
    recommendations.push(
      "Give every open task a named owner. Unowned work is the first thing to be forgotten.",
    );
  if (overdue.length)
    recommendations.push(
      "Review overdue tasks in your next meeting: re-date them, reassign them or close them with an outcome.",
    );
  if (blocked.length)
    recommendations.push(
      "Name the blocker and who can clear it on each blocked task.",
    );
  if (stale.length)
    recommendations.push(
      "Ask receiving owners to acknowledge pending handovers so responsibility is clearly transferred.",
    );
  if (noDeadline.length)
    recommendations.push(
      "Add due dates to open tasks so Context Health and catch-up briefs can flag what’s approaching.",
    );
  if (past.length - withDecisions.length > 0)
    recommendations.push(
      "Record decisions, even one line, for meetings that have none.",
    );
  return {
    score,
    band,
    metrics,
    risks,
    recommendations,
    counts: {
      open: open.length,
      overdue: overdue.length,
      blocked: blocked.length,
      unowned: unowned.length,
      noDeadline: noDeadline.length,
    },
  };
}
