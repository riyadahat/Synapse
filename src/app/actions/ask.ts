"use server";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { AiError, generateStructured } from "@/lib/ai";
import { ASK_SYSTEM, HEALTH_SYSTEM } from "@/lib/prompts";
import {
  askSchema,
  healthExplainSchema,
  type HealthExplanation,
} from "@/lib/schemas";
import { SourceRegistry, type Source } from "@/lib/sources";
import { findRelatedDocuments, keywords } from "@/lib/queries";
import { computeHealth } from "@/lib/health";
import { fmtDate, todayISO } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";
export interface AskResult {
  answer: string;
  found: boolean;
  sources: Source[];
  latencyMs: number;
  retrieved: number;
}
const overlap = (text: string, words: string[]) => {
  const t = text.toLowerCase();
  return words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
};
/** Retrieval-augmented answer. Retrieval is deterministic and RLS-scoped; the model sees only the retrieved records. */ export async function askContextFlow(
  question: string,
): Promise<ActionResult<AskResult>> {
  const log = await getLogger({ action: "ask" });
  const q = z
    .string()
    .trim()
    .min(3, "Ask a full question.")
    .max(500)
    .safeParse(question);
  if (!q.success) return { ok: false, error: q.error.issues[0].message };
  const { supabase, team } = await getContext();
  const started = Date.now();
  const today = todayISO();
  const words = keywords(q.data, 10);
  const reg = new SourceRegistry();
  const [mRes, dRes, tRes, hRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("id,title,scheduled_at,summary,notes,unresolved_questions")
      .eq("team_id", team.id)
      .order("scheduled_at", { ascending: false })
      .limit(40),
    supabase
      .from("decisions")
      .select("id,text,rationale,meeting:meetings(id,title)")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("tasks")
      .select(
        "id,title,description,status,priority,due_date,completion_outcome,assignee:profiles!tasks_assignee_id_fkey(full_name),origin:meetings!tasks_origin_meeting_id_fkey(title)",
      )
      .eq("team_id", team.id)
      .limit(150),
    supabase
      .from("handovers")
      .select(
        "id,project,status,reason,from:profiles!handovers_from_user_fkey(full_name),to:profiles!handovers_to_user_fkey(full_name)",
      )
      .eq("team_id", team.id)
      .limit(20),
  ]);
  const meetings = (mRes.data ?? []) as unknown as {
    id: string;
    title: string;
    scheduled_at: string;
    summary: string | null;
    notes: string | null;
    unresolved_questions: string[];
  }[];
  const decisions = (dRes.data ?? []) as unknown as {
    id: string;
    text: string;
    rationale: string | null;
    meeting: { id: string; title: string } | null;
  }[];
  const tasks = (tRes.data ?? []) as unknown as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
    completion_outcome: string | null;
    assignee: { full_name: string } | null;
    origin: { title: string } | null;
  }[];
  const now = Date.now();
  const lastTwo = meetings
    .filter((m) => new Date(m.scheduled_at).getTime() <= now)
    .slice(0, 2)
    .map((m) => m.id);
  const topMeetings = [...meetings]
    .map((m) => ({
      m,
      s:
        overlap(`${m.title} ${m.summary ?? ""} ${m.notes ?? ""}`, words) +
        (lastTwo.includes(m.id) ? 0.5 : 0),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.m);
  const topDecisions = decisions
    .map((d) => ({
      d,
      s: overlap(
        `${d.text} ${d.rationale ?? ""} ${d.meeting?.title ?? ""}`,
        words,
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map((x) => x.d);
  const openTasks = tasks.filter((t) => t.status !== "completed");
  const relTasks = tasks
    .filter(
      (t) =>
        overlap(
          `${t.title} ${t.description ?? ""} ${t.origin?.title ?? ""}`,
          words,
        ) > 0 && t.status === "completed",
    )
    .slice(0, 6);
  const taskSet = [...openTasks.slice(0, 40), ...relTasks];
  const docs = await findRelatedDocuments(supabase, team.id, q.data, {
    limit: 4,
  });
  const docIds = docs.map((d) => d.id);
  const { data: chunks } = docIds.length
    ? await supabase
        .from("document_chunks")
        .select("document_id,content")
        .in("document_id", docIds)
        .textSearch("tsv", words.join(" or "), {
          type: "websearch",
          config: "english",
        })
        .limit(6)
    : { data: [] };
  const L: string[] = [
    `Today: ${today}`,
    `Question: ${q.data}`,
    "",
    "MEETINGS:",
  ];
  for (const m of topMeetings)
    L.push(
      `[${reg.add("meeting", m.id, m.title, `/meetings/${m.id}`)}] ${m.title} (${fmtDate(m.scheduled_at, { day: "numeric", month: "short", year: "numeric" })}): ${m.summary ?? (m.notes ?? "no notes").slice(0, 500)}${m.unresolved_questions?.length ? ` Unresolved: ${m.unresolved_questions.join("; ")}` : ""}`,
    );
  L.push("", "DECISIONS:");
  for (const d of topDecisions)
    L.push(
      `[${reg.add("decision", d.id, d.text.slice(0, 60), d.meeting ? `/meetings/${d.meeting.id}` : "/meetings")}] ${d.text}${d.rationale ? ` — why: ${d.rationale}` : ""}${d.meeting ? ` (meeting: ${d.meeting.title})` : ""}`,
    );
  L.push("", "TASKS:");
  for (const t of taskSet)
    L.push(
      `[${reg.add("task", t.id, t.title, "/tasks?owner=all")}] ${t.title} — ${t.status}, ${t.priority}, owner ${t.assignee?.full_name ?? "unassigned"}, due ${t.due_date ?? "none"}${t.due_date && t.due_date < today && t.status !== "completed" ? " (OVERDUE)" : ""}${t.completion_outcome ? `, outcome: ${t.completion_outcome}` : ""}`,
    );
  if (chunks?.length) {
    L.push("", "DOCUMENT EXCERPTS:");
    for (const c of chunks as { document_id: string; content: string }[]) {
      const d = docs.find((x) => x.id === c.document_id)!;
      L.push(
        `[${reg.add("document", d.id, d.title, `/knowledge/${d.id}`)}] ${d.title}: ${c.content.slice(0, 700)}`,
      );
    }
  }
  if (/handover|take over|taking over|leave/i.test(q.data)) {
    L.push("", "HANDOVERS:");
    for (const h of (hRes.data ?? []) as unknown as {
      id: string;
      project: string;
      status: string;
      reason: string | null;
      from: { full_name: string };
      to: { full_name: string };
    }[])
      L.push(
        `[${reg.add("handover", h.id, h.project, `/handovers/${h.id}`)}] ${h.project}: ${h.from.full_name} → ${h.to.full_name}, ${h.status}${h.reason ? `, reason: ${h.reason}` : ""}`,
      );
  }
  try {
    const a = await generateStructured({
      operation: "ask.answer",
      log,
      schema: askSchema,
      system: ASK_SYSTEM,
      user: L.join("\n"),
      maxTokens: 1500,
    });
    const sources = a.found ? reg.resolve(a.refs) : [];
    log.info({
      event: "ask.answered",
      found: a.found,
      sources: sources.length,
      retrieved: reg.all.length,
    });
    return {
      ok: true,
      data: {
        answer: a.answer,
        found: a.found,
        sources,
        latencyMs: Date.now() - started,
        retrieved: reg.all.length,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error:
        (e as AiError).userMessage ??
        "Couldn't answer right now. Try the search bar instead.",
    };
  }
}
export async function explainHealth(): Promise<
  ActionResult<HealthExplanation>
> {
  const log = await getLogger({ action: "health.explain" });
  const { supabase, team } = await getContext();
  const h = await computeHealth(supabase, team.id);
  if (h.score === null)
    return { ok: false, error: "There isn't enough data to explain yet." };
  try {
    const r = await generateStructured({
      operation: "health.explain",
      log,
      schema: healthExplainSchema,
      system: HEALTH_SYSTEM,
      maxTokens: 1000,
      user: `Score: ${h.score}/100 (${h.band})\nMetrics:\n${h.metrics.map((m) => `- ${m.label} (weight ${m.weight}): ${m.value === null ? "n/a" : Math.round(m.value * 100) + "%"} — ${m.detail}`).join("\n")}\nDeterministic risks:\n${h.risks.map((r) => `- ${r.text}`).join("\n") || "none"}`,
    });
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: (e as AiError).userMessage };
  }
}
