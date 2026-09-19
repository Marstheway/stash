import { useEffect, useRef, useState } from "react";

export interface IDenseViewport {
  width: number;
  height: number;
}

function measure(el: HTMLElement | null): IDenseViewport {
  const width = el?.clientWidth || window.innerWidth;
  const top = el?.getBoundingClientRect().top ?? 0;
  const height = Math.max(window.innerHeight - top, 400);
  return { width, height };
}

export function useDenseViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<IDenseViewport>(() =>
    typeof window === "undefined" ? { width: 1920, height: 900 } : measure(null)
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setViewport(measure(el));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return [ref, viewport] as const;
}
