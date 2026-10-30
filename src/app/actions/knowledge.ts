"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { getContext } from "@/lib/context";
import { getLogger } from "@/lib/logger";
import { recordActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/types";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Splits document text into overlapping chunks for search and retrieval.
 */
function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!clean) return [];

  const chunks: string[] = [];
  let i = 0;

  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);

    if (end < clean.length) {
      const lineBreak = clean.lastIndexOf("\n", end);
      const sentenceBreak = clean.lastIndexOf(". ", end);
      const cut = Math.max(lineBreak, sentenceBreak);

      if (cut > i + size * 0.5) {
        end = cut + 1;
      }
    }

    chunks.push(clean.slice(i, end).trim());

    if (end >= clean.length) break;

    i = Math.max(end - overlap, i + 1);
  }

  return chunks.filter(Boolean);
}

/**
 * Extracts text from PDF, TXT or Markdown files.
 */
async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfModule = await import("pdf-parse/lib/pdf-parse.js");

    const pdf = pdfModule.default as (
      buffer: Buffer,
    ) => Promise<{ text: string }>;

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await pdf(buffer);

    return result.text;
  }

  return file.text();
}

/**
 * Uploads a document or saves pasted text to the Knowledge Base.
 */
export async function uploadDocument(
  _: ActionResult | undefined,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  const log = await getLogger({
    action: "document.upload",
  });

  const file = fd.get("file") as File | null;
  const pasted = String(fd.get("text") ?? "").trim();
  const titleIn = String(fd.get("title") ?? "").trim();
  const meetingId = String(fd.get("meetingId") ?? "") || null;

  const { supabase, user, team } = await getContext();

  let content = pasted;
  let filename: string | null = null;
  let mime: string | null = null;
  let size = 0;

  const hasFile = Boolean(file && file.size > 0);

  if (hasFile && file) {
    const name = file.name.toLowerCase();

    if (!(
      name.endsWith(".pdf") ||
      name.endsWith(".txt") ||
      name.endsWith(".md")
    )) {
      return {
        ok: false,
        error: "Upload a PDF or TXT file.",
      };
    }

    if (file.size > MAX_BYTES) {
      return {
        ok: false,
        error: "That file is over 8 MB. Split it or upload a smaller one.",
      };
    }

    try {
      content = await extractText(file);
    } catch (error) {
      log.warn({
        event: "document.extract_failed",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 120)
            : "Unknown extraction error",
      });

      return {
        ok: false,
        error:
          "Couldn't read text from that file. If it's a scanned PDF, upload a text version.",
      };
    }

    filename = file.name;
    mime = file.type || null;
    size = file.size;
  }

  content = content.replace(/\u0000/g, "").trim();

  if (content.length < 10) {
    return {
      ok: false,
      error: hasFile
        ? "No readable text was found in that file (scanned PDFs need OCR)."
        : "Choose a file or paste some text.",
    };
  }

  const title = titleIn || filename?.replace(/\.[^.]+$/, "") || "Untitled note";

  // Upload the original file to private Supabase Storage.
  let storagePath: string | null = null;

  if (hasFile && file) {
    const safeFilename = filename!.replace(/[^\w.\-]+/g, "_");

    storagePath = `${team.id}/${randomUUID()}-${safeFilename}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, {
        contentType: mime ?? "application/octet-stream",
      });

    if (storageError) {
      log.warn({
        event: "document.storage_failed",
        errorMessage: storageError.message,
      });

      // The extracted text can still be saved and searched.
      storagePath = null;
    }
  }

  // Save the document and its extracted text.
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      team_id: team.id,
      title,
      filename,
      mime_type: mime,
      storage_path: storagePath,
      content,
      meeting_id: meetingId,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error || !doc) {
    log.error({
      event: "document.create_failed",
      errorMessage: error?.message,
    });

    return {
      ok: false,
      error: "Couldn't save the document.",
    };
  }

  // Split the text into searchable chunks.
  const chunks = chunkText(content);

  const { error: chunkError } = await supabase.from("document_chunks").insert(
    chunks.map((chunk, index) => ({
      document_id: doc.id,
      team_id: team.id,
      chunk_index: index,
      content: chunk,
    })),
  );

  if (chunkError) {
    log.error({
      event: "document.chunk_failed",
      documentId: doc.id,
      errorMessage: chunkError.message,
    });
  }

  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "document.uploaded",
    entityType: "document",
    entityId: doc.id,
    summary: `added “${title}” to the knowledge base`,
    metadata: {
      bytes: size,
      chars: content.length,
      chunks: chunks.length,
      stored: Boolean(storagePath),
    },
  });

  revalidatePath("/", "layout");

  return {
    ok: true,
    data: {
      id: doc.id,
    },
  };
}

/**
 * Links a document to a task or meeting.
 */
export async function linkDocument(
  docId: string,
  link: {
    taskId?: string;
    meetingId?: string;
  },
): Promise<ActionResult> {
  const { supabase, team } = await getContext();

  const { data: document } = await supabase
    .from("documents")
    .select("id")
    .eq("id", docId)
    .eq("team_id", team.id)
    .single();

  if (!document) {
    return {
      ok: false,
      error: "Document not found.",
    };
  }

  if (link.taskId) {
    const { data: task } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", link.taskId)
      .eq("team_id", team.id)
      .single();

    if (!task) {
      return {
        ok: false,
        error: "Task not found.",
      };
    }

    const { error } = await supabase.from("task_documents").upsert({
      task_id: link.taskId,
      document_id: docId,
    });

    if (error) {
      return {
        ok: false,
        error: "Couldn't link the task.",
      };
    }
  }

  if (link.meetingId !== undefined) {
    if (link.meetingId) {
      const { data: meeting } = await supabase
        .from("meetings")
        .select("id")
        .eq("id", link.meetingId)
        .eq("team_id", team.id)
        .single();

      if (!meeting) {
        return {
          ok: false,
          error: "Meeting not found.",
        };
      }
    }

    const { error } = await supabase
      .from("documents")
      .update({
        meeting_id: link.meetingId || null,
      })
      .eq("id", docId)
      .eq("team_id", team.id);

    if (error) {
      return {
        ok: false,
        error: "Couldn't link the meeting.",
      };
    }
  }

  revalidatePath(`/knowledge/${docId}`);

  return {
    ok: true,
  };
}

/**
 * Removes a task association from a document.
 */
export async function unlinkTask(
  docId: string,
  taskId: string,
): Promise<ActionResult> {
  const { supabase, team } = await getContext();

  const { data: document } = await supabase
    .from("documents")
    .select("id")
    .eq("id", docId)
    .eq("team_id", team.id)
    .single();

  if (!document) {
    return {
      ok: false,
      error: "Document not found.",
    };
  }

  const { error } = await supabase
    .from("task_documents")
    .delete()
    .eq("document_id", docId)
    .eq("task_id", taskId);

  if (error) {
    return {
      ok: false,
      error: "Couldn't unlink the task.",
    };
  }

  revalidatePath(`/knowledge/${docId}`);

  return {
    ok: true,
  };
}

/**
 * Deletes a document, its stored file and associated records.
 */
export async function deleteDocument(docId: string): Promise<void> {
  const log = await getLogger({
    action: "document.delete",
  });

  const { supabase, user, team } = await getContext();

  const { data: document } = await supabase
    .from("documents")
    .select("title, storage_path")
    .eq("id", docId)
    .eq("team_id", team.id)
    .single();

  if (!document) {
    redirect("/knowledge");
  }

  if (document.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([document.storage_path]);

    if (storageError) {
      log.warn({
        event: "document.storage_delete_failed",
        errorMessage: storageError.message,
      });
    }
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId)
    .eq("team_id", team.id);

  if (error) {
    log.error({
      event: "document.delete_failed",
      errorMessage: error.message,
    });

    throw new Error("Couldn't delete the document.");
  }

  await recordActivity(supabase, log, {
    teamId: team.id,
    actorId: user.id,
    action: "document.deleted",
    entityType: "document",
    entityId: docId,
    summary: `removed “${document.title}” from the knowledge base`,
  });

  revalidatePath("/", "layout");

  redirect("/knowledge");
}
