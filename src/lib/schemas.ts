import { z } from "zod";

export const priorityEnum = z.enum(["low", "medium", "high"]);

export const statusEnum = z.enum([
  "todo",
  "in_progress",
  "blocked",
  "completed",
]);

const sourceRefItemSchema = z.object({
  text: z.string(),
  refs: z.array(z.string()),
});

export const meetingExtractionSchema = z.object({
  summary: z.string(),
  discussionPoints: z.array(z.string()),
  decisions: z.array(
    z.object({
      text: z.string(),
      rationale: z.string().nullable().default(null),
      basis: z.enum(["explicit", "inferred"]).default("explicit"),
    }),
  ),
  actionItems: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullable().default(null),
      owner: z.string().nullable().default(null),
      ownerBasis: z.enum(["explicit", "inferred", "none"]).default("none"),
      deadlineDate: z.string().nullable().default(null),
      deadlineText: z.string().nullable().default(null),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      ownerUncertain: z.boolean().default(false),
      evidence: z.string().default(""),
      flags: z.array(z.string()).default([]),
    }),
  ),
  unresolvedQuestions: z.array(z.string()),
});

export type MeetingExtraction = z.infer<typeof meetingExtractionSchema>;

export const confirmedMeetingSchema = z.object({
  summary: z.string(),
  discussionPoints: z.array(z.string()),
  decisions: z.array(
    z.object({
      text: z.string(),
      rationale: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
    }),
  ),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullable().optional(),
      assigneeId: z.string().uuid().nullable(),
      dueDate: z.string().nullable(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      ownerUncertain: z.boolean().default(false),
    }),
  ),
  unresolvedQuestions: z.array(z.string()),
});

export const catchUpSchema = z.object({
  headline: z.string(),
  whatHappened: z.array(sourceRefItemSchema),
  decisions: z.array(sourceRefItemSchema),
  affectsYou: z.array(sourceRefItemSchema),
  needsAttention: z.array(sourceRefItemSchema),
  deadlines: z.array(sourceRefItemSchema),
  blocked: z.array(sourceRefItemSchema),
  readNext: z.array(sourceRefItemSchema),
});

export type CatchUpBrief = z.infer<typeof catchUpSchema>;

export const handoverBriefSchema = z.object({
  overview: z.array(sourceRefItemSchema),
  progress: z.array(sourceRefItemSchema),
  outstandingTasks: z.array(sourceRefItemSchema),
  decisions: z.array(sourceRefItemSchema),
  blockers: z.array(sourceRefItemSchema),
  resources: z.array(sourceRefItemSchema),
  nextSteps: z.array(sourceRefItemSchema),
});

export const askSchema = z.object({
  answer: z.string(),
  found: z.boolean(),
  refs: z.array(z.string()),
});

export const healthExplainSchema = z.object({
  summary: z.string(),
  actions: z.array(z.string()),
});

export type HealthExplanation = z.infer<typeof healthExplainSchema>;
