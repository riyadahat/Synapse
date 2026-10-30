"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  addDecision,
  carryForwardAction,
  deleteDecision,
  setAttendance,
  updateMeeting,
} from "@/app/actions/meetings";
import { Modal } from "@/components/modal";
import { TaskFormModal } from "@/components/task-form";
import {
  AiChip,
  EmptyState,
  Field,
  OverdueChip,
  Person,
  PriorityChip,
  StatusChip,
} from "@/components/ui";
import { cn, fmtDate, fmtDateTime, isOverdue } from "@/lib/utils";
import type { Member, TaskRow } from "@/lib/types";
import type { CarryItem, DocHit } from "@/lib/queries";
interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  agenda: string | null;
  notes: string | null;
  summary: string | null;
  discussion_points: string[];
  unresolved_questions: string[];
}
interface Part {
  user_id: string;
  attended: boolean | null;
  profile: { full_name: string; role_title: string | null };
}
interface Dec {
  id: string;
  text: string;
  rationale: string | null;
  source: string;
}
const TABS = [
  "Overview",
  "Notes",
  "Decisions",
  "Action items",
  "Related knowledge",
] as const;
export function MeetingTabs({
  meeting,
  participants,
  decisions,
  tasks,
  related,
  openItems,
  members,
}: {
  meeting: Meeting;
  participants: Part[];
  decisions: Dec[];
  tasks: (TaskRow & { relation: string })[];
  related: DocHit[];
  openItems: CarryItem[];
  members: Member[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [editing, setEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [carrying, setCarrying] = useState(false);
  const [, start] = useTransition();
  const counts: Record<string, number> = {
    Decisions: decisions.length,
    "Action items": tasks.length,
    "Related knowledge": related.length,
  };
  return (
    <>
      {" "}
      <div className="mb-5 flex items-center justify-between border-b border-line">
        {" "}
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {" "}
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-[13.5px] transition-colors",
                tab === t
                  ? "font-medium text-ink"
                  : "text-muted-strong hover:text-ink",
              )}
            >
              {" "}
              {t}
              {counts[t] !== undefined && (
                <span className="ml-1.5 text-[12px] text-muted-strong">
                  {counts[t]}
                </span>
              )}{" "}
              {tab === t && (
                <motion.span
                  layoutId="mtab"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sage"
                />
              )}{" "}
            </button>
          ))}{" "}
        </div>{" "}
        <button
          className="btn-secondary btn-sm mb-1.5 shrink-0"
          onClick={() => setEditing(true)}
        >
          <Pencil size={13} />
          Edit
        </button>{" "}
      </div>{" "}
      {tab === "Overview" && (
        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          {" "}
          <div className="space-y-5">
            {" "}
            <section className="card card-pad">
              <h2 className="mb-1.5 text-[15px] font-semibold">Summary</h2>
              <p className="text-[14.5px] leading-relaxed">
                {meeting.summary ?? (
                  <span className="text-muted-strong">
                    No summary yet. Add one with Edit.
                  </span>
                )}
              </p>{" "}
              {meeting.discussion_points?.length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-5 text-[13px] font-medium text-muted-strong">
                    Key discussion points
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-[14px]">
                    {meeting.discussion_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </>
              )}{" "}
              {meeting.unresolved_questions?.length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-5 text-[13px] font-medium text-muted-strong">
                    Still unresolved
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-[14px]">
                    {meeting.unresolved_questions.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>{" "}
            {meeting.agenda && (
              <section className="card card-pad">
                <h2 className="mb-1.5 text-[15px] font-semibold">Agenda</h2>
                <p className="whitespace-pre-wrap text-[14px]">
                  {meeting.agenda}
                </p>
              </section>
            )}{" "}
          </div>{" "}
          <aside className="card card-pad h-fit">
            <p className="meta mb-3">{fmtDateTime(meeting.scheduled_at)}</p>
            <h2 className="mb-2 text-[14px] font-semibold">
              Participants
            </h2>{" "}
            {participants.length === 0 ? (
              <p className="text-[13px] text-muted-strong">
                No participants recorded.
              </p>
            ) : (
              <ul className="space-y-2">
                {participants.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Person name={p.profile.full_name} />{" "}
                    <select
                      aria-label={`Attendance for ${p.profile.full_name}`}
                      className="rounded border border-line bg-white px-1.5 py-1 text-[12.5px]"
                      value={
                        p.attended === null ? "" : p.attended ? "yes" : "no"
                      }
                      onChange={(e) =>
                        start(async () => {
                          const r = await setAttendance(
                            meeting.id,
                            p.user_id,
                            e.target.value === ""
                              ? null
                              : e.target.value === "yes",
                          );
                          r.ok
                            ? toast.success("Attendance updated")
                            : toast.error(r.error);
                        })
                      }
                    >
                      {" "}
                      <option value="">Not recorded</option>
                      <option value="yes">Attended</option>
                      <option value="no">Absent</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}{" "}
          </aside>{" "}
        </div>
      )}{" "}
      {tab === "Notes" && (
        <section className="card card-pad">
          {meeting.notes ? (
            <p className="max-w-3xl whitespace-pre-wrap text-[14.5px] leading-relaxed">
              {meeting.notes}
            </p>
          ) : (
            <EmptyState
              title="No notes recorded"
              body="Add the raw notes from this meeting so they can be searched and summarised later."
              action={
                <button
                  className="btn-primary"
                  onClick={() => setEditing(true)}
                >
                  Add notes
                </button>
              }
            />
          )}
        </section>
      )}{" "}
      {tab === "Decisions" && (
        <DecisionsTab meetingId={meeting.id} decisions={decisions} />
      )}{" "}
      {tab === "Action items" && (
        <section>
          {" "}
          <div className="mb-3 flex justify-end gap-2">
            <button
              className="btn-secondary btn-sm"
              onClick={() => setCarrying(true)}
              disabled={!openItems.length}
            >
              Carry forward open items
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={() => setAddingTask(true)}
            >
              <Plus size={14} />
              Add action item
            </button>
          </div>{" "}
          {tasks.length === 0 ? (
            <EmptyState
              title="No action items yet"
              body="Add one here, or carry forward unfinished work from earlier meetings."
            />
          ) : (
            <div className="card divide-y divide-line">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5"
                >
                  {" "}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-medium",
                        t.status === "completed" &&
                          "text-muted-strong line-through",
                      )}
                    >
                      {t.title}
                    </p>{" "}
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-strong">
                      {t.relation === "carried_forward" ? (
                        <span className="chip border-sage-soft bg-sage-tint text-sage-dark">
                          Carried forward
                        </span>
                      ) : t.source === "ai_extracted" ? (
                        <AiChip />
                      ) : null}
                      {t.owner_uncertain && (
                        <span className="chip border-amber-soft bg-amber-soft text-amber-ink">
                          Owner unconfirmed
                        </span>
                      )}
                      {t.origin_meeting &&
                        t.origin_meeting.id !== meeting.id && (
                          <span>originally from {t.origin_meeting.title}</span>
                        )}
                    </p>
                  </div>{" "}
                  <Person name={t.assignee?.full_name} />
                  <span
                    className={cn(
                      "text-[13px]",
                      isOverdue(t.due_date, t.status) &&
                        "font-medium text-terracotta-ink",
                    )}
                  >
                    {fmtDate(t.due_date)}
                  </span>
                  {isOverdue(t.due_date, t.status) && <OverdueChip />}
                  <PriorityChip priority={t.priority} />
                  <StatusChip status={t.status} />{" "}
                </div>
              ))}
            </div>
          )}{" "}
          <p className="mt-3 text-[12.5px] text-muted-strong">
            Manage status, owners and history on the{" "}
            <Link
              href="/tasks?owner=all"
              className="underline underline-offset-2"
            >
              Tasks page
            </Link>
            .
          </p>{" "}
        </section>
      )}{" "}
      {tab === "Related knowledge" && (
        <section>
          {related.length === 0 ? (
            <EmptyState
              title="No related documents"
              body="Documents that mention this meeting’s topics will appear here. Upload one in the Knowledge Base."
              action={
                <Link href="/knowledge" className="btn-secondary">
                  Open Knowledge Base
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {related.map((d) => (
                <Link
                  key={d.id}
                  href={`/knowledge/${d.id}`}
                  className="card card-pad transition-colors hover:bg-sage-tint/40"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <FileText size={15} className="text-sage" />
                    {d.title}
                    {d.linked && (
                      <span className="chip border-sage-soft bg-sage-tint text-sage-dark">
                        Linked
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 text-[13px] text-muted-strong">
                    {d.snippet}
                  </p>
                </Link>
              ))}
            </div>
          )}{" "}
          <p className="mt-3 text-[12.5px] text-muted-strong">
            Matched by keyword against the meeting’s title, agenda and tasks.
          </p>
        </section>
      )}{" "}
      <EditMeeting
        open={editing}
        onClose={() => setEditing(false)}
        meeting={meeting}
      />{" "}
      <TaskFormModal
        open={addingTask}
        onClose={() => setAddingTask(false)}
        members={members}
        originMeetingId={meeting.id}
      />{" "}
      <CarryModal
        open={carrying}
        onClose={() => setCarrying(false)}
        meetingId={meeting.id}
        items={openItems}
      />{" "}
    </>
  );
}
function DecisionsTab({
  meetingId,
  decisions,
}: {
  meetingId: string;
  decisions: Dec[];
}) {
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3">
      {" "}
      {decisions.length === 0 ? (
        <EmptyState
          title="No decisions recorded"
          body="Record what was decided, and why, so nobody has to ask again."
        />
      ) : (
        <div className="card divide-y divide-line">
          {decisions.map((d) => (
            <div key={d.id} className="flex items-start gap-3 px-5 py-3.5">
              <Check size={16} className="mt-1 shrink-0 text-sage" />{" "}
              <div className="flex-1">
                <p className="font-medium">{d.text}</p>
                {d.rationale && (
                  <p className="mt-0.5 text-[13.5px] text-muted-strong">
                    {d.rationale}
                  </p>
                )}
                {d.source === "ai_inferred" && (
                  <span className="chip mt-1.5 border-amber-soft bg-amber-soft text-amber-ink">
                    Inferred by AI, confirmed by a person
                  </span>
                )}
              </div>{" "}
              <button
                className="btn-ghost btn-sm !px-2 hover:!text-terracotta-ink"
                aria-label="Delete decision"
                onClick={() =>
                  start(async () => {
                    const r = await deleteDecision(d.id);
                    r.ok
                      ? toast.success("Decision removed")
                      : toast.error(r.error);
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}{" "}
      <form
        className="card card-pad space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addDecision(meetingId, text, why);
            if (r.ok) {
              toast.success("Decision recorded");
              setText("");
              setWhy("");
            } else toast.error(r.error);
          });
        }}
      >
        {" "}
        <Field label="Record a decision">
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Postpone the UI redesign until after launch"
          />
        </Field>{" "}
        <Field label="Why? (optional)">
          <input
            className="input"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
        </Field>{" "}
        <button
          className="btn-primary"
          disabled={pending || text.trim().length < 3}
        >
          {pending ? "Saving…" : "Add decision"}
        </button>{" "}
      </form>{" "}
    </section>
  );
}
function EditMeeting({
  open,
  onClose,
  meeting,
}: {
  open: boolean;
  onClose: () => void;
  meeting: Meeting;
}) {
  const local = (iso: string) => {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [f, setF] = useState({
    title: meeting.title,
    when: local(meeting.scheduled_at),
    agenda: meeting.agenda ?? "",
    notes: meeting.notes ?? "",
    summary: meeting.summary ?? "",
  });
  const [pending, start] = useTransition();
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open={open} onClose={onClose} title="Edit meeting" wide>
      {" "}
      <div className="space-y-4">
        {" "}
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <Field label="Title">
            <input className="input" value={f.title} onChange={set("title")} />
          </Field>
          <Field label="Date and time">
            <input
              type="datetime-local"
              className="input"
              value={f.when}
              onChange={set("when")}
            />
          </Field>
        </div>{" "}
        <Field label="Summary">
          <textarea
            className="input min-h-[64px]"
            value={f.summary}
            onChange={set("summary")}
          />
        </Field>{" "}
        <Field label="Agenda">
          <textarea
            className="input min-h-[64px]"
            value={f.agenda}
            onChange={set("agenda")}
          />
        </Field>{" "}
        <Field label="Notes">
          <textarea
            className="input min-h-[140px]"
            value={f.notes}
            onChange={set("notes")}
          />
        </Field>{" "}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>{" "}
          <button
            className="btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateMeeting(meeting.id, {
                  title: f.title,
                  scheduledAt: new Date(f.when).toISOString(),
                  agenda: f.agenda || null,
                  notes: f.notes || null,
                  summary: f.summary || null,
                });
                if (r.ok) {
                  toast.success("Meeting updated");
                  onClose();
                } else toast.error(r.error);
              })
            }
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>{" "}
      </div>{" "}
    </Modal>
  );
}
function CarryModal({
  open,
  onClose,
  meetingId,
  items,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  items: CarryItem[];
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  return (
    <Modal open={open} onClose={onClose} title="Carry forward open items" wide>
      {" "}
      <p className="mb-3 text-[13.5px] text-muted-strong">
        These tasks stay one task with one history. This meeting is simply added
        to where they’re discussed.
      </p>{" "}
      <ul className="max-h-[360px] divide-y divide-line overflow-y-auto rounded-md border border-line">
        {items.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-sage-tint/40">
              <input
                type="checkbox"
                className="mt-1 accent-[#71816B]"
                checked={sel.has(t.id)}
                onChange={() =>
                  setSel((s) => {
                    const n = new Set(s);
                    n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                    return n;
                  })
                }
              />{" "}
              <span className="flex-1 text-[13.5px]">
                <span className="font-medium">{t.title}</span>
                <span className="block text-[12.5px] text-muted-strong">
                  {t.assignee ?? "Unassigned"} · due {fmtDate(t.due_date)} ·
                  from {t.originMeeting?.title ?? "—"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>{" "}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>{" "}
        <button
          className="btn-primary"
          disabled={!sel.size || pending}
          onClick={() =>
            start(async () => {
              const r = await carryForwardAction(meetingId, [...sel]);
              if (r.ok) {
                toast.success(`${r.data?.count ?? 0} task(s) carried forward`);
                setSel(new Set());
                onClose();
              } else toast.error(r.error);
            })
          }
        >
          {pending
            ? "Carrying…"
            : `Carry forward${sel.size ? ` (${sel.size})` : ""}`}
        </button>
      </div>{" "}
    </Modal>
  );
}
