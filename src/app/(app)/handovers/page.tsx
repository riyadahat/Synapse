import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext } from "@/lib/context";
import { EmptyState, PageHeader, SeedChip } from "@/components/ui";
import { cn, fmtDate } from "@/lib/utils";
export const metadata = { title: "Handovers" };
const STYLE: Record<string, string> = {
  pending: "border-amber-soft bg-amber-soft text-amber-ink",
  acknowledged: "border-sage-soft bg-sage-tint text-sage-dark",
  declined: "border-terracotta-soft bg-terracotta-soft text-terracotta-ink",
};
export default async function HandoversPage() {
  const { supabase, team } = await getContext();
  const { data } = await supabase
    .from("handovers")
    .select(
      "id,project,reason,status,created_at,is_seed,from:profiles!handovers_from_user_fkey(full_name),to:profiles!handovers_to_user_fkey(full_name),handover_tasks(transferred)",
    )
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as {
    id: string;
    project: string;
    reason: string | null;
    status: string;
    created_at: string;
    is_seed: boolean;
    from: { full_name: string };
    to: { full_name: string };
    handover_tasks: { transferred: boolean }[];
  }[];
  return (
    <>
      {" "}
      <PageHeader
        title="Handovers"
        description="Transfer ongoing work with full context. Nothing changes owner until the receiver accepts."
        actions={
          <Link href="/handovers/new" className="btn-primary">
            <Plus size={15} />
            Create handover
          </Link>
        }
      />{" "}
      {rows.length === 0 ? (
        <EmptyState
          title="No handovers yet"
          body="When someone goes on leave or changes projects, create a handover so their open work and its context move with it."
          action={
            <Link href="/handovers/new" className="btn-primary">
              Create handover
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <thead>
              <tr>
                <th className="th">Project</th>
                <th className="th">From → To</th>
                <th className="th">Tasks</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
              </tr>
            </thead>{" "}
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="hover:bg-sage-tint/40">
                  <td className="td">
                    <Link
                      href={`/handovers/${h.id}`}
                      className="font-medium hover:underline"
                    >
                      {h.project}
                    </Link>{" "}
                    {h.is_seed && <SeedChip />}
                    {h.reason && (
                      <p className="text-[12.5px] text-muted-strong">
                        {h.reason}
                      </p>
                    )}
                  </td>{" "}
                  <td className="td">
                    {h.from.full_name} → {h.to.full_name}
                  </td>
                  <td className="td">
                    {h.handover_tasks.filter((t) => t.transferred).length}/
                    {h.handover_tasks.length} transferred
                  </td>{" "}
                  <td className="td">
                    <span className={cn("chip capitalize", STYLE[h.status])}>
                      {h.status}
                    </span>
                  </td>
                  <td className="td text-muted-strong">
                    {fmtDate(h.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}{" "}
    </>
  );
}
