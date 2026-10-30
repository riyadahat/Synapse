"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDocument, linkDocument } from "@/app/actions/knowledge";
import { ConfirmDialog } from "@/components/modal";
export function DocActions({
  docId,
  tasks,
  meetings,
  currentMeeting,
  linkedTaskIds,
}: {
  docId: string;
  tasks: { id: string; title: string }[];
  meetings: { id: string; title: string }[];
  currentMeeting: string;
  linkedTaskIds: string[];
}) {
  const [pending, start] = useTransition();
  const [del, setDel] = useState(false);
  const run = (p: Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await p;
      r.ok ? toast.success(ok) : toast.error(r.error ?? "Failed");
    });
  return (
    <div className="card card-pad space-y-3">
      {" "}
      <label className="block">
        <span className="label">Link to a task</span>
        <select
          className="input"
          disabled={pending}
          defaultValue=""
          onChange={(e) =>
            e.target.value &&
            run(
              linkDocument(docId, { taskId: e.target.value }),
              "Linked to task",
            )
          }
        >
          <option value="">Choose a task</option>
          {tasks
            .filter((t) => !linkedTaskIds.includes(t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
      </label>{" "}
      <label className="block">
        <span className="label">Related meeting</span>
        <select
          className="input"
          disabled={pending}
          defaultValue={currentMeeting}
          onChange={(e) =>
            run(
              linkDocument(docId, { meetingId: e.target.value }),
              "Meeting link updated",
            )
          }
        >
          <option value="">None</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>{" "}
      <button
        className="btn-ghost btn-sm !text-terracotta-ink"
        onClick={() => setDel(true)}
      >
        Delete document
      </button>{" "}
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        danger
        title="Delete this document?"
        body="The text, its search index and the stored file will be removed. Links from tasks and meetings go with it."
        confirmLabel="Delete document"
        onConfirm={() =>
          start(async () => {
            await deleteDocument(docId);
          })
        }
        busy={pending}
      />{" "}
    </div>
  );
}
