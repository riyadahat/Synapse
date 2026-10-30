"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronDown,
  KanbanSquare,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  deleteTask,
  getTaskHistory,
  updateTask,
  type HistoryEntry,
} from "@/app/actions/tasks";
import { TaskFormModal } from "@/components/task-form";
import { ConfirmDialog, Modal } from "@/components/modal";
import {
  EmptyState,
  OverdueChip,
  Person,
  PriorityChip,
  SeedChip,
  StatusChip,
  AiChip,
  Field,
} from "@/components/ui";
import {
  cn,
  fmtDate,
  fmtDateTime,
  isOverdue,
  STATUS_LABEL,
  type Status,
} from "@/lib/utils";
import type { Member, TaskRow } from "@/lib/types";

const STATUSES = Object.keys(STATUS_LABEL) as Status[];

export function TasksView({
  tasks,
  members,
  currentUserId,
  initial,
}: {
  tasks: TaskRow[];
  members: Member[];
  currentUserId: string;
  initial: {
    openNew: boolean;
    owner: string;
    status: string;
  };
}) {
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState(initial.owner);
  const [status, setStatus] = useState(initial.status);
  const [view, setView] = useState<"list" | "board">("list");
  const [creating, setCreating] = useState(initial.openNew);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  const [completing, setCompleting] = useState<TaskRow | null>(null);
  const [, start] = useTransition();

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (owner === "mine" && t.assignee_id !== currentUserId) {
          return false;
        }

        if (owner === "none" && t.assignee_id) {
          return false;
        }

        if (
          !["mine", "all", "none"].includes(owner) &&
          t.assignee_id !== owner
        ) {
          return false;
        }

        if (status === "open" && t.status === "completed") {
          return false;
        }

        if (STATUSES.includes(status as Status) && t.status !== status) {
          return false;
        }

        if (
          q &&
          !`${t.title} ${t.description ?? ""} ${t.origin_meeting?.title ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase())
        ) {
          return false;
        }

        return true;
      }),
    [tasks, owner, status, q, currentUserId],
  );

  function changeStatus(t: TaskRow, next: Status) {
    if (next === "completed") {
      return setCompleting(t);
    }

    start(async () => {
      const r = await updateTask(t.id, { status: next });

      r.ok
        ? toast.success(`Moved to ${STATUS_LABEL[next].toLowerCase()}`)
        : toast.error(r.error);
    });
  }

  function reassign(t: TaskRow, id: string) {
    start(async () => {
      const r = await updateTask(t.id, {
        assigneeId: id || null,
      });

      r.ok ? toast.success("Task reassigned") : toast.error(r.error);
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />

          <input
            className="input pl-9"
            placeholder="Search tasks"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search tasks"
          />
        </div>

        <select
          className="input !w-auto"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          aria-label="Filter by owner"
        >
          <option value="mine">My tasks</option>
          <option value="all">Everyone</option>
          <option value="none">Unassigned</option>

          {members
            .filter((m) => m.id !== currentUserId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
        </select>

        <select
          className="input !w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="open">Open</option>
          <option value="all">All statuses</option>

          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex rounded-md border border-line bg-white p-0.5"
            role="group"
            aria-label="View"
          >
            <button
              className={cn(
                "rounded px-2 py-1",
                view === "list"
                  ? "bg-sage-soft text-olive"
                  : "text-muted-strong",
              )}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
            >
              <List size={15} />
            </button>

            <button
              className={cn(
                "rounded px-2 py-1",
                view === "board"
                  ? "bg-sage-soft text-olive"
                  : "text-muted-strong",
              )}
              onClick={() => setView("board")}
              aria-pressed={view === "board"}
              aria-label="Board view"
            >
              <KanbanSquare size={15} />
            </button>
          </div>

          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            Add task
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            tasks.length ? "Nothing matches these filters" : "No tasks yet"
          }
          body={
            tasks.length
              ? "Try a different owner or status, or clear your search."
              : "Add a task, or paste meeting notes and let ContextFlow pull out the action items."
          }
          action={
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => setCreating(true)}>
                Add task
              </button>

              <Link className="btn-secondary" href="/meetings/new">
                New meeting
              </Link>
            </div>
          }
        />
      ) : view === "list" ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead>
              <tr>
                <th className="th w-[34%]">Task</th>
                <th className="th">Owner</th>
                <th className="th">Due</th>
                <th className="th">Priority</th>
                <th className="th">Status</th>
                <th className="th w-24" />
              </tr>
            </thead>

            <tbody>
              {filtered.map((t) => (
                <TaskRowView
                  key={t.id}
                  t={t}
                  members={members}
                  onStatus={changeStatus}
                  onReassign={reassign}
                  onEdit={() => setEditing(t)}
                  onDelete={() => setDeleting(t)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => (
            <div key={s} className="rounded-lg bg-sage-tint/60 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1.5">
                <StatusChip status={s} />
                <span className="meta">
                  {filtered.filter((t) => t.status === s).length}
                </span>
              </div>

              <div className="space-y-2">
                {filtered
                  .filter((t) => t.status === s)
                  .map((t) => (
                    <motion.div layout key={t.id} className="card p-3">
                      <p className="font-medium leading-snug">{t.title}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-strong">
                        <Person name={t.assignee?.full_name} />

                        {t.due_date && (
                          <span
                            className={cn(
                              isOverdue(t.due_date, t.status) &&
                                "text-terracotta-ink font-medium",
                            )}
                          >
                            {fmtDate(t.due_date)}
                          </span>
                        )}
                      </div>

                      <select
                        className="input mt-2.5 !h-8 !text-[12.5px]"
                        value={t.status}
                        onChange={(e) =>
                          changeStatus(t, e.target.value as Status)
                        }
                        aria-label={`Move ${t.title}`}
                      >
                        {STATUSES.map((x) => (
                          <option key={x} value={x}>
                            {STATUS_LABEL[x]}
                          </option>
                        ))}
                      </select>
                    </motion.div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskFormModal
        open={creating}
        onClose={() => setCreating(false)}
        members={members}
        defaultAssignee={currentUserId}
      />

      <TaskFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        members={members}
        task={editing}
      />

      <CompleteModal task={completing} onClose={() => setCompleting(null)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Delete this task?"
        body={`“${deleting?.title}” and its history will be permanently removed. This can’t be undone.`}
        confirmLabel="Delete task"
        onConfirm={() =>
          start(async () => {
            const r = await deleteTask(deleting!.id);

            r.ok ? toast.success("Task deleted") : toast.error(r.error);

            setDeleting(null);
          })
        }
      />
    </>
  );
}

function TaskRowView({
  t,
  members,
  onStatus,
  onReassign,
  onEdit,
  onDelete,
}: {
  t: TaskRow;
  members: Member[];
  onStatus: (t: TaskRow, s: Status) => void;
  onReassign: (t: TaskRow, id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  const overdue = isOverdue(t.due_date, t.status);

  async function toggle() {
    setOpen(!open);

    if (!open && !history) {
      setHistory(await getTaskHistory(t.id));
    }
  }

  return (
    <>
      <tr
        className={cn(
          "transition-colors hover:bg-sage-tint/40",
          overdue && "bg-terracotta-soft/30",
        )}
      >
        <td className="td">
          <button
            onClick={toggle}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={open}
          >
            <ChevronDown
              size={15}
              className={cn(
                "mt-0.5 shrink-0 text-muted transition-transform",
                open && "rotate-180",
              )}
            />

            <span>
              <span
                className={cn(
                  "font-medium",
                  t.status === "completed" && "text-muted-strong line-through",
                )}
              >
                {t.title}
              </span>

              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-strong">
                {t.origin_meeting && <span>from {t.origin_meeting.title}</span>}

                {t.source === "ai_extracted" && <AiChip />}

                {t.owner_uncertain && (
                  <span className="chip border-amber-soft bg-amber-soft text-amber-ink">
                    Owner unconfirmed
                  </span>
                )}

                {t.is_seed && <SeedChip />}
              </span>
            </span>
          </button>
        </td>

        <td className="td">
          <select
            className="input !h-8 !w-auto !border-transparent !bg-transparent !px-1 hover:!border-line"
            value={t.assignee_id ?? ""}
            onChange={(e) => onReassign(t, e.target.value)}
            aria-label={`Owner of ${t.title}`}
          >
            <option value="">Unassigned</option>

            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </td>

        <td className="td whitespace-nowrap">
          <span className={cn(overdue && "font-medium text-terracotta-ink")}>
            {fmtDate(t.due_date)}
          </span>

          {overdue && <OverdueChip />}
        </td>

        <td className="td">
          <PriorityChip priority={t.priority} />
        </td>

        <td className="td">
          <select
            className="input !h-8 !w-auto"
            value={t.status}
            onChange={(e) => onStatus(t, e.target.value as Status)}
            aria-label={`Status of ${t.title}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </td>

        <td className="td">
          <div className="flex justify-end gap-0.5">
            <button
              className="btn-ghost btn-sm !px-2"
              onClick={onEdit}
              aria-label={`Edit ${t.title}`}
            >
              <Pencil size={14} />
            </button>

            <button
              className="btn-ghost btn-sm !px-2 hover:!text-terracotta-ink"
              onClick={onDelete}
              aria-label={`Delete ${t.title}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      <AnimatePresence initial={false}>
        {open && (
          <tr>
            <td colSpan={6} className="border-b border-line bg-ivory/50 p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid gap-6 px-10 py-4 md:grid-cols-2">
                  <div>
                    {t.description && (
                      <p className="mb-3 text-[13.5px]">{t.description}</p>
                    )}

                    {t.completion_outcome && (
                      <p className="mb-3 rounded-md bg-sage-tint px-3 py-2 text-[13px]">
                        <b className="font-medium">Outcome:</b>{" "}
                        {t.completion_outcome}
                      </p>
                    )}

                    <p className="meta">
                      Created{" "}
                      {fmtDate(t.created_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {t.id.slice(0, 8)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-[12.5px] font-medium text-muted-strong">
                      History
                    </p>

                    {!history ? (
                      <p className="text-[13px] text-muted-strong">Loading…</p>
                    ) : history.length === 0 ? (
                      <p className="text-[13px] text-muted-strong">
                        No recorded changes.
                      </p>
                    ) : (
                      <ol className="space-y-1.5 border-l border-line pl-3">
                        {history.map((h) => (
                          <li key={h.id} className="text-[13px]">
                            <span className="font-medium">
                              {h.actor?.full_name ?? "System"}
                            </span>{" "}
                            <span className="text-muted-strong">
                              {describe(h)}
                            </span>{" "}
                            <span className="meta">
                              {fmtDateTime(h.created_at)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

function describe(h: HistoryEntry) {
  switch (h.action) {
    case "created":
      return h.meeting
        ? `created this in ${h.meeting.title}`
        : "created this task";

    case "reassigned":
      return `reassigned from ${h.old_value} to ${h.new_value}`;

    case "status_changed":
      return `changed status from ${h.old_value?.replace("_", " ")} to ${h.new_value?.replace("_", " ")}`;

    case "completed":
      return `completed this${h.note ? `: ${h.note}` : ""}`;

    case "reopened":
      return `reopened this (${h.new_value?.replace("_", " ")})`;

    case "due_changed":
      return `changed due date from ${h.old_value ?? "none"} to ${h.new_value ?? "none"}`;

    case "carried_forward":
      return `carried this into ${h.meeting?.title ?? "a meeting"}`;

    case "handover_transferred":
      return h.note ?? "transferred via handover";

    default:
      return `updated ${h.field ?? "task"}${h.new_value ? ` to “${h.new_value}”` : ""}`;
  }
}

function CompleteModal({
  task,
  onClose,
}: {
  task: TaskRow | null;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [busy, start] = useTransition();

  return (
    <Modal open={!!task} onClose={onClose} title="Complete task">
      <p className="mb-3 text-[14px]">{task?.title}</p>

      <Field
        label="What was the outcome?"
        hint="Optional, but it helps whoever picks this up later."
      >
        <textarea
          className="input min-h-[80px]"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="e.g. Shipped to staging; webhook retries still need a follow-up."
        />
      </Field>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>

        <button
          className="btn-primary"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await updateTask(task!.id, {
                status: "completed",
                completionOutcome: outcome || null,
              });

              if (r.ok) {
                toast.success("Task completed");
                setOutcome("");
                onClose();
              } else {
                toast.error(r.error);
              }
            })
          }
        >
          {busy ? "Saving…" : "Mark completed"}
        </button>
      </div>
    </Modal>
  );
}
