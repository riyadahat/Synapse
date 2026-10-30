"use server";

import { z } from "zod";

import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { AiError, generateStructured } from "@/lib/ai";
import { CATCHUP_SYSTEM } from "@/lib/prompts";
import { catchUpSchema, type CatchUpBrief } from "@/lib/schemas";
import { SourceRegistry, type Source } from "@/lib/sources";
import { findRelatedDocuments } from "@/lib/queries";
import { fmtDate, todayISO } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

export interface BriefItem {
  text: string;
  sources: Source[];
}

export interface CatchUpResult {
  employee: string;
  from: string;
  to: string;
  generatedBy: "ai" | "records";
  aiNote?: string;
  latencyMs: number | null;
  headline: string;
  sections: {
    key: keyof Omit<CatchUpBrief, "headline">;
    title: string;
    items: BriefItem[];
  }[];
  stats: {
    meetings: number;
    decisions: number;
    openTasks: number;
    overdue: number;
    blocked: number;
    dueSoon: number;
    missedMeetings: number;
  };
  sources: Source[];
}

const TITLES: Record<keyof Omit<CatchUpBrief, "headline">, string> = {
  whatHappened: "What happened while you were away",
  decisions: "Decisions that were made",
  affectsYou: "What affects your responsibilities",
  needsAttention: "Tasks that need your attention",
  deadlines: "Deadlines approaching",
  blocked: "What is blocked",
  readNext: "What to read next",
};

