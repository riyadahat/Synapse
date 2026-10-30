import {
  cn,
  initials,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type Status,
} from "@/lib/utils";
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      aria-label={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-sage-soft text-olive font-medium"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {" "}
      {initials(name)}{" "}
    </span>
  );
}
export function Person({ name, sub }: { name?: string | null; sub?: string }) {
  if (!name)
    return (
      <span className="inline-flex items-center gap-1.5 text-terracotta-ink text-[13px]">
        Unassigned
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar name={name} size={24} />
      <span className="text-[13.5px]">
        {name}
        {sub && <span className="text-muted-strong"> · {sub}</span>}
      </span>
    </span>
  );
}
const STATUS_STYLE: Record<Status, string> = {
  todo: "bg-white border-line text-muted-strong",
  in_progress: "bg-sage-soft border-sage-soft text-olive",
  blocked: "bg-amber-soft border-amber-soft text-amber-ink",
  completed: "bg-sage-tint border-line text-sage-dark",
};
export function StatusChip({ status }: { status: string }) {
  const s = (status in STATUS_LABEL ? status : "todo") as Status;
  return (
    <span className={cn("chip", STATUS_STYLE[s])}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          s === "blocked"
            ? "bg-amber"
            : s === "completed"
              ? "bg-sage"
              : s === "in_progress"
                ? "bg-sage"
                : "bg-muted",
        )}
      />
      {STATUS_LABEL[s]}
    </span>
  );
}
export function PriorityChip({ priority }: { priority: string }) {
  const high = priority === "high";
  return (
    <span
      className={cn(
        "text-[12.5px]",
        high ? "text-terracotta-ink font-medium" : "text-muted-strong",
      )}
    >
      {PRIORITY_LABEL[priority as keyof typeof PRIORITY_LABEL] ?? priority}
    </span>
  );
}
export const OverdueChip = () => (
  <span className="chip bg-terracotta-soft border-terracotta-soft text-terracotta-ink">
    Overdue
  </span>
);
export const SeedChip = () => (
  <span
    className="chip border-line bg-ivory text-muted-strong"
    title="Sample data from the demo seed"
  >
    Demo data
  </span>
);
export const AiChip = ({ label = "AI-extracted" }: { label?: string }) => (
  <span className="chip border-sage-soft bg-sage-tint text-sage-dark">
    {label}
  </span>
);
export function PageHeader({
  title,
  description,
  actions,
  serif,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  serif?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      {" "}
      <div>
        {" "}
        <h1
          className={cn(
            serif
              ? "font-serif text-[30px] leading-tight font-normal"
              : "text-[22px] font-semibold",
          )}
        >
          {title}
        </h1>{" "}
        {description && (
          <p className="mt-1 text-[14px] text-muted-strong max-w-xl">
            {description}
          </p>
        )}{" "}
      </div>{" "}
      {actions && <div className="flex items-center gap-2">{actions}</div>}{" "}
    </div>
  );
}
export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {aside}
    </div>
  );
}
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      {" "}
      <p className="font-serif text-[20px]">{title}</p>{" "}
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-muted-strong">
        {body}
      </p>{" "}
      {action && <div className="mt-4 flex justify-center">{action}</div>}{" "}
    </div>
  );
}
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-terracotta-soft bg-terracotta-soft px-3 py-2 text-[13px] text-terracotta-ink"
    >
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[12px] text-muted-strong">{hint}</span>
      )}
    </label>
  );
}
