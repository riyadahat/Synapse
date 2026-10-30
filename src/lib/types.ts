export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "blocked" | "completed";
  completion_outcome: string | null;
  completed_at: string | null;
  created_at: string;
  owner_uncertain: boolean;
  source: string;
  is_seed: boolean;
  origin_meeting: { id: string; title: string } | null;
  assignee: { full_name: string } | null;
}
export const TASK_SELECT =
  "id,title,description,assignee_id,due_date,priority,status,completion_outcome,completed_at,created_at,owner_uncertain,source,is_seed,origin_meeting:meetings!tasks_origin_meeting_id_fkey(id,title),assignee:profiles!tasks_assignee_id_fkey(full_name)";
export interface Member {
  id: string;
  full_name: string;
  role_title: string | null;
}
export type ActionResult<T = unknown> =
  { ok: true; data?: T } | { ok: false; error: string };
