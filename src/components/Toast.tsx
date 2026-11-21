"use client";
import { createContext, useCallback, useContext, useState } from "react";

type T = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<(kind: T["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-sm flex-col gap-2 px-4">
        {items.map((i) => (
          <div key={i.id} role="status" className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${i.kind === "success" ? "bg-emerald-700" : "bg-red-700"}`}>{i.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
