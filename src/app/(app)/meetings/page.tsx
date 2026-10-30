import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext } from "@/lib/context";
import { EmptyState, PageHeader, SeedChip } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Meetings" };
export default async function MeetingsPage() {
  const { supabase, team } = await getContext();
  const { data } = await supabase
    .from("meetings")
    .select(
      "id,title,scheduled_at,summary,is_seed,decisions(count),meeting_tasks(count),meeting_participants(count)",
    )
    .eq("team_id", team.id)
    .order("scheduled_at", { ascending: false });
  const meetings = (data ?? []) as unknown as {
    id: string;
    title: string;
    scheduled_at: string;
    summary: string | null;
    is_seed: boolean;
    decisions: { count: number }[];
    meeting_tasks: { count: number }[];
    meeting_participants: { count: number }[];
  }[];
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => new Date(m.scheduled_at).getTime() > now)
    .reverse();
  const past = meetings.filter(
    (m) => new Date(m.scheduled_at).getTime() <= now,
  );
  const Row = ({ m }: { m: (typeof meetings)[number] }) => (
    <Link
      href={`/meetings/${m.id}`}
      className="flex items-start gap-4 border-b border-line px-5 py-4 transition-colors last:border-0 hover:bg-sage-tint/40"
    >
      {" "}
      <div className="w-14 shrink-0 text-center">
        <p className="font-serif text-[24px] leading-none">
          {fmtDate(m.scheduled_at, { day: "numeric" })}
        </p>
        <p className="mt-1 text-[12px] text-muted-strong">
          {fmtDate(m.scheduled_at, { month: "short", year: "2-digit" })}
        </p>
      </div>{" "}
      <div className="min-w-0 flex-1">
        {" "}
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {m.title}
          {m.is_seed && <SeedChip />}
        </p>{" "}
        <p className="mt-0.5 line-clamp-2 text-[13.5px] text-muted-strong">
          {m.summary ?? "No summary yet."}
        </p>{" "}
      </div>{" "}
      <div className="hidden shrink-0 gap-5 text-[12.5px] text-muted-strong sm:flex">
        <span>{m.meeting_tasks[0]?.count ?? 0} tasks</span>
        <span>{m.decisions[0]?.count ?? 0} decisions</span>
        <span>{m.meeting_participants[0]?.count ?? 0} people</span>
      </div>{" "}
    </Link>
  );
  return (
    <>
      {" "}
      <PageHeader
        title="Meetings"
        description="Every discussion, with the decisions and tasks that came out of it."
        actions={
          <Link href="/meetings/new" className="btn-primary">
            <Plus size={15} />
            New meeting
          </Link>
        }
      />{" "}
      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          body="Record your first meeting. Paste raw notes and ContextFlow will draft the summary, decisions and action items for you to review."
          action={
            <Link href="/meetings/new" className="btn-primary">
              New meeting
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {" "}
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
                Upcoming
              </h2>
              <div className="card">
                {upcoming.map((m) => (
                  <Row key={m.id} m={m} />
                ))}
              </div>
            </section>
          )}{" "}
          <section>
            <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
              Previous
            </h2>
            <div className="card">
              {past.length ? (
                past.map((m) => <Row key={m.id} m={m} />)
              ) : (
                <p className="p-5 text-[13.5px] text-muted-strong">
                  No past meetings.
                </p>
              )}
            </div>
          </section>{" "}
        </div>
      )}{" "}
    </>
  );
}
