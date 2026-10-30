import type { ReactNode } from "react";
import { getContext } from "@/lib/context";
import { AppShell } from "@/components/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getContext();

  return (
    <AppShell profile={ctx.profile} team={ctx.team}>
      {children}
    </AppShell>
  );
}
