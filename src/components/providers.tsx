"use client";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {" "}
      {children}{" "}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "!bg-white !border !border-line !text-ink !font-sans !shadow-none !rounded-lg",
            description: "!text-muted-strong",
          },
        }}
      />{" "}
    </MotionConfig>
  );
}
