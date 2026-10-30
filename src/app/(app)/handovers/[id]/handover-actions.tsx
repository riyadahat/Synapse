"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acknowledgeHandover, declineHandover } from "@/app/actions/handovers";
import { ConfirmDialog } from "@/components/modal";
import { StatusChip } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
export function HandoverActions({
  handoverId,
  status,
  canRespond,
  toName,
  tasks,
}: {
  handoverId: string;
  status: string;
  canRespond: boolean;
  toName: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    due: string | null;
    transferred: boolean;
  }[];
}) {
  const [sel, setSel] = useState<Set<string>>(
    new Set(tasks.filter((t) => !t.transferred).map((t) => t.id)),
  );
  const [confirm, setConfirm] = useState<"accept" | "decline" | null>(null);
  const [pending, start] = useTransition();
  if (status !== "pending") return null;
  if (!canRespond)
    return (
      <div className="card card-pad text-[13.5px]">
        <p className="font-medium">Waiting for {toName}</p>
        <p className="mt-1 text-muted-strong">
          Tasks stay with their current owner until {toName.split(" ")[0]}{" "}
          acknowledges this handover.
        </p>
      </div>
    );
  return (
    <div className="card">
      {" "}
      <div className="border-b border-line px-4 py-3">
        <p className="font-medium">Your approval is needed</p>
        <p className="mt-0.5 text-[12.5px] text-muted-strong">
          Choose the tasks you’re taking on. Only these will become yours.
        </p>
      </div>{" "}
      <ul className="divide-y divide-line">
        {tasks.map((t) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-sage-tint/40">
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
              />
              <span className="flex-1 text-[13.5px]">
                {t.title}
                <span className="block text-[12px] text-muted-strong">
                  Due {fmtDate(t.due)}
                </span>
              </span>
              <StatusChip status={t.status} />
            </label>
          </li>
        ))}
      </ul>{" "}
      <div className="flex gap-2 border-t border-line p-3">
        <button
          className="btn-primary flex-1"
          onClick={() => setConfirm("accept")}
        >
          Acknowledge{sel.size ? ` and accept ${sel.size}` : ""}
        </button>
        <button className="btn-secondary" onClick={() => setConfirm("decline")}>
          Decline
        </button>
      </div>{" "}
      <ConfirmDialog
        open={confirm === "accept"}
        onClose={() => setConfirm(null)}
        busy={pending}
        title="Acknowledge this handover?"
        confirmLabel="Acknowledge"
        body={`You’ll become the owner of ${sel.size} task${sel.size === 1 ? "" : "s"}. The change is recorded in each task’s history.`}
        onConfirm={() =>
          start(async () => {
            const r = await acknowledgeHandover(handoverId, [...sel]);
            r.ok
              ? toast.success("Handover acknowledged")
              : toast.error(r.error);
            setConfirm(null);
          })
        }
      />{" "}
      <ConfirmDialog
        open={confirm === "decline"}
        onClose={() => setConfirm(null)}
        busy={pending}
        danger
        title="Decline this handover?"
        confirmLabel="Decline"
        body="No tasks will move. The sender will see that the handover was declined."
        onConfirm={() =>
          start(async () => {
            const r = await declineHandover(handoverId);
            r.ok ? toast.success("Handover declined") : toast.error(r.error);
            setConfirm(null);
          })
        }
      />{" "}
    </div>
  );
}
