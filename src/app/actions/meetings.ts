"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { addTaskHistory, recordActivity } from "@/lib/activity";
import { AiError, generateStructured } from "@/lib/ai";
import { MEETING_SYSTEM } from "@/lib/prompts";
import {
  confirmedMeetingSchema,
  meetingExtractionSchema,
  type MeetingExtraction,
} from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";

export interface ExtractionResult {
  extraction: MeetingExtraction;
  ownerMatches: (string | null)[];
  latencyMs: number;
}

export async function extractFromNotes(input: {
  title: string;
  scheduledAt: string;
  agenda?: string;
  notes: string;
}): Promise<ActionResult<ExtractionResult> & { aiUnavailable?: boolean }> {
  const log = await getLogger({ action: "meeting.extract" });

  const parsed = z
    .object({
      title: z.string().max(160),
      scheduledAt: z.string(),
      agenda: z.string().max(4000).optional(),
      notes: z
        .string()
        .trim()
        .min(
          20,
          "Add a few more lines of notes so there's something to analyse.",
        )
        .max(30000, "Notes are too long. Split them across meetings."),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { members } = await getContext();
  const d = new Date(parsed.data.scheduledAt);

  const dateStr = `${d.toISOString().slice(0, 10)} (${d.toLocaleDateString(
    "en-US",
    { weekday: "long" },
  )})`;

  const started = Date.now();

  try {
    const extraction = await generateStructured({
      operation: "meeting.extract",
      log,
      schema: meetingExtractionSchema,
      system: MEETING_SYSTEM,
      maxTokens: 4096,
      user: `Meeting title: ${parsed.data.title}
Meeting date: ${dateStr}
Team members (use ONLY to recognise names that appear in the notes): ${members
        .map((m) => m.full_name)
        .join(", ")}
Agenda: ${parsed.data.agenda || "(none)"}

<notes>
${parsed.data.notes}
</notes>`,
    });

    const ownerMatches = extraction.actionItems.map((a) => {
      if (!a.owner) return null;

      const n = a.owner.trim().toLowerCase();

      return (
        members.find(
          (m) =>
            m.full_name.toLowerCase() === n ||
            m.full_name.split(" ")[0].toLowerCase() === n,
        )?.id ?? null
      );
    });

    return {
      ok: true,
      data: {
        extraction,
        ownerMatches,
        latencyMs: Date.now() - started,
      },
    };
  } catch (e) {
    const err = e as AiError;

    return {
      ok: false,
      error:
        err.userMessage ??
        "AI analysis failed. You can still save the meeting manually.",
      aiUnavailable: true,
    };
  }
}

const createSchema = z.object({
  title: z.string().trim().min(2, "Give the meeting a title").max(160),
  scheduledAt: z.string().min(1),
  agenda: z.string().max(4000).nullable(),
  notes: z.string().max(30000).nullable(),
  participantIds: z.array(z.string().uuid()),
  attendedIds: z.array(z.string().uuid()),
  carryForwardTaskIds: z.array(z.string().uuid()),
  confirmed: confirmedMeetingSchema.nullable(),
});

export type CreateMeetingInput = z.input<typeof createSchema>;

export async function createMeeting(
  raw: CreateMeetingInput,
): Promise<ActionResult<{ id: string }>> {
  const log = await getLogger({ action: "meeting.create" });

  const parsed = createSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const m = parsed.data;
  const { supabase, user, team, members } = await getContext();

  const valid = new Set(members.map((x) => x.id));

  const confirmedAssigneeIds =
    m.confirmed?.tasks
      .map((task) => task.assigneeId)
      .filter((id): id is string => Boolean(id)) ?? [];

  const allSelectedIds = [...m.participantIds, ...confirmedAssigneeIds];

  if (allSelectedIds.some((id) => !valid.has(id))) {
    return {
      ok: false,
      error: "One of the selected people isn't in this workspace.",
    };
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      team_id: team.id,
      title: m.title,
      scheduled_at: new Date(m.scheduledAt).toISOString(),
      agenda: m.agenda || null,
      notes: m.notes || null,
      created_by: user.id,
      summary: m.confirmed?.summary || null,
      discussion_points: m.confirmed?.discussionPoints ?? [],
      unresolved_questions: m.confirmed?.unresolvedQuestions ?? [],
    })
    .select("id")
    .single();

  if (error || !meeting) {
    log.error({
      event: "meeting.create_failed",
      errorMessage: error?.message,
    });

    return {
      ok: false,
      error:
        "Couldn't save the meeting. Your notes are still on screen. Try again.",
    };
  }

  if (m.participantIds.length) {
    await supabase.from("meeting_participants").insert(
      m.participantIds.map((id) => ({
        meeting_id: meeting.id,
        user_id: id,
        attended: m.attendedIds.includes(id) ? true : null,
      })),
    );
  }

  let taskCount = 0;
  let decisionCount = 0;

  if (m.confirmed) {
    if (m.confirmed.decisions.length) {
      const { error: dErr } = await supabase.from("decisions").insert(
        m.confirmed.decisions.map((d) => ({
          team_id: team.id,
          meeting_id: meeting.id,
          text: d.text,
          rationale: d.rationale,
          source: d.source,
          created_by: user.id,
        })),
      );

      if (dErr) {
        log.error({
          event: "decision.create_failed",
          errorMessage: dErr.message,
        });
      } else {
        decisionCount = m.confirmed.decisions.length;
      }
    }

    for (const t of m.confirmed.tasks) {
      const { data: task, error: tErr } = await supabase
        .from("tasks")
        .insert({
          team_id: team.id,
          title: t.title,
          description: t.description,
          assignee_id: t.assigneeId,
          due_date: t.dueDate,
          priority: t.priority,
          owner_uncertain: t.ownerUncertain,
          origin_meeting_id: meeting.id,
          source: "ai_extracted",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (tErr || !task) {
        log.error({
          event: "task.create_failed",
          errorMessage: tErr?.message,
        });
        continue;
      }

      await supabase.from("meeting_tasks").insert({
        meeting_id: meeting.id,
        task_id: task.id,
        relation: "originated",
        created_by: user.id,
      });

      await addTaskHistory(supabase, log, {
        taskId: task.id,
        actorId: user.id,
        action: "created",
        meetingId: meeting.id,
        note: "Extracted from meeting notes and confirmed by a person",
      });

      await recordActivity(supabase, log, {
        teamId: team.id,
        actorId: user.id,
        action: "task.created",
        entityType: "task",
        entityId: task.id,
        summary: `created task “${t.title}” from ${m.title}`,
        metadata: {
          source: "ai_extracted",
          meetingId: meeting.id,
        },
      });

      taskCount++;
    }
  }

  const carried = await carryForward(meeting.id, m.carryForwardTaskIds, true);

  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "meeting.created",
    entityType: "meeting",
    entityId: meeting.id,
    summary: `created meeting “${m.title}”`,
    metadata: {
      participants: m.participantIds.length,
      tasks: taskCount,
      decisions: decisionCount,
      carriedForward: carried,
      aiAssisted: Boolean(m.confirmed),
    },
  });

  revalidatePath("/", "layout");

  return {
    ok: true,
    data: { id: meeting.id },
  };
}

/**
 * Links existing tasks to a meeting.
 * Same task ID, same history — a row in meeting_tasks, never a copy.
 */
export async function carryForward(
  meetingId: string,
  taskIds: string[],
  quiet = false,
): Promise<number> {
  if (!taskIds.length) return 0;

  const log = await getLogger({
    action: "task.carry_forward",
    meetingId,
  });

  const { supabase, user, team } = await getContext();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("title")
    .eq("id", meetingId)
    .eq("team_id", team.id)
    .single();

  if (!meeting) return 0;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id,title")
    .in("id", taskIds)
    .eq("team_id", team.id);

  let n = 0;

  for (const t of tasks ?? []) {
    const { error } = await supabase.from("meeting_tasks").insert({
      meeting_id: meetingId,
      task_id: t.id,
      relation: "carried_forward",
      created_by: user.id,
    });

    if (error) {
      if (error.code !== "23505") {
        log.error({
          event: "task.carry_forward_failed",
          taskId: t.id,
          errorMessage: error.message,
        });
      }

      continue;
    }

    await addTaskHistory(supabase, log, {
      taskId: t.id,
      actorId: user.id,
      action: "carried_forward",
      meetingId,
      note: `Carried forward into ${meeting.title}`,
    });

    await recordActivity(supabase, log, {
      teamId: team.id,
      actorId: user.id,
      action: "task.carried_forward",
      entityType: "task",
      entityId: t.id,
      summary: `carried forward “${t.title}” into ${meeting.title}`,
      metadata: { meetingId },
    });

    n++;
  }

  if (!quiet) {
    revalidatePath("/", "layout");
  }

  return n;
}

export async function carryForwardAction(
  meetingId: string,
  taskIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const count = await carryForward(meetingId, taskIds);

  return {
    ok: true,
    data: { count },
  };
}

const updateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  scheduledAt: z.string(),
  agenda: z.string().max(4000).nullable(),
  notes: z.string().max(30000).nullable(),
  summary: z.string().max(4000).nullable(),
});

