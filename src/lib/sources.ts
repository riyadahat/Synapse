/** Short aliases (M1, T2, D3, DOC1, H1) let the model cite records without ever seeing or inventing UUIDs. */ export type SourceType =
  "meeting" | "task" | "decision" | "document" | "handover";
export interface Source {
  alias: string;
  type: SourceType;
  id: string;
  label: string;
  href: string;
}
const PREFIX: Record<SourceType, string> = {
  meeting: "M",
  task: "T",
  decision: "D",
  document: "DOC",
  handover: "H",
};
export class SourceRegistry {
  private bySource = new Map<string, Source>();
  private counts: Record<string, number> = {};
  add(type: SourceType, id: string, label: string, href: string): string {
    const key = `${type}:${id}`;
    const hit = this.bySource.get(key);
    if (hit) return hit.alias;
    this.counts[type] = (this.counts[type] ?? 0) + 1;
    const alias = `${PREFIX[type]}${this.counts[type]}`;
    this.bySource.set(key, { alias, type, id, label, href });
    return alias;
  }
  get all(): Source[] {
    return [...this.bySource.values()];
  }
  /** Keep only aliases that exist in the supplied context; returns resolved Source objects. */ resolve(
    aliases: string[],
  ): Source[] {
    const map = new Map(this.all.map((s) => [s.alias, s]));
    return Array.from(new Set(aliases.map((a) => a.trim().toUpperCase())))
      .map((a) => map.get(a))
      .filter((s): s is Source => !!s);
  }
}
