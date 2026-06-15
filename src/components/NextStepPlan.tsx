import type { StepPlan } from "@/lib/plan";
import { fmtDuration } from "@/lib/plan";

const KIND_STYLE: Record<string, string> = {
  scraper: "border-warn text-warn",
  model: "border-accent text-accent",
  api: "border-ok text-ok",
};

export function NextStepPlan({ plan }: { plan: StepPlan }) {
  return (
    <section className="card p-4 border-accent/40">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-medium">{plan.title}</h3>
        <div className="text-xs text-muted flex gap-3 whitespace-nowrap">
          <span>⏱ {fmtDuration(plan.estSeconds)}</span>
          {plan.estCostUsd > 0 && <span>≈ ${plan.estCostUsd.toFixed(2)}</span>}
        </div>
      </div>
      <p className="text-sm text-muted mb-3">{plan.description}</p>
      {plan.tools.length > 0 && (
        <div>
          <div className="text-xs text-muted mb-1.5">Tools this step will use:</div>
          <div className="flex flex-wrap gap-1.5">
            {plan.tools.map((t, i) => (
              <span key={i} className={`chip ${KIND_STYLE[t.kind] || "border-edge text-muted"}`}>
                {t.kind === "scraper" ? "⚙️" : t.kind === "model" ? "🧠" : "🔌"} {t.label}
                {t.runs > 1 && <span className="ml-1 opacity-70">×{t.runs}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-edge mt-3">Estimates are heuristic — actual time/cost vary with scrape volume.</p>
    </section>
  );
}
