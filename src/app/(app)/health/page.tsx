import Link from "next/link";
import { getContext } from "@/lib/context";
import { computeHealth, HEALTH_WEIGHTS } from "@/lib/health";
import { PageHeader, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { HealthClient } from "./health-client";
export const metadata = { title: "Context Health" };
export const maxDuration = 60;
export default async function HealthPage() {
  const { supabase, team } = await getContext();
  const h = await computeHealth(supabase, team.id);
  const chart = h.metrics
    .filter((m) => m.value !== null)
    .map((m) => ({
      name: m.label,
      score: Math.round((m.value as number) * 100),
    }));
  return (
    <>
      {" "}
      <PageHeader
        title="Context Health"
        description="How well your team keeps and passes on context. Calculated from your real records with a fixed formula."
      />{" "}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {" "}
        <div className="space-y-6">
          {" "}
          <div className="card card-pad">
            <p className="text-[13px] font-medium text-muted-strong">
              Overall score
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-[64px] leading-none">
                {h.score ?? "—"}
              </span>
              <span className="text-muted-strong">/ 100</span>
            </p>{" "}
            <p
              className={cn(
                "mt-2 text-[14px] font-medium",
                h.band === "At risk"
                  ? "text-terracotta-ink"
                  : h.band === "Needs attention"
                    ? "text-amber-ink"
                    : "text-sage-dark",
              )}
            >
              {h.band}
            </p>{" "}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-sage-soft">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${h.score ?? 0}%` }}
              />
            </div>
          </div>{" "}
          <div className="card card-pad">
            <h2 className="mb-2 text-[14px] font-semibold">
              How it’s calculated
            </h2>
            <p className="text-[13px] leading-relaxed text-muted-strong">
              A weighted average of six measures. A measure with nothing to
              count (for example, no open tasks) is skipped and the other
              weights are rescaled. AI never changes the score; it only explains
              it.
            </p>{" "}
            <ul className="mt-3 space-y-1 text-[12.5px]">
              {h.metrics.map((m) => (
                <li key={m.key} className="flex justify-between gap-2">
                  <span>{m.label}</span>
                  <span className="meta">{HEALTH_WEIGHTS[m.key]}%</span>
                </li>
              ))}
            </ul>
          </div>{" "}
        </div>{" "}
        <div className="space-y-6">
          {" "}
          <section>
            <SectionTitle>Breakdown</SectionTitle>
            <div className="card">
              <HealthClient chart={chart} />{" "}
              <table className="w-full text-[13.5px]">
                <tbody>
                  {h.metrics.map((m) => (
                    <tr key={m.key}>
                      <td className="td">{m.label}</td>
                      <td className="td text-muted-strong">{m.detail}</td>
                      <td className="td w-16 text-right font-medium">
                        {m.value === null ? (
                          <span className="text-muted-strong">n/a</span>
                        ) : (
                          `${Math.round(m.value * 100)}%`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>{" "}
          <section>
            <SectionTitle>Key risks</SectionTitle>
            {h.risks.length === 0 ? (
              <p className="card p-4 text-[13.5px] text-muted-strong">
                No risks found in the current records.
              </p>
            ) : (
              <ul className="card divide-y divide-line">
                {h.risks.map((r, i) => (
                  <li key={i}>
                    <Link
                      href={r.href}
                      className="flex items-center gap-3 px-5 py-3 text-[14px] hover:bg-sage-tint/40"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          r.severity === "high" ? "bg-terracotta" : "bg-amber",
                        )}
                        aria-hidden
                      />
                      <span>{r.text}</span>
                      <span className="sr-only">{r.severity} severity</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>{" "}
          <section>
            <SectionTitle>Recommended improvements</SectionTitle>
            {h.recommendations.length === 0 ? (
              <p className="card p-4 text-[13.5px] text-muted-strong">
                Nothing to improve right now.
              </p>
            ) : (
              <ul className="card card-pad list-disc space-y-1.5 pl-9 text-[14px]">
                {h.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </section>{" "}
          <HealthClient explain={h.score !== null} />{" "}
        </div>{" "}
      </div>{" "}
    </>
  );
}
