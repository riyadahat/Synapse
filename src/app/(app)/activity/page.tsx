import { getContext } from "@/lib/context";
import { EmptyState, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
export const metadata = { title: "Activity" };
export default async function ActivityPage() {
  const { supabase, team } = await getContext();
  const { data } = await supabase
    .from("activity_logs")
    .select(
      "id,action,summary,created_at,actor:profiles!activity_logs_actor_id_fkey(full_name)",
    )
    .eq("team_id", team.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as {
    id: string;
    action: string;
    summary: string;
    created_at: string;
    actor: { full_name: string } | null;
  }[];
  const groups = rows.reduce<Record<string, typeof rows>>((g, r) => {
    const k = r.created_at.slice(0, 10);
    (g[k] ??= []).push(r);
    return g;
  }, {});
  return (
    <>
      {" "}
      <PageHeader
        title="Activity"
        description="A chronological audit trail of meetings, tasks and handovers."
      />{" "}
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing has happened yet"
          body="Actions like creating meetings, reassigning tasks and acknowledging handovers are recorded here."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
                {fmtDate(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>{" "}
              <ol className="card divide-y divide-line">
                {items.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-baseline justify-between gap-4 px-5 py-3 text-[14px]"
                  >
                    <span>
                      <b className="font-medium">
                        {a.actor?.full_name ?? "System"}
                      </b>{" "}
                      <span className="text-muted-strong">{a.summary}</span>
                    </span>
                    <span className="meta shrink-0" title={a.action}>
                      {fmtDateTime(a.created_at).split(", ").pop()}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}{" "}
    </>
  );
}
