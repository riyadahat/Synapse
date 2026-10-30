"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import {
  createMeeting,
  extractFromNotes,
  type ExtractionResult,
} from "@/app/actions/meetings";
import {
  ErrorNote,
  Field,
  AiChip,
  OverdueChip,
  StatusChip,
} from "@/components/ui";
import { cn, fmtDate, isOverdue } from "@/lib/utils";
import type { Member } from "@/lib/types";
import type { CarryItem } from "@/lib/queries";
interface DraftTask {
  include: boolean;
  title: string;
  description: string;
  assigneeId: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  ownerUncertain: boolean;
  evidence: string;
  flags: string[];
  ownerText: string | null;
  deadlineText: string | null;
  ownerBasis: string;
}
interface DraftDecision {
  text: string;
  rationale: string;
  inferred: boolean;
  include: boolean;
}
interface Draft {
  summary: string;
  points: string[];
  questions: string[];
  decisions: DraftDecision[];
  tasks: DraftTask[];
}
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
export function NewMeetingForm({
  members,
  currentUserId,
  openItems,
  aiAvailable,
}: {
  members: Member[];
  currentUserId: string;
  openItems: CarryItem[];
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(nowLocal());
  const [agenda, setAgenda] = useState("");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState<
    Record<string, "attended" | "absent" | "none" | undefined>
  >(
    Object.fromEntries(
      members.map((m) => [
        m.id,
        m.id === currentUserId ? "attended" : undefined,
      ]),
    ),
  );
  const [carry, setCarry] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiError, setAiError] = useState<string>();
  const [latency, setLatency] = useState<number>();
  const [error, setError] = useState<string>();
  const [analysing, startAnalyse] = useTransition();
  const [saving, startSave] = useTransition();
  const invited = Object.entries(participants)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const attended = Object.entries(participants)
    .filter(([, v]) => v === "attended")
    .map(([id]) => id);
  const toggleCarry = (id: string) =>
    setCarry((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  function analyse() {
    setAiError(undefined);
    setError(undefined);
    startAnalyse(async () => {
      const r = await extractFromNotes({
        title: title || "Untitled meeting",
        scheduledAt: new Date(when).toISOString(),
        agenda,
        notes,
      });
      if (!r.ok) {
        setAiError(r.error);
        return;
      }
      const {
        extraction: x,
        ownerMatches,
        latencyMs,
      }: ExtractionResult = r.data!;
      setLatency(latencyMs);
      setDraft({
        summary: x.summary,
        points: x.discussionPoints,
        questions: x.unresolvedQuestions,
        decisions: x.decisions.map((d) => ({
          text: d.text,
          rationale: d.rationale ?? "",
          inferred: d.basis === "inferred",
          include: true,
        })),
        tasks: x.actionItems.map((a, i) => ({
          include: true,
          title: a.title,
          description: a.description ?? "",
          assigneeId: ownerMatches[i] ?? "",
          dueDate: a.deadlineDate ?? "",
          priority: a.priority ?? "medium",
          ownerUncertain:
            a.ownerBasis !== "explicit" || (!!a.owner && !ownerMatches[i]),
          evidence: a.evidence,
          flags: a.flags,
          ownerText: a.owner,
          deadlineText: a.deadlineText,
          ownerBasis: a.ownerBasis,
        })),
      });
      toast.success("Draft ready. Review it before saving.");
    });
  }
  function save(withDraft: boolean) {
    setError(undefined);
    if (title.trim().length < 2) return setError("Give the meeting a title.");
    startSave(async () => {
      const confirmed =
        withDraft && draft
          ? {
              summary: draft.summary,
              discussionPoints: draft.points.filter(Boolean),
              unresolvedQuestions: draft.questions.filter(Boolean),
              decisions: draft.decisions
                .filter((d) => d.include && d.text.trim())
                .map((d) => ({
                  text: d.text.trim(),
                  rationale: d.rationale.trim() || null,
                  source: d.inferred
                    ? ("ai_inferred" as const)
                    : ("ai_explicit" as const),
                })),
              tasks: draft.tasks
                .filter((t) => t.include && t.title.trim().length >= 2)
                .map((t) => ({
                  title: t.title.trim(),
                  description: t.description.trim() || null,
                  assigneeId: t.assigneeId || null,
                  dueDate: t.dueDate || null,
                  priority: t.priority,
                  ownerUncertain:
                    t.ownerUncertain && !t.assigneeId ? true : t.ownerUncertain,
                })),
            }
          : null;
      const r = await createMeeting({
        title,
        scheduledAt: new Date(when).toISOString(),
        agenda: agenda || null,
        notes: notes || null,
        participantIds: invited,
        attendedIds: attended,
        carryForwardTaskIds: [...carry],
        confirmed,
      });
      if (!r.ok) return setError(r.error);
      toast.success("Meeting saved");
      router.push(`/meetings/${r.data!.id}`);
    });
  }
  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => d && { ...d, [k]: v });
  const updTask = (i: number, patch: Partial<DraftTask>) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          tasks: d.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)),
        },
    );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {" "}
      <div className="space-y-6">
        {" "}
        <section className="card card-pad space-y-4">
          {" "}
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            {" "}
            <Field label="Title">
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Payment gateway sync"
              />
            </Field>{" "}
            <Field label="Date and time">
              <input
                type="datetime-local"
                className="input"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </Field>{" "}
          </div>{" "}
          <Field label="Agenda">
            <textarea
              className="input min-h-[64px]"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="What do you want to cover?"
            />
          </Field>{" "}
          <div>
            {" "}
            <span className="label">Participants and attendance</span>{" "}
            <div className="grid gap-2 sm:grid-cols-2">
              {" "}
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-line px-3 py-1.5"
                >
                  {" "}
                  <span className="text-[13.5px]">
                    {m.full_name}
                    {m.role_title && (
                      <span className="text-muted-strong">
                        {" "}
                        · {m.role_title}
                      </span>
                    )}
                  </span>{" "}
                  <select
                    aria-label={`Attendance for ${m.full_name}`}
                    className="rounded border-0 bg-transparent text-[12.5px] text-muted-strong"
                    value={participants[m.id] ?? ""}
                    onChange={(e) =>
                      setParticipants((p) => ({
                        ...p,
                        [m.id]: (e.target.value || undefined) as never,
                      }))
                    }
                  >
                    {" "}
                    <option value="">Not invited</option>
                    <option value="attended">Attended</option>
                    <option value="none">Invited</option>
                    <option value="absent">Absent</option>{" "}
                  </select>{" "}
                </div>
              ))}{" "}
            </div>{" "}
          </div>{" "}
        </section>{" "}
        <section className="card card-pad">
          {" "}
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Meeting notes</h2>
            <span className="text-[12px] text-muted-strong">
              {notes.length.toLocaleString()} characters
            </span>
          </div>{" "}
          <textarea
            className="input min-h-[200px] font-[inherit]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste or type raw notes. Names, owners and deadlines are picked up only if you actually wrote them."
          />{" "}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {" "}
            <button
              className="btn-primary"
              onClick={analyse}
              disabled={analysing || !aiAvailable || notes.trim().length < 20}
            >
              {" "}
              {analysing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {analysing
                ? "Reading your notes…"
                : "Draft summary and action items"}{" "}
            </button>{" "}
            {!aiAvailable && (
              <span className="text-[12.5px] text-muted-strong">
                AI isn’t configured; you can still save manually.
              </span>
            )}{" "}
          </div>{" "}
          {aiError && (
            <div className="mt-3">
              <ErrorNote>{aiError}</ErrorNote>
            </div>
          )}{" "}
        </section>{" "}
        {draft && (
          <section
            className="card card-pad space-y-5 border-sage/50"
            aria-label="Review AI draft"
          >
            {" "}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {" "}
              <div>
                <h2 className="text-[15px] font-semibold">Review the draft</h2>
                <p className="text-[13px] text-muted-strong">
                  Nothing is saved until you confirm. Edit anything, and untick
                  what you don’t want.
                </p>
              </div>{" "}
              {latency && (
                <span className="meta">
                  analysed in {(latency / 1000).toFixed(1)}s
                </span>
              )}{" "}
            </div>{" "}
            <Field label="Summary">
              <textarea
                className="input min-h-[72px]"
                value={draft.summary}
                onChange={(e) => upd("summary", e.target.value)}
              />
            </Field>{" "}
            <div>
              <span className="label">Key discussion points</span>{" "}
              <div className="space-y-1.5">
                {draft.points.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input"
                      value={p}
                      onChange={(e) =>
                        upd(
                          "points",
                          draft.points.map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        )
                      }
                    />
                    <button
                      className="btn-ghost btn-sm !px-2"
                      onClick={() =>
                        upd(
                          "points",
                          draft.points.filter((_, j) => j !== i),
                        )
                      }
                      aria-label="Remove point"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}{" "}
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => upd("points", [...draft.points, ""])}
                >
                  <Plus size={14} />
                  Add point
                </button>
              </div>
            </div>{" "}
            <div>
              <span className="label">Decisions</span>{" "}
              <div className="space-y-2">
                {draft.decisions.length === 0 && (
                  <p className="text-[13px] text-muted-strong">
                    No decisions were stated in the notes.
                  </p>
                )}{" "}
                {draft.decisions.map((d, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md border border-line p-3",
                      !d.include && "opacity-50",
                    )}
                  >
                    {" "}
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-2.5 accent-[#71816B]"
                        checked={d.include}
                        onChange={(e) =>
                          upd(
                            "decisions",
                            draft.decisions.map((x, j) =>
                              j === i ? { ...x, include: e.target.checked } : x,
                            ),
                          )
                        }
                        aria-label="Include decision"
                      />{" "}
                      <div className="flex-1 space-y-1.5">
                        <input
                          className="input"
                          value={d.text}
                          onChange={(e) =>
                            upd(
                              "decisions",
                              draft.decisions.map((x, j) =>
                                j === i ? { ...x, text: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <input
                          className="input"
                          placeholder="Rationale (optional)"
                          value={d.rationale}
                          onChange={(e) =>
                            upd(
                              "decisions",
                              draft.decisions.map((x, j) =>
                                j === i
                                  ? { ...x, rationale: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>{" "}
                      {d.inferred ? (
                        <span className="chip mt-2 border-amber-soft bg-amber-soft text-amber-ink">
                          Inferred
                        </span>
                      ) : (
                        <span className="chip mt-2 border-line text-muted-strong">
                          Stated
                        </span>
                      )}
                    </div>{" "}
                  </div>
                ))}
              </div>
            </div>{" "}
            <div>
              <span className="label">Action items</span>{" "}
              <div className="space-y-2">
                {draft.tasks.length === 0 && (
                  <p className="text-[13px] text-muted-strong">
                    No action items were found in the notes.
                  </p>
                )}{" "}
                {draft.tasks.map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md border border-line p-3",
                      !t.include && "opacity-50",
                    )}
                  >
                    {" "}
                    <div className="flex items-start gap-2">
                      {" "}
                      <input
                        type="checkbox"
                        className="mt-2.5 accent-[#71816B]"
                        checked={t.include}
                        onChange={(e) =>
                          updTask(i, { include: e.target.checked })
                        }
                        aria-label="Include action item"
                      />{" "}
                      <div className="flex-1 space-y-2">
                        {" "}
                        <input
                          className="input font-medium"
                          value={t.title}
                          onChange={(e) =>
                            updTask(i, { title: e.target.value })
                          }
                        />{" "}
                        <div className="grid gap-2 sm:grid-cols-3">
                          {" "}
                          <select
                            className="input"
                            aria-label="Owner"
                            value={t.assigneeId}
                            onChange={(e) =>
                              updTask(i, {
                                assigneeId: e.target.value,
                                ownerUncertain: false,
                              })
                            }
                          >
                            <option value="">No owner</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name}
                              </option>
                            ))}
                          </select>{" "}
                          <input
                            type="date"
                            className="input"
                            aria-label="Due date"
                            value={t.dueDate}
                            onChange={(e) =>
                              updTask(i, { dueDate: e.target.value })
                            }
                          />{" "}
                          <select
                            className="input"
                            aria-label="Priority"
                            value={t.priority}
                            onChange={(e) =>
                              updTask(i, {
                                priority: e.target
                                  .value as DraftTask["priority"],
                              })
                            }
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>{" "}
                        </div>{" "}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-strong">
                          {" "}
                          {t.ownerText && (
                            <span>
                              Notes say owner:{" "}
                              <b className="font-medium text-ink">
                                {t.ownerText}
                              </b>
                              {t.ownerBasis === "inferred" && " (inferred)"}
                            </span>
                          )}{" "}
                          {t.deadlineText ? (
                            <span>
                              Deadline in notes:{" "}
                              <b className="font-medium text-ink">
                                {t.deadlineText}
                              </b>
                            </span>
                          ) : (
                            <span>No deadline stated</span>
                          )}{" "}
                          {!t.ownerText && (
                            <span className="text-amber-ink">
                              No owner named. Choose one or leave open.
                            </span>
                          )}{" "}
                        </div>{" "}
                        {t.flags.map((f, k) => (
                          <p
                            key={k}
                            className="flex items-start gap-1.5 text-[12.5px] text-amber-ink"
                          >
                            <AlertTriangle
                              size={13}
                              className="mt-0.5 shrink-0"
                            />
                            {f}
                          </p>
                        ))}{" "}
                        {t.evidence && (
                          <p className="border-l-2 border-sage-soft pl-2 text-[12.5px] italic text-muted-strong">
                            “{t.evidence}”
                          </p>
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
                <button
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    upd("tasks", [
                      ...draft.tasks,
                      {
                        include: true,
                        title: "",
                        description: "",
                        assigneeId: "",
                        dueDate: "",
                        priority: "medium",
                        ownerUncertain: false,
                        evidence: "",
                        flags: [],
                        ownerText: null,
                        deadlineText: null,
                        ownerBasis: "none",
                      },
                    ])
                  }
                >
                  <Plus size={14} />
                  Add action item
                </button>
              </div>
            </div>{" "}
            {draft.questions.length > 0 && (
              <div>
                <span className="label">Unresolved questions</span>
                <ul className="space-y-1.5">
                  {draft.questions.map((q, i) => (
                    <li key={i} className="flex gap-2">
                      <input
                        className="input"
                        value={q}
                        onChange={(e) =>
                          upd(
                            "questions",
                            draft.questions.map((x, j) =>
                              j === i ? e.target.value : x,
                            ),
                          )
                        }
                      />
                      <button
                        className="btn-ghost btn-sm !px-2"
                        onClick={() =>
                          upd(
                            "questions",
                            draft.questions.filter((_, j) => j !== i),
                          )
                        }
                        aria-label="Remove question"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}{" "}
            {error && <ErrorNote>{error}</ErrorNote>}{" "}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              {" "}
              <button className="btn-secondary" onClick={() => setDraft(null)}>
                Discard draft
              </button>{" "}
              <button
                className="btn-primary"
                disabled={saving}
                onClick={() => save(true)}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Confirm and save meeting
              </button>{" "}
            </div>{" "}
          </section>
        )}{" "}
        {!draft && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {error && <ErrorNote>{error}</ErrorNote>}
            <button
              className="btn-secondary"
              disabled={saving}
              onClick={() => save(false)}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}Save
              without AI
            </button>
          </div>
        )}{" "}
      </div>{" "}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        {" "}
        <div className="card">
          {" "}
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[14px] font-semibold">
              Open items from previous meetings
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-strong">
              Select what you’ll discuss again. The same task carries forward
              with its full history; nothing is duplicated.
            </p>
          </div>{" "}
          {openItems.length === 0 ? (
            <p className="p-4 text-[13px] text-muted-strong">
              Nothing is open. Every task from earlier meetings is complete.
            </p>
          ) : (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {" "}
              {openItems.map((t) => (
                <li key={t.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-sage-tint/40",
                      carry.has(t.id) && "bg-sage-tint",
                    )}
                  >
                    {" "}
                    <input
                      type="checkbox"
                      className="mt-1 accent-[#71816B]"
                      checked={carry.has(t.id)}
                      onChange={() => toggleCarry(t.id)}
                    />{" "}
                    <span className="min-w-0 flex-1">
                      {" "}
                      <span className="block text-[13.5px] font-medium leading-snug">
                        {t.title}
                      </span>{" "}
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-strong">
                        <StatusChip status={t.status} />
                        <span>{t.assignee ?? "Unassigned"}</span>
                      </span>{" "}
                      <span className="mt-1 block text-[12px] text-muted-strong">
                        Due {fmtDate(t.due_date)}{" "}
                        {isOverdue(t.due_date, t.status) && <OverdueChip />}
                      </span>{" "}
                      {t.originMeeting && (
                        <span className="mt-0.5 block text-[12px] text-muted-strong">
                          From {t.originMeeting.title},{" "}
                          {fmtDate(t.originMeeting.date)}
                        </span>
                      )}{" "}
                    </span>
                  </label>
                </li>
              ))}{" "}
            </ul>
          )}{" "}
          {carry.size > 0 && (
            <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-sage-dark">
              {carry.size} selected to discuss again
            </p>
          )}{" "}
        </div>{" "}
      </aside>{" "}
    </div>
  );
}
