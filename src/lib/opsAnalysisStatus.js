// A failed or merely started attempt must not be displayed as a completed reading.
export function latestCompletedAnalysisEvent(events) {
  return (Array.isArray(events) ? events : [])
    .filter(event => ["case_reanalysis_completed", "ai_expediente_result"].includes(event?.type)
      && Number.isFinite(Date.parse(event.created_at)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
}