const input = z.object({
  employeeId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function generateCatchUp(
  raw: z.input<typeof input>,
): Promise<ActionResult<CatchUpResult>> {
  const log = await getLogger({
    action: "catchup.generate",
  });

  const parsed = input.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Choose an employee and a valid date range.",
    };
  }

  const { employeeId, from, to } = parsed.data;

  if (from > to) {
    return {
      ok: false,
      error: "The start date must be before the end date.",
    };
  }

  const { supabase, team, members, user } = await getContext();

  const employee = members.find((member) => member.id === employeeId);

  if (!employee) {
    return {
      ok: false,
      error: "That person isn't in this workspace.",
    };
  }

  const fromTimestamp = `${from}T00:00:00.000Z`;

  const toTimestamp = new Date(
    new Date(`${to}T00:00:00Z`).getTime() + 864e5,
  ).toISOString();

  const today = todayISO();

  const soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

  const registry = new SourceRegistry();

  // Retrieve meetings, open tasks and completed tasks.
  const [meetingsQuery, openTasksQuery, completedTasksQuery] =
    await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id,title,scheduled_at,summary,notes,discussion_points,unresolved_questions,meeting_participants(user_id,attended),decisions(id,text,rationale)",
        )
        .eq("team_id", team.id)
        .gte("scheduled_at", fromTimestamp)
        .lt("scheduled_at", toTimestamp)
        .order("scheduled_at"),

      supabase
        .from("tasks")
        .select(
          "id,title,status,priority,due_date,description,origin:meetings!tasks_origin_meeting_id_fkey(id,title)",
        )
        .eq("team_id", team.id)
        .eq("assignee_id", employee.id)
        .neq("status", "completed"),

      supabase
        .from("tasks")
        .select("id,title,completed_at,completion_outcome")
        .eq("team_id", team.id)
        .eq("assignee_id", employee.id)
        .eq("status", "completed")
        .gte("completed_at", fromTimestamp)
        .lt("completed_at", toTimestamp),
    ]);

  if (
    meetingsQuery.error ||
    openTasksQuery.error ||
    completedTasksQuery.error
  ) {
    log.error({
      event: "catchup.retrieval_failed",
      requesterId: user.id,
    });

    return {
      ok: false,
      error: "Couldn't retrieve the records for this catch-up.",
    };
  }

  const meetings = (meetingsQuery.data ?? []) as unknown as {
    id: string;
    title: string;
    scheduled_at: string;
    summary: string | null;
    notes: string | null;
    discussion_points: string[];
    unresolved_questions: string[];
    meeting_participants: {
      user_id: string;
      attended: boolean | null;
    }[];
    decisions: {
      id: string;
      text: string;
      rationale: string | null;
    }[];
  }[];

  const openTasks = (openTasksQuery.data ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    description: string | null;
    origin: {
      id: string;
      title: string;
    } | null;
  }[];

  const completedTasks = completedTasksQuery.data ?? [];

  // Retrieve task history changes made by other team members.
  const taskIds = openTasks.map((task) => task.id);

  let history: {
    task_id: string;
    action: string;
    old_value: string | null;
    new_value: string | null;
    note: string | null;
    created_at: string;
    actor: {
      full_name: string;
    } | null;
  }[] = [];

  if (taskIds.length > 0) {
    const { data: historyData } = await supabase
      .from("task_history")
      .select(
        "task_id,action,old_value,new_value,note,created_at,actor:profiles!task_history_actor_id_fkey(full_name)",
      )
      .in("task_id", taskIds)
      .gte("created_at", fromTimestamp)
      .lt("created_at", toTimestamp)
      .neq("actor_id", employee.id)
      .order("created_at");

    history = (historyData ?? []) as unknown as typeof history;
  }

  // Retrieve documents created during the selected period.
  const { data: documentsData } = await supabase
    .from("documents")
    .select("id,title,created_at")
    .eq("team_id", team.id)
    .gte("created_at", fromTimestamp)
    .lt("created_at", toTimestamp)
    .limit(8);

  // Find documents related to the employee's open tasks.
  const relatedDocuments = await findRelatedDocuments(
    supabase,
    team.id,
    openTasks.map((task) => task.title).join(" "),
    { limit: 4 },
  );

  const overdue = openTasks.filter(
    (task) => task.due_date && task.due_date < today,
  );

  const blocked = openTasks.filter((task) => task.status === "blocked");

  const dueSoon = openTasks.filter(
    (task) => task.due_date && task.due_date >= today && task.due_date <= soon,
  );

  const missedMeetings = meetings.filter((meeting) =>
    meeting.meeting_participants.some(
      (participant) =>
        participant.user_id === employee.id && participant.attended === false,
    ),
  );

  const decisionCount = meetings.reduce(
    (total, meeting) => total + meeting.decisions.length,
    0,
  );

  const stats = {
    meetings: meetings.length,
    decisions: decisionCount,
    openTasks: openTasks.length,
    overdue: overdue.length,
    blocked: blocked.length,
    dueSoon: dueSoon.length,
    missedMeetings: missedMeetings.length,
  };

  // Build a grounded context for the AI.
  const lines: string[] = [
    `Employee: ${employee.full_name}${
      employee.role_title ? ` (${employee.role_title})` : ""
    }`,
    `Period away: ${from} to ${to}`,
    `Today: ${today}`,
    "",
    "MEETINGS IN PERIOD:",
  ];

  for (const meeting of meetings) {
    const alias = registry.add(
      "meeting",
      meeting.id,
      meeting.title,
      `/meetings/${meeting.id}`,
    );

    const participant = meeting.meeting_participants.find(
      (item) => item.user_id === employee.id,
    );

    const attendance = participant
      ? participant.attended === false
        ? "was ABSENT"
        : participant.attended
          ? "attended"
          : "was invited"
      : "not listed as participant";

    lines.push(
      `[${alias}] ${meeting.title} (${fmtDate(
        meeting.scheduled_at,
      )}) — employee ${attendance}`,
    );

    lines.push(
      `Summary: ${
        meeting.summary ?? meeting.notes?.slice(0, 500) ?? "none recorded"
      }`,
    );

    if (meeting.unresolved_questions?.length) {
      lines.push(
        `Unresolved questions: ${meeting.unresolved_questions.join("; ")}`,
      );
    }

    for (const decision of meeting.decisions) {
      const decisionAlias = registry.add(
        "decision",
        decision.id,
        decision.text.slice(0, 60),
        `/meetings/${meeting.id}`,
      );

      lines.push(
        `Decision [${decisionAlias}]: ${decision.text}${
          decision.rationale ? ` (why: ${decision.rationale})` : ""
        }`,
      );
    }
  }

  lines.push("", `OPEN TASKS ASSIGNED TO ${employee.full_name.toUpperCase()}:`);

  for (const task of openTasks) {
    const alias = registry.add("task", task.id, task.title, "/tasks?owner=all");

    lines.push(
      `[${alias}] ${task.title} — status ${
        task.status
      }, priority ${task.priority}, due ${task.due_date ?? "no deadline"}${
        task.due_date && task.due_date < today ? " (OVERDUE)" : ""
      }${task.origin ? `, from "${task.origin.title}"` : ""}${
        task.description ? ` — ${task.description.slice(0, 200)}` : ""
      }`,
    );
  }

  if (history.length > 0) {
    lines.push("", "CHANGES TO THEIR TASKS MADE BY OTHERS WHILE AWAY:");

    for (const item of history) {
      const task = openTasks.find((candidate) => candidate.id === item.task_id);

      if (!task) continue;

      const alias = registry.add(
        "task",
        task.id,
        task.title,
        "/tasks?owner=all",
      );

      lines.push(
        `[${alias}] ${
          item.actor?.full_name ?? "Someone"
        } ${item.action.replace("_", " ")}${
          item.old_value || item.new_value
            ? `: ${item.old_value ?? "—"} → ${item.new_value ?? "—"}`
            : ""
        } on ${fmtDate(item.created_at)}`,
      );
    }
  }

  if (completedTasks.length > 0) {
    lines.push("", "TASKS COMPLETED IN PERIOD:");

    for (const task of completedTasks) {
      const alias = registry.add(
        "task",
        task.id,
        task.title,
        "/tasks?owner=all",
      );

      lines.push(
        `[${alias}] ${task.title}${
          task.completion_outcome
            ? ` — outcome: ${task.completion_outcome}`
            : ""
        }`,
      );
    }
  }

  const documents = [
    ...(documentsData ?? []).map((document) => ({
      id: document.id,
      title: document.title,
    })),
    ...relatedDocuments.map((document) => ({
      id: document.id,
      title: document.title,
    })),
  ];

  if (documents.length > 0) {
    lines.push("", "DOCUMENTS (new in period or related to their tasks):");

    for (const document of documents) {
      const alias = registry.add(
        "document",
        document.id,
        document.title,
        `/knowledge/${document.id}`,
      );

      lines.push(`[${alias}] ${document.title}`);
    }
  }

  const base = {
    employee: employee.full_name,
    from,
    to,
    stats,
  };

  // No records means there is nothing to summarize.
  if (
    meetings.length === 0 &&
    openTasks.length === 0 &&
    completedTasks.length === 0
  ) {
    log.info({
      event: "catchup.generated",
      generatedBy: "records",
      empty: true,
      requesterId: user.id,
    });

    return {
      ok: true,
      data: {
        ...base,
        generatedBy: "records",
        latencyMs: null,
        headline: `No recorded meetings or open tasks for ${employee.full_name} in this period.`,
        sections: [],
        sources: [],
      },
    };
  }

  const toItems = (
    items: {
      text: string;
      refs: string[];
    }[],
  ): BriefItem[] =>
    items.map((item) => ({
      text: item.text,
      sources: registry.resolve(item.refs),
    }));

  const started = Date.now();

  try {
    const brief = await generateStructured({
      operation: "catchup.generate",
      log,
      schema: catchUpSchema,
      system: CATCHUP_SYSTEM,
      user: lines.join("\n"),
      maxTokens: 3500,
    });

    const sections = (Object.keys(TITLES) as (keyof typeof TITLES)[]).map(
      (key) => ({
        key,
        title: TITLES[key],
        items: toItems(brief[key]),
      }),
    );

    const usedSources = new Map<string, Source>();

    sections.forEach((section) => {
      section.items.forEach((item) => {
        item.sources.forEach((source) => {
          usedSources.set(source.alias, source);
        });
      });
    });

    log.info({
      event: "catchup.generated",
      generatedBy: "ai",
      meetings: meetings.length,
      tasks: openTasks.length,
      requesterId: user.id,
      employeeId: employee.id,
    });

    return {
      ok: true,
      data: {
        ...base,
        generatedBy: "ai",
        latencyMs: Date.now() - started,
        headline: brief.headline,
        sections,
        sources: [...usedSources.values()],
      },
    };
  } catch (error) {
    // Records-based fallback if AI generation fails.
    const aiError =
      error instanceof AiError
        ? error
        : new AiError(
            "unknown",
            "AI generation failed. Showing available records instead.",
            error,
          );

    const createItem = (text: string, aliases: string[]): BriefItem => ({
      text,
      sources: registry.resolve(aliases),
    });

    const taskAlias = (taskId: string) => {
      const task = openTasks.find((item) => item.id === taskId);

      return registry.add(
        "task",
        taskId,
        task?.title ?? "Task",
        "/tasks?owner=all",
      );
    };

    const sections: CatchUpResult["sections"] = [
      {
        key: "whatHappened",
        title: TITLES.whatHappened,
        items: meetings.map((meeting) =>
          createItem(
            `${meeting.title}: ${
              meeting.summary ?? meeting.notes ?? "No summary recorded"
            }`,
            [
              registry.add(
                "meeting",
                meeting.id,
                meeting.title,
                `/meetings/${meeting.id}`,
              ),
            ],
          ),
        ),
      },
      {
        key: "decisions",
        title: TITLES.decisions,
        items: meetings.flatMap((meeting) =>
          meeting.decisions.map((decision) =>
            createItem(decision.text, [
              registry.add(
                "decision",
                decision.id,
                decision.text,
                `/meetings/${meeting.id}`,
              ),
            ]),
          ),
        ),
      },
      {
        key: "affectsYou",
        title: TITLES.affectsYou,
        items: history.map((item) => {
          const task = openTasks.find(
            (candidate) => candidate.id === item.task_id,
          );

          return createItem(
            `${item.actor?.full_name ?? "Someone"} ${item.action.replace(
              "_",
              " ",
            )} "${task?.title ?? "a task"}"`,
            [taskAlias(item.task_id)],
          );
        }),
      },
      {
        key: "needsAttention",
        title: TITLES.needsAttention,
        items: [
          ...overdue,
          ...openTasks.filter(
            (task) => !overdue.includes(task) && task.status !== "blocked",
          ),
        ]
          .slice(0, 8)
          .map((task) =>
            createItem(
              `${task.title} (${task.status.replace("_", " ")}${
                task.due_date ? `, due ${fmtDate(task.due_date)}` : ""
              })`,
              [taskAlias(task.id)],
            ),
          ),
      },
      {
        key: "deadlines",
        title: TITLES.deadlines,
        items: dueSoon.map((task) =>
          createItem(`${task.title} is due ${fmtDate(task.due_date!)}`, [
            taskAlias(task.id),
          ]),
        ),
      },
      {
        key: "blocked",
        title: TITLES.blocked,
        items: blocked.map((task) =>
          createItem(task.title, [taskAlias(task.id)]),
        ),
      },
      {
        key: "readNext",
        title: TITLES.readNext,
        items: documents.map((document) =>
          createItem(document.title, [
            registry.add(
              "document",
              document.id,
              document.title,
              `/knowledge/${document.id}`,
            ),
          ]),
        ),
      },
    ];

    const usedSources = new Map<string, Source>();

    sections.forEach((section) => {
      section.items.forEach((item) => {
        item.sources.forEach((source) => {
          usedSources.set(source.alias, source);
        });
      });
    });

    log.warn({
      event: "catchup.generated",
      generatedBy: "records",
      fallback: true,
      errorCategory: aiError.category,
    });

    return {
      ok: true,
      data: {
        ...base,
        generatedBy: "records",
        aiNote: aiError.userMessage,
        latencyMs: null,
        headline: `${employee.full_name}: ${openTasks.length} open tasks, ${overdue.length} overdue, ${blocked.length} blocked.`,
        sections,
        sources: [...usedSources.values()],
      },
    };
  }
}
