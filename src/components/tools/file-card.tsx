"use client";

import { useState, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileThumbnail } from "./file-thumbnail";
import { formatBytes } from "@/lib/format";

interface FileCardProps {
  id: string;
  file: File;
  isPdf: boolean;
  draggable: boolean;
  onRemove: () => void;
  removeLabel: string;
  dragLabel: string;
}

export function FileCard({ id, file, isPdf, draggable, onRemove, removeLabel, dragLabel }: FileCardProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className="tool-file-card"
      style={{
        ...style,
        flex: "none",
        borderRadius: 12,
        background: "var(--cs-card)",
        boxShadow: hover ? "0 10px 26px rgba(20,20,40,.12)" : "0 1px 2px rgba(20,20,40,.04)",
        transition: `${transition ? transition + "," : ""} box-shadow .18s ease`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {draggable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={dragLabel}
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            zIndex: 2,
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "none",
            background: "rgba(255,255,255,.92)",
            color: "var(--cs-text-2)",
            cursor: "grab",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
            touchAction: "none",
          }}
        >
          ⠿
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "none",
          background: "rgba(20,20,32,.6)",
          color: "#fff",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        &times;
      </button>
      <div style={{ flex: "1 1 auto", background: "var(--cs-bg-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        <FileThumbnail file={file} isPdf={isPdf} onPageCount={setPageCount} />
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--cs-line)" }}>
        <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={file.name}>
          {file.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--cs-text-2)" }}>
          {formatBytes(file.size)}
          {pageCount ? ` · ${pageCount} p.` : ""}
        </div>
      </div>
    </div>
  );
}
