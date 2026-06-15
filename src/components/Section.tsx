/**
 * Collapsible section (native <details>, SSR-friendly — no client JS needed).
 * Used to lay out everything about a run as expandable accordions in the idea view.
 */
export function Section({
  title,
  badge,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card group" open={defaultOpen}>
      <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 list-none select-none">
        <span className="text-muted text-xs transition-transform group-open:rotate-90">▶</span>
        <span className="font-medium">{title}</span>
        {badge}
        {subtitle && <span className="ml-auto text-xs text-muted">{subtitle}</span>}
      </summary>
      <div className="px-4 pb-4 border-t border-edge pt-3">{children}</div>
    </details>
  );
}
