"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { addTaskHistory, recordActivity } from "@/lib/activity";
import { AiError, generateStructured } from "@/lib/ai";
import { HANDOVER_SYSTEM } from "@/lib/prompts";
import { handoverBriefSchema } from "@/lib/schemas";
import { SourceRegistry, type Source } from "@/lib/sources";
import { findRelatedDocuments } from "@/lib/queries";
import { fmtDate, todayISO } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";
export interface StoredBrief {
  generatedBy: "ai" | "records" | "manual";
  sections: {
    key: string;
    title: string;
    items: { text: string; sources: Source[] }[];
  }[];
}
const TITLES: Record<string, string> = {
  overview: "Project overview",
  progress: "Current progress",
  outstandingTasks: "Outstanding tasks",
  decisions: "Previous decisions",
  blockers: "Current blockers",
  resources: "Important resources",
  nextSteps: "Recommended next steps",
};
export interface HandoverTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string;
}
export async function previewHandover(
  fromId: string,
): Promise<ActionResult<{ tasks: HandoverTask[] }>> {
  const { supabase, team, members } = await getContext();
  if (!members.some((m) => m.id === fromId))
    return { ok: false, error: "That person isn't in this workspace." };
  const { data } = await supabase
    .from("tasks")
    .select("id,title,status,due_date,priority")
    .eq("team_id", team.id)
    .eq("assignee_id", fromId)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });
  return { ok: true, data: { tasks: (data ?? []) as HandoverTask[] } };
}
const briefInput = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  project: z
    .string()
    .trim()
    .min(2, "Name the project or area being handed over")
    .max(120),
  reason: z.string().max(500).optional(),
  notes: z.string().max(3000).optional(),
  taskIds: z.array(z.string().uuid()),
});
export async function generateHandoverBrief(
  raw: z.input<typeof briefInput>,
): Promise<ActionResult<StoredBrief & { aiNote?: string }>> {
  const log = await getLogger({ action: "handover.brief" });
  const p = briefInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (p.data.fromId === p.data.toId)
    return { ok: false, error: "Choose two different people." };
  const { supabase, team, members } = await getContext();
  const from = members.find((m) => m.id === p.data.fromId),
    to = members.find((m) => m.id === p.data.toId);
  if (!from || !to)
    return { ok: false, error: "Both people must be in this workspace." };
  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select(
      "id,title,status,priority,due_date,description,completion_outcome,origin:meetings!tasks_origin_meeting_id_fkey(id,title),meeting_tasks(meeting_id)",
    )
    .eq("team_id", team.id)
    .in(
      "id",
      p.data.taskIds.length
        ? p.data.taskIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const tasks = (tasksRaw ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    description: string | null;
    origin: { id: string; title: string } | null;
    meeting_tasks: { meeting_id: string }[];
  }[];
  const meetingIds = Array.from(
    new Set(
      tasks
        .flatMap((t) => [
          t.origin?.id,
          ...t.meeting_tasks.map((m) => m.meeting_id),
        ])
        .filter(Boolean) as string[],
    ),
  );
  const [{ data: meetingsRaw }, { data: histRaw }] = await Promise.all([
    meetingIds.length
      ? supabase
          .from("meetings")
          .select("id,title,scheduled_at,summary,decisions(id,text,rationale)")
          .in("id", meetingIds)
          .order("scheduled_at")
      : Promise.resolve({ data: [] }),
    tasks.length
      ? supabase
          .from("task_history")
          .select("task_id,action,old_value,new_value,note,created_at")
          .in(
            "task_id",
            tasks.map((t) => t.id),
          )
          .order("created_at", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
  ]);
  const meetings = (meetingsRaw ?? []) as unknown as {
    id: string;
    title: string;
    scheduled_at: string;
    summary: string | null;
    decisions: { id: string; text: string; rationale: string | null }[];
  }[];
  const docs = await findRelatedDocuments(
    supabase,
    team.id,
    `${p.data.project} ${tasks.map((t) => t.title).join(" ")}`,
    { limit: 5 },
  );
  const reg = new SourceRegistry();
  const today = todayISO();
  const L: string[] = [
    `Handover: ${from.full_name} → ${to.full_name}`,
    `Project: ${p.data.project}`,
    `Reason: ${p.data.reason || "not given"}`,
    `Notes from ${from.full_name}: ${p.data.notes || "none"}`,
    `Today: ${today}`,
    "",
    "OUTSTANDING TASKS BEING TRANSFERRED:",
  ];
  for (const t of tasks)
    L.push(
      `[${reg.add("task", t.id, t.title, "/tasks?owner=all")}] ${t.title} — ${t.status}, ${t.priority} priority, due ${t.due_date ?? "no deadline"}${t.due_date && t.due_date < today ? " (OVERDUE)" : ""}${t.description ? ` — ${t.description.slice(0, 200)}` : ""}`,
    );
  L.push("", "RELEVANT MEETINGS AND DECISIONS:");
  for (const m of meetings) {
    L.push(
      `[${reg.add("meeting", m.id, m.title, `/meetings/${m.id}`)}] ${m.title} (${fmtDate(m.scheduled_at)}): ${m.summary ?? "no summary"}`,
    );
    for (const d of m.decisions)
      L.push(
        `  Decision [${reg.add("decision", d.id, d.text.slice(0, 60), `/meetings/${m.id}`)}]: ${d.text}${d.rationale ? ` (why: ${d.rationale})` : ""}`,
      );
  }
  if (histRaw?.length) {
    L.push("", "RECENT TASK HISTORY:");
    for (const h of histRaw as {
      task_id: string;
      action: string;
      old_value: string | null;
      new_value: string | null;
      note: string | null;
      created_at: string;
    }[]) {
      const t = tasks.find((x) => x.id === h.task_id);
      if (t)
        L.push(
          `[${reg.add("task", t.id, t.title, "/tasks?owner=all")}] ${h.action.replace("_", " ")}${h.old_value || h.new_value ? ` ${h.old_value ?? "—"} → ${h.new_value ?? "—"}` : ""}${h.note ? ` (${h.note})` : ""} on ${fmtDate(h.created_at)}`,
        );
    }
  }
  if (docs.length) {
    L.push("", "DOCUMENTS:");
    for (const d of docs)
      L.push(
        `[${reg.add("document", d.id, d.title, `/knowledge/${d.id}`)}] ${d.title}: ${d.snippet}`,
      );
  }
  const mk = (key: string, items: { text: string; refs: string[] }[]) => ({
    key,
    title: TITLES[key],
    items: items.map((i) => ({ text: i.text, sources: reg.resolve(i.refs) })),
  });
  try {
    const b = await generateStructured({
      operation: "handover.brief",
      log,
      schema: handoverBriefSchema,
      system: HANDOVER_SYSTEM,
      user: L.join("\n"),
      maxTokens: 3500,
    });
    return {
      ok: true,
      data: {
        generatedBy: "ai",
        sections: (Object.keys(TITLES) as (keyof typeof b)[]).map((k) =>
          mk(k as string, b[k]),
        ),
      },
    };
  } catch (e) {
    const ai = e as AiError;
    const ref = (id: string) => reg.resolve([reg.add("task", id, "", "")]);
    void ref;
    const taskItem = (t: (typeof tasks)[number]) => ({
      text: `${t.title} (${t.status.replace("_", " ")}${t.due_date ? `, due ${fmtDate(t.due_date)}` : ", no deadline"})`,
      refs: [reg.add("task", t.id, t.title, "/tasks?owner=all")],
    });
    return {
      ok: true,
      data: {
        generatedBy: "records",
        aiNote: ai.userMessage,
        sections: [
          mk("overview", [
            {
              text: `${from.full_name} is handing ${p.data.project} to ${to.full_name}${p.data.reason ? `: ${p.data.reason}` : ""}.`,
              refs: [],
            },
          ]),
          mk(
            "progress",
            meetings.map((m) => ({
              text: `${m.title}: ${m.summary ?? "no summary recorded"}`,
              refs: [reg.add("meeting", m.id, m.title, `/meetings/${m.id}`)],
            })),
          ),
          mk("outstandingTasks", tasks.map(taskItem)),
          mk(
            "decisions",
            meetings.flatMap((m) =>
              m.decisions.map((d) => ({
                text: d.text,
                refs: [
                  reg.add(
                    "decision",
                    d.id,
                    d.text.slice(0, 60),
                    `/meetings/${m.id}`,
                  ),
                ],
              })),
            ),
          ),
          mk(
            "blockers",
            tasks.filter((t) => t.status === "blocked").map(taskItem),
          ),
          mk(
            "resources",
            docs.map((d) => ({
              text: d.title,
              refs: [reg.add("document", d.id, d.title, `/knowledge/${d.id}`)],
            })),
          ),
          mk(
            "nextSteps",
            tasks
              .filter((t) => t.due_date && t.due_date < today)
              .map((t) => ({
                text: `Review overdue task “${t.title}” and set a new date or close it`,
                refs: [reg.add("task", t.id, t.title, "/tasks?owner=all")],
              })),
          ),
        ],
      },
    };
  }
}
const createInput = briefInput.extend({ brief: z.any() });
export async function createHandover(
  raw: z.input<typeof createInput>,
): Promise<ActionResult<{ id: string }>> {
  const log = await getLogger({ action: "handover.create" });
  const p = createInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { supabase, user, team, members } = await getContext();
  if (
    !members.some((m) => m.id === p.data.fromId) ||
    !members.some((m) => m.id === p.data.toId) ||
    p.data.fromId === p.data.toId
  )
    return {
      ok: false,
      error: "Choose two different people from this workspace.",
    };
  const { data: h, error } = await supabase
    .from("handovers")
    .insert({
      team_id: team.id,
      from_user: p.data.fromId,
      to_user: p.data.toId,
      project: p.data.project,
      reason: p.data.reason || null,
      notes: p.data.notes || null,
      brief: p.data.brief ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !h) {
    log.error({
      event: "handover.create_failed",
      errorMessage: error?.message,
    });
    return {
      ok: false,
      error: "Couldn't create the handover. Your brief is still on screen.",
    };
  }
  if (p.data.taskIds.length)
    await supabase
      .from("handover_tasks")
      .insert(
        p.data.taskIds.map((id) => ({
          handover_id: h.id,
          task_id: id,
          previous_owner_id: p.data.fromId,
          new_owner_id: p.data.toId,
        })),
      );
  const to = members.find((m) => m.id === p.data.toId)!.full_name,
    from = members.find((m) => m.id === p.data.fromId)!.full_name;
  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "handover.created",
    entityType: "handover",
    entityId: h.id,
    summary: `created a handover of ${p.data.project} from ${from} to ${to}`,
    metadata: {
      tasks: p.data.taskIds.length,
      aiAssisted: p.data.brief?.generatedBy === "ai",
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: h.id } };
}
/** Receiver explicitly accepts selected tasks. Only then do owners change. */ export async function acknowledgeHandover(
  id: string,
  acceptTaskIds: string[],
): Promise<ActionResult> {
  const log = await getLogger({
    action: "handover.acknowledge",
    handoverId: id,
  });
  const { supabase, user, team, members } = await getContext();
  const { data: h } = await supabase
    .from("handovers")
    .select("id,project,from_user,to_user,status")
    .eq("id", id)
    .eq("team_id", team.id)
    .single();
  if (!h) return { ok: false, error: "Handover not found." };
  if (h.to_user !== user.id)
    return {
      ok: false,
      error: "Only the receiving person can acknowledge this handover.",
    };
  if (h.status !== "pending")
    return { ok: false, error: "This handover has already been resolved." };
  const { data: links } = await supabase
    .from("handover_tasks")
    .select("task_id,transferred,task:tasks(title,assignee_id)")
    .eq("handover_id", id);
  const fromName =
    members.find((m) => m.id === h.from_user)?.full_name ?? "previous owner";
  let moved = 0;
  for (const l of (links ?? []) as unknown as {
    task_id: string;
    transferred: boolean;
    task: { title: string; assignee_id: string | null };
  }[]) {
    if (l.transferred || !acceptTaskIds.includes(l.task_id)) continue;
    const { error } = await supabase
      .from("tasks")
      .update({ assignee_id: user.id, owner_uncertain: false })
      .eq("id", l.task_id);
    if (error) {
      log.error({
        event: "handover.transfer_failed",
        taskId: l.task_id,
        errorMessage: error.message,
      });
      continue;
    }
    await supabase
      .from("handover_tasks")
      .update({ transferred: true, transferred_at: new Date().toISOString() })
      .eq("handover_id", id)
      .eq("task_id", l.task_id);
    await addTaskHistory(supabase, log, {
      taskId: l.task_id,
      actorId: user.id,
      action: "reassigned",
      field: "assignee",
      oldValue: fromName,
      newValue: members.find((m) => m.id === user.id)?.full_name,
    });
    await addTaskHistory(supabase, log, {
      taskId: l.task_id,
      actorId: user.id,
      action: "handover_transferred",
      note: `Accepted by the new owner via handover “${h.project}”`,
    });
    await recordActivity(supabase, log, {
      teamId: team.id,
      actorId: user.id,
      action: "task.reassigned",
      entityType: "task",
      entityId: l.task_id,
      summary: `accepted “${l.task.title}” from ${fromName} via handover`,
      metadata: { handoverId: id, from: h.from_user, to: user.id },
    });
    moved++;
  }
  await supabase
    .from("handovers")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", id);
  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "handover.acknowledged",
    entityType: "handover",
    entityId: id,
    summary: `acknowledged the handover of ${h.project} and accepted ${moved} task${moved === 1 ? "" : "s"}`,
    metadata: { accepted: moved },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function declineHandover(id: string): Promise<ActionResult> {
  const log = await getLogger({ action: "handover.decline", handoverId: id });
  const { supabase, user, team } = await getContext();
  const { data: h } = await supabase
    .from("handovers")
    .select("project,to_user,status")
    .eq("id", id)
    .eq("team_id", team.id)
    .single();
  if (!h || h.to_user !== user.id || h.status !== "pending")
    return { ok: false, error: "This handover can't be declined." };
  await supabase.from("handovers").update({ status: "declined" }).eq("id", id);
  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "handover.declined",
    entityType: "handover",
    entityId: id,
    summary: `declined the handover of ${h.project}`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
