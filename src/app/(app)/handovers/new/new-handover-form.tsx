"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  createHandover,
  generateHandoverBrief,
  previewHandover,
  type HandoverTask,
  type StoredBrief,
} from "@/app/actions/handovers";
import { ErrorNote, Field, StatusChip } from "@/components/ui";
import { SourceChip } from "../../catch-up/catch-up-client";
import { fmtDate } from "@/lib/utils";
import type { Member } from "@/lib/types";
export function NewHandoverForm({
  members,
  currentUserId,
  defaultProject,
}: {
  members: Member[];
  currentUserId: string;
  defaultProject: string;
}) {
  const router = useRouter();
  const [fromId, setFrom] = useState(currentUserId);
  const [toId, setTo] = useState("");
  const [project, setProject] = useState(defaultProject);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<HandoverTask[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [brief, setBrief] = useState<
    (StoredBrief & { aiNote?: string }) | null
  >(null);
  const [error, setError] = useState<string>();
  const [loading, load] = useTransition();
  const [generating, gen] = useTransition();
  const [saving, save] = useTransition();
  const loadTasks = (id: string) =>
    load(async () => {
      const r = await previewHandover(id);
      if (r.ok) {
        setTasks(r.data!.tasks);
        setSel(new Set(r.data!.tasks.map((t) => t.id)));
        setBrief(null);
      } else setError(r.error);
    });
  const pickFrom = (id: string) => {
    setFrom(id);
    setTasks(null);
    setBrief(null);
  };
  const generate = () => {
    setError(undefined);
    gen(async () => {
      const r = await generateHandoverBrief({
        fromId,
        toId,
        project,
        reason,
        notes,
        taskIds: [...sel],
      });
      if (r.ok) setBrief(r.data!);
      else setError(r.error);
    });
  };
  const setItem = (si: number, ii: number, text: string) =>
    setBrief(
      (b) =>
        b && {
          ...b,
          sections: b.sections.map((s, i) =>
            i !== si
              ? s
              : {
                  ...s,
                  items: s.items.map((x, j) => (j === ii ? { ...x, text } : x)),
                },
          ),
        },
    );
  const delItem = (si: number, ii: number) =>
    setBrief(
      (b) =>
        b && {
          ...b,
          sections: b.sections.map((s, i) =>
            i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) },
          ),
        },
    );
  const addItem = (si: number) =>
    setBrief(
      (b) =>
        b && {
          ...b,
          sections: b.sections.map((s, i) =>
            i !== si
              ? s
              : { ...s, items: [...s.items, { text: "", sources: [] }] },
          ),
        },
    );
  const submit = () =>
    save(async () => {
      const cleaned = brief && {
        ...brief,
        sections: brief.sections.map((s) => ({
          ...s,
          items: s.items.filter((i) => i.text.trim()),
        })),
      };
      const r = await createHandover({
        fromId,
        toId,
        project,
        reason,
        notes,
        taskIds: [...sel],
        brief: cleaned,
      });
      if (r.ok) {
        toast.success("Handover created. Waiting for acknowledgement.");
        router.push(`/handovers/${r.data!.id}`);
      } else setError(r.error);
    });
  return (
    <div className="space-y-6">
      {" "}
      <section className="card card-pad grid gap-4 sm:grid-cols-2">
        {" "}
        <Field label="Handing over">
          <select
            className="input"
            value={fromId}
            onChange={(e) => pickFrom(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </Field>{" "}
        <Field label="Taking over">
          <select
            className="input"
            value={toId}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="">Choose a person</option>
            {members
              .filter((m) => m.id !== fromId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
          </select>
        </Field>{" "}
        <Field label="Project">
          <input
            className="input"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        </Field>{" "}
        <Field label="Reason">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Parental leave from 3 Nov"
          />
        </Field>{" "}
        <div className="sm:col-span-2">
          <Field label="Additional notes">
            <textarea
              className="input min-h-[72px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the records won’t tell them: who to talk to, quirks, in-flight conversations."
            />
          </Field>
        </div>{" "}
        {!tasks && (
          <div className="sm:col-span-2">
            <button
              className="btn-primary"
              disabled={loading || !toId}
              onClick={() => loadTasks(fromId)}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}Find
              open tasks
            </button>
          </div>
        )}{" "}
      </section>{" "}
      {tasks && (
        <section className="card">
          {" "}
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-[15px] font-semibold">
              Open tasks owned by{" "}
              {members.find((m) => m.id === fromId)?.full_name}
            </h2>
            <p className="text-[12.5px] text-muted-strong">
              Select what moves over. Owners only change once the receiver
              accepts.
            </p>
          </div>{" "}
          {tasks.length === 0 ? (
            <p className="p-5 text-[13.5px] text-muted-strong">
              No open tasks are assigned to this person. You can still create a
              handover with a written brief.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {tasks.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-sage-tint/40">
                    <input
                      type="checkbox"
                      className="accent-[#71816B]"
                      checked={sel.has(t.id)}
                      onChange={() =>
                        setSel((s) => {
                          const n = new Set(s);
                          n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                          return n;
                        })
                      }
                    />
                    <span className="flex-1 font-medium">{t.title}</span>
                    <span className="text-[12.5px] text-muted-strong">
                      {fmtDate(t.due_date)}
                    </span>
                    <StatusChip status={t.status} />
                  </label>
                </li>
              ))}
            </ul>
          )}{" "}
          <div className="border-t border-line px-5 py-3">
            <button
              className="btn-primary"
              disabled={generating || !toId || project.trim().length < 2}
              onClick={generate}
            >
              {generating && <Loader2 size={14} className="animate-spin" />}
              {generating
                ? "Writing the brief…"
                : brief
                  ? "Regenerate brief"
                  : "Generate handover brief"}
            </button>
          </div>{" "}
        </section>
      )}{" "}
      {error && <ErrorNote>{error}</ErrorNote>}{" "}
      {brief && (
        <section className="card card-pad space-y-5 border-sage/50">
          {" "}
          <div>
            <h2 className="text-[15px] font-semibold">Handover brief</h2>
            <p className="text-[13px] text-muted-strong">
              {brief.generatedBy === "ai"
                ? "Drafted by AI from your records. Edit anything before saving."
                : `${brief.aiNote ?? "AI was unavailable."} This brief lists the records directly. Edit it before saving.`}
            </p>
          </div>{" "}
          {brief.sections.map((s, si) => (
            <div key={s.key}>
              <h3 className="mb-1.5 text-[13.5px] font-semibold">{s.title}</h3>{" "}
              <div className="space-y-2">
                {s.items.length === 0 && (
                  <p className="text-[13px] text-muted-strong">
                    Nothing recorded.
                  </p>
                )}{" "}
                {s.items.map((it, ii) => (
                  <div key={ii} className="flex gap-2">
                    <div className="flex-1">
                      <textarea
                        rows={2}
                        className="input"
                        value={it.text}
                        onChange={(e) => setItem(si, ii, e.target.value)}
                      />
                      {it.sources.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.sources.map((x) => (
                            <SourceChip key={x.alias} s={x} />
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn-ghost btn-sm !px-2 self-start"
                      onClick={() => delItem(si, ii)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}{" "}
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => addItem(si)}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
          ))}{" "}
          <div className="flex justify-end border-t border-line pt-4">
            <button className="btn-primary" disabled={saving} onClick={submit}>
              {saving && <Loader2 size={14} className="animate-spin" />}Create
              handover
            </button>
          </div>{" "}
        </section>
      )}{" "}
      {!brief && tasks && (
        <div className="flex justify-end">
          <button
            className="btn-secondary"
            disabled={saving || !toId}
            onClick={submit}
          >
            Create without a brief
          </button>
        </div>
      )}{" "}
    </div>
  );
}
