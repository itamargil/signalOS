const COLORS: Record<string, string> = {
  pending: "text-muted border-edge",
  running: "text-accent border-accent",
  awaiting_approval: "text-warn border-warn",
  completed: "text-ok border-ok",
  failed: "text-bad border-bad",
  cancelled: "text-muted border-edge",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`chip ${COLORS[status] || "text-muted border-edge"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
