"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {" "}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]">
          {" "}
          <motion.div
            className="fixed inset-0 bg-olive/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />{" "}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-lg border border-line bg-white`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {" "}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              {" "}
              <h2 className="text-[15px] font-semibold">{title}</h2>{" "}
              <button
                onClick={onClose}
                className="btn-ghost btn-sm !px-1.5"
                aria-label="Close"
              >
                <X size={16} />
              </button>{" "}
            </div>{" "}
            <div className="p-5">{children}</div>{" "}
          </motion.div>{" "}
        </div>
      )}{" "}
    </AnimatePresence>
  );
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {" "}
      <p className="text-[14px] text-muted-strong">{body}</p>{" "}
      <div className="mt-5 flex justify-end gap-2">
        {" "}
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>{" "}
        <button
          className={danger ? "btn-danger" : "btn-primary"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>{" "}
      </div>{" "}
    </Modal>
  );
}
