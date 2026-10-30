import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { getContext } from "@/lib/context";
import { findRelatedDocuments } from "@/lib/queries";
import { EmptyState, PageHeader, SeedChip } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { UploadForm } from "./upload-form";
export const metadata = { title: "Knowledge Base" };
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { supabase, team } = await getContext();
  const [{ data: docs }, { data: meetings }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id,title,filename,created_at,char_count,is_seed,uploader:profiles!documents_uploaded_by_fkey(full_name)",
      )
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("meetings")
      .select("id,title")
      .eq("team_id", team.id)
      .order("scheduled_at", { ascending: false })
      .limit(30),
  ]);
  const hits = q
    ? await findRelatedDocuments(supabase, team.id, q, { limit: 20 })
    : null;
  const all = (docs ?? []) as unknown as {
    id: string;
    title: string;
    filename: string | null;
    created_at: string;
    char_count: number;
    is_seed: boolean;
    uploader: { full_name: string } | null;
  }[];
  const shown = hits
    ? hits
        .map((h) => ({
          ...all.find((d) => d.id === h.id)!,
          snippet: h.snippet,
        }))
        .filter((d) => d.id)
    : all.map((d) => ({ ...d, snippet: null as string | null }));
  return (
    <>
      {" "}
      <PageHeader
        title="Knowledge Base"
        description="Specs, runbooks and notes your team relies on. Searchable, and linked to the meetings and tasks they relate to."
      />{" "}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {" "}
        <div>
          {" "}
          <form className="relative mb-4">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              name="q"
              defaultValue={q}
              className="input pl-9"
              placeholder="Search document text"
              aria-label="Search documents"
            />
          </form>{" "}
          {shown.length === 0 ? (
            <EmptyState
              title={q ? "No matches" : "No documents yet"}
              body={
                q
                  ? "Try fewer or different keywords."
                  : "Upload a PDF or text file, or paste a note. ContextFlow extracts the text so it can be searched and cited."
              }
            />
          ) : (
            <div className="card divide-y divide-line">
              {shown.map((d) => (
                <Link
                  key={d.id}
                  href={`/knowledge/${d.id}`}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-sage-tint/40"
                >
                  <FileText size={17} className="mt-0.5 shrink-0 text-sage" />{" "}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {d.title}
                      {d.is_seed && <SeedChip />}
                    </p>
                    {d.snippet ? (
                      <p className="mt-1 text-[13px] text-muted-strong">
                        {d.snippet}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12.5px] text-muted-strong">
                        {d.uploader?.full_name ?? "Unknown"} ·{" "}
                        {fmtDate(d.created_at)} ·{" "}
                        {(d.char_count / 1000).toFixed(1)}k characters
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}{" "}
        </div>{" "}
        <UploadForm meetings={meetings ?? []} />{" "}
      </div>{" "}
    </>
  );
}
