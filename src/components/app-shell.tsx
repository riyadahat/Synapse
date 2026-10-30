import Link from "next/link";
import { signOut } from "@/app/actions/auth";
const nav = [
  ["Dashboard", "/dashboard"],
  ["Meetings", "/meetings"],
  ["My Tasks", "/tasks"],
  ["Catch Me Up", "/catch-up"],
  ["Handovers", "/handovers"],
  ["Knowledge Base", "/knowledge"],
  ["Ask SYNAPSE", "/ask"],
  ["Context Health", "/health"],
  ["Activity", "/activity"],
  ["Settings", "/settings"],
];
export function AppShell({
  children,
  profile,
  team,
}: {
  children: React.ReactNode;
  profile: { full_name: string };
  team: { name: string };
}) {
  return (
    <div className="min-h-screen bg-ivory text-ink md:flex">
      <aside className="w-full border-b border-line bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <Link href="/dashboard" className="font-serif text-3xl">
          SYNAPSE
        </Link>
        <p className="mt-1 text-xs text-muted">
          Where knowledge connects. Work continues.
        </p>
        <div className="mt-8 text-xs text-muted">{team.name}</div>
        <nav className="mt-3 grid grid-cols-2 gap-1 md:grid-cols-1">
          {nav.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm hover:bg-sage-tint"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-line pt-4 text-sm">
          {profile.full_name}
          <form action={signOut}>
            <button className="mt-2 text-xs text-muted underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 md:p-9">{children}</main>
    </div>
  );
}
