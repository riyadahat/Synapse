import Link from "next/link";
import {
  ArrowRightLeft,
  CalendarPlus,
  CheckCircle2,
  ListPlus,
  MessageCircleQuestion,
} from "lucide-react";
import { getContext } from "@/lib/context";
import { computeHealth } from "@/lib/health";
import { TASK_SELECT, type TaskRow } from "@/lib/types";
import {
  OverdueChip,
  Person,
  PriorityChip,
  SectionTitle,
  StatusChip,
  EmptyState,
} from "@/components/ui";
import { cn, fmtDate, isOverdue, timeAgo, todayISO } from "@/lib/utils";
export const metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const { supabase, user, profile, team } = await getContext();
  const nowISO = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [mine, done, upcoming, decisions, handovers, activity, health] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("team_id", team.id)
        .eq("assignee_id", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from("tasks")
        .select(
          "id,title,completed_at,completion_outcome,assignee:profiles!tasks_assignee_id_fkey(full_name)",
        )
        .eq("team_id", team.id)
        .eq("status", "completed")
        .gte("completed_at", weekAgo)
        .order("completed_at", { ascending: false })
        .limit(4),
      supabase
        .from("meetings")
        .select("id,title,scheduled_at")
        .eq("team_id", team.id)
        .gt("scheduled_at", nowISO)
        .order("scheduled_at")
        .limit(3),
      supabase
        .from("decisions")
        .select("id,text,created_at,meeting:meetings(id,title)")
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("handovers")
        .select(
          "id,project,status,from:profiles!handovers_from_user_fkey(full_name),to:profiles!handovers_to_user_fkey(full_name),created_at",
        )
        .eq("team_id", team.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("activity_logs")
        .select(
          "id,summary,created_at,actor:profiles!activity_logs_actor_id_fkey(full_name)",
        )
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })
        .limit(8),
      computeHealth(supabase, team.id),
    ]);
  const myTasks = (mine.data ?? []) as unknown as TaskRow[];
  const overdue = myTasks.filter((t) => isOverdue(t.due_date, t.status));
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = profile.full_name.split(" ")[0];
  const actions = [
    {
      href: "/meetings/new",
      label: "New meeting",
      hint: "Capture notes and decisions",
      icon: CalendarPlus,
    },
    {
      href: "/tasks?new=1",
      label: "Add task",
      hint: "Assign work with a deadline",
      icon: ListPlus,
    },
    {
      href: "/handovers/new",
      label: "Create handover",
      hint: "Pass work to a teammate",
      icon: ArrowRightLeft,
    },
    {
      href: "/ask",
      label: "Ask ContextFlow",
      hint: "Ask about past decisions",
      icon: MessageCircleQuestion,
    },
  ];
  return (
    <>
      {" "}
      <div className="mb-7">
        {" "}
        <h1 className="font-serif text-[34px] leading-tight">
          {greeting}, {first}.
        </h1>{" "}
        <p className="mt-1 text-[14.5px] text-muted-strong">
          {" "}
          {myTasks.length === 0 ? (
            "You have no open tasks."
          ) : (
            <>
              You have{" "}
              <b className="font-medium text-ink">
                {myTasks.length} open task{myTasks.length > 1 ? "s" : ""}
              </b>
              {overdue.length > 0 && (
                <>
                  ,{" "}
                  <b className="font-medium text-terracotta-ink">
                    {overdue.length} overdue
                  </b>
                </>
              )}
              .
            </>
          )}{" "}
          <Link
            href="/catch-up"
            className="font-medium text-sage-dark underline underline-offset-2"
          >
            Been away? Catch me up.
          </Link>{" "}
        </p>{" "}
      </div>{" "}
      <div
        className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        id="attention"
      >
        {" "}
        {actions.map(({ href, label, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="card group flex items-start gap-3 p-4 transition-colors hover:border-sage hover:bg-sage-tint/50"
          >
            {" "}
            <span className="rounded-md bg-sage-soft p-2 text-olive transition-colors group-hover:bg-sage group-hover:text-white">
              <Icon size={17} />
            </span>{" "}
            <span>
              <span className="block font-medium">{label}</span>
              <span className="text-[12.5px] text-muted-strong">{hint}</span>
            </span>{" "}
          </Link>
        ))}{" "}
      </div>{" "}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {" "}
        <div className="space-y-6">
          {" "}
          <section>
            {" "}
            <SectionTitle
              aside={
                <Link
                  href="/tasks"
                  className="text-[13px] text-sage-dark hover:underline"
                >
                  All tasks
                </Link>
              }
            >
              My open tasks
            </SectionTitle>{" "}
            {myTasks.length === 0 ? (
              <EmptyState
                title="You’re all clear"
                body="Nothing is assigned to you right now."
              />
            ) : (
              <div className="card divide-y divide-line">
                {myTasks.map((t) => (
                  <Link
                    key={t.id}
                    href="/tasks"
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-sage-tint/40"
                  >
                    {" "}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.title}</p>
                      {t.origin_meeting && (
                        <p className="text-[12.5px] text-muted-strong">
                          {t.origin_meeting.title}
                        </p>
                      )}
                    </div>{" "}
                    <span
                      className={cn(
                        "text-[13px]",
                        isOverdue(t.due_date, t.status)
                          ? "font-medium text-terracotta-ink"
                          : "text-muted-strong",
                      )}
                    >
                      {fmtDate(t.due_date)}
                    </span>{" "}
                    {isOverdue(t.due_date, t.status) && <OverdueChip />}
                    <PriorityChip priority={t.priority} />
                    <StatusChip status={t.status} />{" "}
                  </Link>
                ))}
              </div>
            )}{" "}
          </section>{" "}
          <section>
            {" "}
            <SectionTitle
              aside={
                <Link
                  href="/activity"
                  className="text-[13px] text-sage-dark hover:underline"
                >
                  Full history
                </Link>
              }
            >
              Team activity
            </SectionTitle>{" "}
            {(activity.data ?? []).length === 0 ? (
              <EmptyState
                title="No activity yet"
                body="Create a meeting or task and it will show up here."
              />
            ) : (
              <ol className="card divide-y divide-line">
                {(
                  activity.data as unknown as {
                    id: string;
                    summary: string;
                    created_at: string;
                    actor: { full_name: string } | null;
                  }[]
                ).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-[13.5px]"
                  >
                    <span>
                      <b className="font-medium">
                        {a.actor?.full_name ?? "Someone"}
                      </b>{" "}
                      <span className="text-muted-strong">{a.summary}</span>
                    </span>
                    <span className="meta shrink-0">
                      {timeAgo(a.created_at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}{" "}
          </section>{" "}
        </div>{" "}
        <div className="space-y-6">
          {" "}
          <Link
            href="/health"
            className="card block p-5 transition-colors hover:bg-sage-tint/40"
          >
            {" "}
            <p className="text-[13px] font-medium text-muted-strong">
              Context Health
            </p>{" "}
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-[44px] leading-none">
                {health.score ?? "—"}
              </span>
              <span className="text-[13px] text-muted-strong">
                / 100 · {health.band}
              </span>
            </p>{" "}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sage-soft">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${health.score ?? 0}%` }}
              />
            </div>{" "}
            {health.risks[0] && (
              <p className="mt-3 text-[12.5px] text-muted-strong">
                {health.risks[0].text}
              </p>
            )}{" "}
          </Link>{" "}
          <section>
            <SectionTitle>Upcoming meetings</SectionTitle>{" "}
            {(upcoming.data ?? []).length === 0 ? (
              <p className="card p-4 text-[13.5px] text-muted-strong">
                Nothing scheduled.{" "}
                <Link href="/meetings/new" className="text-sage-dark underline">
                  Plan a meeting
                </Link>
                .
              </p>
            ) : (
              <div className="card divide-y divide-line">
                {upcoming.data!.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="block px-4 py-3 hover:bg-sage-tint/40"
                  >
                    <p className="font-medium">{m.title}</p>
                    <p className="meta mt-0.5">
                      {fmtDate(m.scheduled_at, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            )}{" "}
          </section>{" "}
          <section>
            <SectionTitle>Pending handovers</SectionTitle>{" "}
            {(handovers.data ?? []).length === 0 ? (
              <p className="card p-4 text-[13.5px] text-muted-strong">
                No handovers waiting.
              </p>
            ) : (
              <div className="card divide-y divide-line">
                {(
                  handovers.data as unknown as {
                    id: string;
                    project: string;
                    from: { full_name: string };
                    to: { full_name: string };
                    created_at: string;
                  }[]
                ).map((h) => (
                  <Link
                    key={h.id}
                    href={`/handovers/${h.id}`}
                    className="block px-4 py-3 hover:bg-sage-tint/40"
                  >
                    <p className="font-medium">{h.project}</p>
                    <p className="text-[12.5px] text-muted-strong">
                      {h.from.full_name} → {h.to.full_name} ·{" "}
                      {timeAgo(h.created_at)}
                    </p>
                  </Link>
                ))}
              </div>
            )}{" "}
          </section>{" "}
          <section>
            <SectionTitle>Recent decisions</SectionTitle>{" "}
            {(decisions.data ?? []).length === 0 ? (
              <p className="card p-4 text-[13.5px] text-muted-strong">
                No decisions recorded yet.
              </p>
            ) : (
              <div className="card divide-y divide-line">
                {(
                  decisions.data as unknown as {
                    id: string;
                    text: string;
                    meeting: { id: string; title: string } | null;
                  }[]
                ).map((d) => (
                  <Link
                    key={d.id}
                    href={d.meeting ? `/meetings/${d.meeting.id}` : "/meetings"}
                    className="block px-4 py-3 hover:bg-sage-tint/40"
                  >
                    <p className="text-[13.5px]">{d.text}</p>
                    <p className="meta mt-0.5">{d.meeting?.title}</p>
                  </Link>
                ))}
              </div>
            )}{" "}
          </section>{" "}
          {(done.data ?? []).length > 0 && (
            <section>
              <SectionTitle>Recently completed</SectionTitle>{" "}
              <div className="card divide-y divide-line">
                {(
                  done.data as unknown as {
                    id: string;
                    title: string;
                    completed_at: string;
                    assignee: { full_name: string } | null;
                  }[]
                ).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-2.5 px-4 py-3"
                  >
                    <CheckCircle2
                      size={15}
                      className="mt-0.5 shrink-0 text-sage"
                    />
                    <div>
                      <p className="text-[13.5px]">{t.title}</p>
                      <p className="meta mt-0.5">
                        {t.assignee?.full_name ?? "Unassigned"} ·{" "}
                        {timeAgo(t.completed_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}{" "}
        </div>{" "}
      </div>{" "}
    </>
  );
}
