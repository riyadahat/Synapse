import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Log } from "./logger";
interface ActivityInput {
  teamId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}
/** Writes to the audit feed AND emits a structured log line (event name == action). */ export async function recordActivity(
  supabase: SupabaseClient,
  log: Log,
  a: ActivityInput,
) {
  const { error } = await supabase
    .from("activity_logs")
    .insert({
      team_id: a.teamId,
      actor_id: a.actorId,
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId ?? null,
      summary: a.summary,
      metadata: a.metadata ?? {},
    });
  if (error)
    log.error({
      event: "activity.write_failed",
      action: a.action,
      errorMessage: error.message,
    });
  log.info({
    event: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    teamId: a.teamId,
    actorId: a.actorId,
    ...a.metadata,
  });
}
interface HistoryInput {
  taskId: string;
  actorId: string;
  action: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  meetingId?: string | null;
  note?: string | null;
}
export async function addTaskHistory(
  supabase: SupabaseClient,
  log: Log,
  h: HistoryInput,
) {
  const { error } = await supabase
    .from("task_history")
    .insert({
      task_id: h.taskId,
      actor_id: h.actorId,
      action: h.action,
      field: h.field ?? null,
      old_value: h.oldValue ?? null,
      new_value: h.newValue ?? null,
      meeting_id: h.meetingId ?? null,
      note: h.note ?? null,
    });
  if (error)
    log.error({
      event: "task_history.write_failed",
      taskId: h.taskId,
      errorMessage: error.message,
    });
}
