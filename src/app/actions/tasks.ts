"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { addTaskHistory, recordActivity } from "@/lib/activity";
import { priorityEnum, statusEnum } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
const taskInput = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters").max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  priority: priorityEnum.default("medium"),
  status: statusEnum.default("todo"),
  originMeetingId: z.string().uuid().nullable().optional(),
});
export async function createTask(
  raw: z.input<typeof taskInput>,
): Promise<ActionResult<{ id: string }>> {
  const log = await getLogger({ action: "task.create" });
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const t = parsed.data;
  const { supabase, user, team, members } = await getContext();
  if (t.assigneeId && !members.some((m) => m.id === t.assigneeId))
    return { ok: false, error: "That person isn't in this workspace." };
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      team_id: team.id,
      title: t.title,
      description: t.description || null,
      assignee_id: t.assigneeId ?? null,
      due_date: t.dueDate ?? null,
      priority: t.priority,
      status: t.status,
      origin_meeting_id: t.originMeetingId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    log.error({ event: "task.create_failed", errorMessage: error?.message });
    return { ok: false, error: "Couldn't create the task. Try again." };
  }
  if (t.originMeetingId)
    await supabase
      .from("meeting_tasks")
      .insert({
        meeting_id: t.originMeetingId,
        task_id: data.id,
        relation: "originated",
        created_by: user.id,
      });
  await addTaskHistory(supabase, log, {
    taskId: data.id,
    actorId: user.id,
    action: "created",
    meetingId: t.originMeetingId,
    note: "Task created",
  });
  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "task.created",
    entityType: "task",
    entityId: data.id,
    summary: `created task “${t.title}”`,
    metadata: { assigneeId: t.assigneeId ?? null, priority: t.priority },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}
const patchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  completionOutcome: z.string().trim().max(2000).nullable().optional(),
});
/** Single mutation path for all task edits: diffs fields, writes task_history, audit feed and structured logs. */ export async function updateTask(
  taskId: string,
  raw: z.input<typeof patchSchema>,
  meetingId?: string | null,
): Promise<ActionResult> {
  const log = await getLogger({ action: "task.update", taskId });
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const p = parsed.data;
  const { supabase, user, team, members } = await getContext();
  const name = (id?: string | null) =>
    id
      ? (members.find((m) => m.id === id)?.full_name ?? "unknown")
      : "Unassigned";
  const { data: cur } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("team_id", team.id)
    .single();
  if (!cur) return { ok: false, error: "Task not found." };
  if (p.assigneeId && !members.some((m) => m.id === p.assigneeId))
    return { ok: false, error: "That person isn't in this workspace." };
  const update: Record<string, unknown> = {};
  const hist: Parameters<typeof addTaskHistory>[2][] = [];
  const base = { taskId, actorId: user.id, meetingId };
  if (p.title !== undefined && p.title !== cur.title) {
    update.title = p.title;
    hist.push({
      ...base,
      action: "updated",
      field: "title",
      oldValue: cur.title,
      newValue: p.title,
    });
  }
  if (
    p.description !== undefined &&
    (p.description || null) !== cur.description
  ) {
    update.description = p.description || null;
    hist.push({ ...base, action: "updated", field: "description" });
  }
  if (p.priority !== undefined && p.priority !== cur.priority) {
    update.priority = p.priority;
    hist.push({
      ...base,
      action: "updated",
      field: "priority",
      oldValue: cur.priority,
      newValue: p.priority,
    });
  }
  if (p.dueDate !== undefined && (p.dueDate ?? null) !== cur.due_date) {
    update.due_date = p.dueDate ?? null;
    hist.push({
      ...base,
      action: "due_changed",
      field: "due_date",
      oldValue: cur.due_date,
      newValue: p.dueDate ?? null,
    });
  }
  let reassigned = false;
  if (
    p.assigneeId !== undefined &&
    (p.assigneeId ?? null) !== cur.assignee_id
  ) {
    update.assignee_id = p.assigneeId ?? null;
    update.owner_uncertain = false;
    reassigned = true;
    hist.push({
      ...base,
      action: "reassigned",
      field: "assignee",
      oldValue: name(cur.assignee_id),
      newValue: name(p.assigneeId),
    });
  }
  let completed = false;
  if (p.status !== undefined && p.status !== cur.status) {
    update.status = p.status;
    if (p.status === "completed") {
      completed = true;
      update.completed_at = new Date().toISOString();
      update.completion_outcome = p.completionOutcome ?? cur.completion_outcome;
      hist.push({
        ...base,
        action: "completed",
        field: "status",
        oldValue: cur.status,
        newValue: p.status,
        note: p.completionOutcome ?? null,
      });
    } else {
      if (cur.status === "completed") {
        update.completed_at = null;
        update.completion_outcome = null;
      }
      hist.push({
        ...base,
        action: cur.status === "completed" ? "reopened" : "status_changed",
        field: "status",
        oldValue: cur.status,
        newValue: p.status,
      });
    }
  } else if (p.completionOutcome !== undefined && cur.status === "completed") {
    update.completion_outcome = p.completionOutcome || null;
    hist.push({ ...base, action: "updated", field: "completion_outcome" });
  }
  if (!Object.keys(update).length) return { ok: true };
  const { error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId);
  if (error) {
    log.error({ event: "task.update_failed", errorMessage: error.message });
    return { ok: false, error: "Couldn't save changes. Try again." };
  }
  for (const h of hist) await addTaskHistory(supabase, log, h);
  const title = (update.title as string) ?? cur.title;
  if (reassigned)
    await recordActivity(supabase, log, {
      teamId: team.id,
      actorId: user.id,
      action: "task.reassigned",
      entityType: "task",
      entityId: taskId,
      summary: `reassigned “${title}” from ${name(cur.assignee_id)} to ${name(p.assigneeId)}`,
      metadata: { from: cur.assignee_id, to: p.assigneeId ?? null },
    });
  if (completed)
    await recordActivity(supabase, log, {
      teamId: team.id,
      actorId: user.id,
      action: "task.completed",
      entityType: "task",
      entityId: taskId,
      summary: `completed “${title}”`,
      metadata: { hasOutcome: Boolean(p.completionOutcome) },
    });
  else if (update.status)
    await recordActivity(supabase, log, {
      teamId: team.id,
      actorId: user.id,
      action: "task.status_changed",
      entityType: "task",
      entityId: taskId,
      summary: `moved “${title}” to ${String(update.status).replace("_", " ")}`,
      metadata: { from: cur.status, to: update.status },
    });
  else if (!reassigned)
    await recordActivity(supabase, log, {
      teamId: team.id,
      actorId: user.id,
      action: "task.updated",
      entityType: "task",
      entityId: taskId,
      summary: `edited “${title}”`,
      metadata: { fields: Object.keys(update) },
    });
  revalidatePath("/", "layout");
  return { ok: true };
}
export interface HistoryEntry {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
  actor: { full_name: string } | null;
  meeting: { title: string } | null;
}
export async function getTaskHistory(taskId: string): Promise<HistoryEntry[]> {
  const { supabase } = await getContext();
  const { data } = await supabase
    .from("task_history")
    .select(
      "id,action,field,old_value,new_value,note,created_at,actor:profiles!task_history_actor_id_fkey(full_name),meeting:meetings!task_history_meeting_id_fkey(title)",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as HistoryEntry[];
}
export async function deleteTask(taskId: string): Promise<ActionResult> {
  const log = await getLogger({ action: "task.delete", taskId });
  const { supabase, user, team } = await getContext();
  const { data: t } = await supabase
    .from("tasks")
    .select("title")
    .eq("id", taskId)
    .eq("team_id", team.id)
    .single();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("team_id", team.id);
  if (error) return { ok: false, error: "Couldn't delete the task." };
  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "task.deleted",
    entityType: "task",
    entityId: taskId,
    summary: `deleted task “${t?.title ?? ""}”`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
