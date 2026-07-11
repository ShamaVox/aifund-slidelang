// Fire-and-forget KPI beacons to the backend. Never blocks the UI or throws;
// telemetry must not affect the product. Powers the live metrics dashboard.
export function kpi(kind, fields = {}) {
  try {
    fetch("/api/kpi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...fields }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* telemetry is best-effort */ }
}

export async function fetchMetrics() {
  try {
    const res = await fetch("/api/kpi/metrics");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
