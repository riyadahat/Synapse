import Link from "next/link";
import { getContext } from "@/lib/context";
import { findRelatedDocuments } from "@/lib/queries";
import { EmptyState, PageHeader, StatusChip } from "@/components/ui";
export const metadata = { title: "Search" };
const esc = (s: string) => s.replace(/[%_,()\\]/g, " ").trim();
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = esc((await searchParams).q ?? "");
  const { supabase, team } = await getContext();
  let meetings: { id: string; title: string; summary: string | null }[] = [],
    tasks: { id: string; title: string; status: string }[] = [],
    decisions: { id: string; text: string; meeting_id: string | null }[] = [];
  let docs: Awaited<ReturnType<typeof findRelatedDocuments>> = [];
  if (q.length >= 2) {
    const like = `%${q}%`;
    const [m, t, d] = await Promise.all([
      supabase
        .from("meetings")
        .select("id,title,summary")
        .eq("team_id", team.id)
        .or(`title.ilike.${like},summary.ilike.${like},notes.ilike.${like}`)
        .limit(8),
      supabase
        .from("tasks")
        .select("id,title,status")
        .eq("team_id", team.id)
        .or(`title.ilike.${like},description.ilike.${like}`)
        .limit(8),
      supabase
        .from("decisions")
        .select("id,text,meeting_id")
        .eq("team_id", team.id)
        .or(`text.ilike.${like},rationale.ilike.${like}`)
        .limit(8),
    ]);
    meetings = m.data ?? [];
    tasks = t.data ?? [];
    decisions = d.data ?? [];
    docs = await findRelatedDocuments(supabase, team.id, q, { limit: 8 });
  }
  const none =
    !meetings.length && !tasks.length && !decisions.length && !docs.length;
  return (
    <>
      {" "}
      <PageHeader title={q ? `Results for “${q}”` : "Search"} />{" "}
      <form className="mb-6 max-w-xl">
        <input
          name="q"
          defaultValue={q}
          className="input"
          placeholder="Search meetings, decisions, tasks and documents"
          autoFocus
          aria-label="Search"
        />
      </form>{" "}
      {q.length < 2 ? (
        <EmptyState
          title="Search everything"
          body="Type at least two characters."
        />
      ) : none ? (
        <EmptyState
          title="Nothing found"
          body="Try different words, or ask ContextFlow a question instead."
          action={
            <Link href="/ask" className="btn-secondary">
              Ask ContextFlow
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {" "}
          {meetings.length > 0 && (
            <section>
              <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
                Meetings
              </h2>
              <div className="card divide-y divide-line">
                {meetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="block px-5 py-3 hover:bg-sage-tint/40"
                  >
                    <p className="font-medium">{m.title}</p>
                    <p className="line-clamp-1 text-[13px] text-muted-strong">
                      {m.summary}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}{" "}
          {decisions.length > 0 && (
            <section>
              <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
                Decisions
              </h2>
              <div className="card divide-y divide-line">
                {decisions.map((d) => (
                  <Link
                    key={d.id}
                    href={
                      d.meeting_id ? `/meetings/${d.meeting_id}` : "/meetings"
                    }
                    className="block px-5 py-3 text-[14px] hover:bg-sage-tint/40"
                  >
                    {d.text}
                  </Link>
                ))}
              </div>
            </section>
          )}{" "}
          {tasks.length > 0 && (
            <section>
              <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
                Tasks
              </h2>
              <div className="card divide-y divide-line">
                {tasks.map((t) => (
                  <Link
                    key={t.id}
                    href="/tasks?owner=all"
                    className="flex items-center justify-between px-5 py-3 hover:bg-sage-tint/40"
                  >
                    <span className="font-medium">{t.title}</span>
                    <StatusChip status={t.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}{" "}
          {docs.length > 0 && (
            <section>
              <h2 className="mb-2 text-[13px] font-medium text-muted-strong">
                Documents
              </h2>
              <div className="card divide-y divide-line">
                {docs.map((d) => (
                  <Link
                    key={d.id}
                    href={`/knowledge/${d.id}`}
                    className="block px-5 py-3 hover:bg-sage-tint/40"
                  >
                    <p className="font-medium">{d.title}</p>
                    <p className="text-[13px] text-muted-strong">{d.snippet}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}{" "}
        </div>
      )}{" "}
    </>
  );
}