export async function updateMeeting(
  id: string,
  raw: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  const log = await getLogger({
    action: "meeting.update",
    meetingId: id,
  });

  const p = updateSchema.safeParse(raw);

  if (!p.success) {
    return { ok: false, error: p.error.issues[0].message };
  }

  const { supabase, user, team } = await getContext();

  const { error } = await supabase
    .from("meetings")
    .update({
      title: p.data.title,
      scheduled_at: new Date(p.data.scheduledAt).toISOString(),
      agenda: p.data.agenda,
      notes: p.data.notes,
      summary: p.data.summary,
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    return { ok: false, error: "Couldn't save changes." };
  }

  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "meeting.updated",
    entityType: "meeting",
    entityId: id,
    summary: `edited meeting “${p.data.title}”`,
  });

  revalidatePath("/", "layout");

  return { ok: true };
}

export async function setAttendance(
  meetingId: string,
  userId: string,
  attended: boolean | null,
): Promise<ActionResult> {
  const { supabase, team } = await getContext();

  const { data: m } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("team_id", team.id)
    .single();

  if (!m) {
    return { ok: false, error: "Meeting not found." };
  }

  const { error } = await supabase.from("meeting_participants").upsert(
    {
      meeting_id: meetingId,
      user_id: userId,
      attended,
    },
    { onConflict: "meeting_id,user_id" },
  );

  if (error) {
    return { ok: false, error: "Couldn't update attendance." };
  }

  revalidatePath(`/meetings/${meetingId}`);

  return { ok: true };
}

export async function addDecision(
  meetingId: string,
  text: string,
  rationale: string | null,
): Promise<ActionResult> {
  const log = await getLogger({
    action: "decision.create",
    meetingId,
  });

  const t = text.trim();

  if (t.length < 3) {
    return {
      ok: false,
      error: "Describe the decision in a few words.",
    };
  }

  const { supabase, user, team } = await getContext();

  const { data, error } = await supabase
    .from("decisions")
    .insert({
      team_id: team.id,
      meeting_id: meetingId,
      text: t,
      rationale: rationale?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Couldn't save the decision." };
  }

  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "decision.recorded",
    entityType: "decision",
    entityId: data.id,
    summary: `recorded decision “${t.slice(0, 80)}”`,
    metadata: { meetingId },
  });

  revalidatePath("/", "layout");

  return { ok: true };
}

export async function deleteDecision(id: string): Promise<ActionResult> {
  const { supabase, team } = await getContext();

  const { error } = await supabase
    .from("decisions")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    return { ok: false, error: "Couldn't delete the decision." };
  }

  revalidatePath("/", "layout");

  return { ok: true };
}
