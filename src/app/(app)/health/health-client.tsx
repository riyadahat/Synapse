"use client";
import { useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { explainHealth } from "@/app/actions/ask";
import { ErrorNote } from "@/components/ui";
import type { HealthExplanation } from "@/lib/schemas";
export function HealthClient({
  chart,
  explain,
}: {
  chart?: { name: string; score: number }[];
  explain?: boolean;
}) {
  const [ex, setEx] = useState<HealthExplanation | null>(null);
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  if (chart)
    return chart.length === 0 ? null : (
      <div
        className="h-[220px] border-b border-line px-3 pt-4"
        role="img"
        aria-label="Bar chart of each health metric as a percentage"
      >
        {" "}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chart}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            {" "}
            <CartesianGrid horizontal={false} stroke="#E7E5DD" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#5C625B" }}
              stroke="#E7E5DD"
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={170}
              tick={{ fontSize: 12, fill: "#202923" }}
              stroke="#E7E5DD"
            />{" "}
            <Tooltip
              cursor={{ fill: "#EEF1EA" }}
              contentStyle={{
                border: "1px solid #E7E5DD",
                borderRadius: 6,
                fontSize: 12,
                boxShadow: "none",
              }}
              formatter={(v) => [`${v}%`, "Score"]}
            />{" "}
            <Bar dataKey="score" radius={[0, 3, 3, 0]} barSize={14}>
              {chart.map((c) => (
                <Cell
                  key={c.name}
                  fill={
                    c.score >= 80
                      ? "#71816B"
                      : c.score >= 50
                        ? "#C69B65"
                        : "#B76E5E"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  if (!explain) return null;
  return (
    <section className="card card-pad">
      {" "}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Explain these results</h2>
          <p className="text-[13px] text-muted-strong">
            Plain-language reading of the numbers above. It doesn’t change the
            score.
          </p>
        </div>{" "}
        <button
          className="btn-secondary shrink-0"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(undefined);
              const r = await explainHealth();
              r.ok ? setEx(r.data!) : setErr(r.error);
            })
          }
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {ex ? "Refresh" : "Explain"}
        </button>
      </div>{" "}
      {err && (
        <div className="mt-3">
          <ErrorNote>{err}</ErrorNote>
        </div>
      )}{" "}
      {ex && (
        <div className="mt-4 space-y-3 text-[14px]">
          <p className="leading-relaxed">{ex.summary}</p>
          {ex.actions.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {ex.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}{" "}
    </section>
  );
}
