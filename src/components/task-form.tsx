"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "./modal";
import { ErrorNote, Field } from "./ui";
import { createTask, updateTask } from "@/app/actions/tasks";
import type { Member, TaskRow } from "@/lib/types";
const formSchema = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters").max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "blocked", "completed"]),
});
type FormValues = z.infer<typeof formSchema>;
export function TaskFormModal({
  open,
  onClose,
  members,
  task,
  defaultAssignee,
  originMeetingId,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  task?: TaskRow | null;
  defaultAssignee?: string;
  originMeetingId?: string;
}) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      assigneeId: task?.assignee_id ?? defaultAssignee ?? "",
      dueDate: task?.due_date ?? "",
      priority: task?.priority ?? "medium",
      status: task?.status ?? "todo",
    },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(undefined);
    const payload = {
      title: v.title,
      description: v.description || null,
      assigneeId: v.assigneeId || null,
      dueDate: v.dueDate || null,
      priority: v.priority,
    };
    const res = task
      ? await updateTask(task.id, { ...payload, status: v.status })
      : await createTask({ ...payload, status: v.status, originMeetingId });
    if (!res.ok) return setError(res.error);
    toast.success(task ? "Task updated" : "Task created");
    reset();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "Add task"}
      wide
    >
      {" "}
      <form onSubmit={onSubmit} className="space-y-4">
        {" "}
        <Field label="Title">
          <input className="input" {...register("title")} autoFocus />
          {errors.title && (
            <span className="mt-1 block text-[12px] text-terracotta-ink">
              {errors.title.message}
            </span>
          )}
        </Field>{" "}
        <Field label="Description">
          <textarea
            className="input min-h-[72px]"
            {...register("description")}
          />
        </Field>{" "}
        <div className="grid gap-4 sm:grid-cols-2">
          {" "}
          <Field label="Owner">
            <select className="input" {...register("assigneeId")}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </Field>{" "}
          <Field label="Due date">
            <input type="date" className="input" {...register("dueDate")} />
          </Field>{" "}
          <Field label="Priority">
            <select className="input" {...register("priority")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>{" "}
          <Field label="Status">
            <select className="input" {...register("status")}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </Field>{" "}
        </div>{" "}
        {error && <ErrorNote>{error}</ErrorNote>}{" "}
        <div className="flex justify-end gap-2 pt-1">
          {" "}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>{" "}
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : task ? "Save changes" : "Add task"}
          </button>{" "}
        </div>{" "}
      </form>{" "}
    </Modal>
  );
}
