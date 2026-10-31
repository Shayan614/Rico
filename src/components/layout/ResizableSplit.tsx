"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  splitMode: "split" | "chat" | "dashboard";
  defaultRatio?: number;
}

export function ResizableSplit({
  left,
  right,
  splitMode,
  defaultRatio = 44,
}: ResizableSplitProps) {
  const [ratio, setRatio] = useState(defaultRatio);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDragging = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const newRatio = (currentX / rect.width) * 100;
      if (newRatio >= 25 && newRatio <= 75) {
        setRatio(newRatio);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (splitMode === "chat") {
    return <div className="h-full w-full bg-white dark:bg-neutral-950">{left}</div>;
  }

  if (splitMode === "dashboard") {
    return <div className="h-full w-full bg-white dark:bg-neutral-950">{right}</div>;
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col md:flex-row overflow-hidden relative bg-white dark:bg-neutral-950 transition-colors"
    >
      {/* Desktop Left Pane (Chat) */}
      <div
        style={{ width: `${ratio}%` }}
        className="hidden md:block h-full shrink-0 border-r border-neutral-200 dark:border-neutral-800"
      >
        {left}
      </div>

      {/* Desktop Draggable Divider */}
      <div
        onMouseDown={startDragging}
        className="hidden md:flex w-2 -ml-1 cursor-col-resize items-center justify-center relative z-20 group hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
        title="Drag to resize split view"
      >
        <div className="w-[1.5px] h-8 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-neutral-500 group-hover:h-12 transition-all" />
      </div>

      {/* Desktop Right Pane (Work Surface) */}
      <div
        style={{ width: `${100 - ratio}%` }}
        className="hidden md:block h-full flex-1"
      >
        {right}
      </div>

      {/* Mobile view: full height chat with mobile drawer toggle in header */}
      <div className="md:hidden flex-1 h-full w-full overflow-hidden">
        {left}
      </div>
    </div>
  );
}
