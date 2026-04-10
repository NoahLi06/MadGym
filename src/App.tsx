import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  DEFAULT_ACCOUNT_KEY,
  fetchLocationCounts,
  occupancyPercent,
} from "./api";
import type { LocationCount } from "./types";

const REFRESH_MS = 45_000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function busyTone(
  loc: LocationCount,
  pct: number,
): { label: string; bar: string; glow: string } {
  if (loc.IsClosed) {
    return {
      label: "Closed",
      bar: "#64748b",
      glow: "rgba(100, 116, 139, 0.25)",
    };
  }
  if (!loc.CountCapacityColorEnabled) {
    return { label: "Live", bar: "#5eead4", glow: "rgba(94, 234, 212, 0.2)" };
  }
  if (pct < loc.MinCapacityRange) {
    return { label: "Light", bar: "#34d399", glow: "rgba(52, 211, 153, 0.2)" };
  }
  if (pct < loc.MaxCapacityRange) {
    return {
      label: "Busy",
      bar: loc.MinColor || "#fbbf24",
      glow: "rgba(251, 191, 36, 0.25)",
    };
  }
  return {
    label: "Packed",
    bar: loc.MaxColor || "#f87171",
    glow: "rgba(248, 113, 113, 0.25)",
  };
}

function uniqueFacilities(rows: LocationCount[]) {
  const map = new Map<number, string>();
  for (const r of rows) {
    if (!map.has(r.FacilityId)) map.set(r.FacilityId, r.FacilityName.trim());
  }
  return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

export function App() {
  const [rows, setRows] = useState<LocationCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facilityId, setFacilityId] = useState<string>("All");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchLocationCounts(DEFAULT_ACCOUNT_KEY);
      setRows(data);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const facilities = useMemo(() => uniqueFacilities(rows), [rows]);

  const filtered = useMemo(() => {
    if (facilityId === "All") return rows;
    const fid = Number(facilityId);
    return rows.filter((r) => r.FacilityId === fid);
  }, [rows, facilityId]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const pa = occupancyPercent(a);
      const pb = occupancyPercent(b);
      if (pb !== pa) return pb - pa;
      return a.LocationName.localeCompare(b.LocationName);
    });
  }, [filtered]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>HustlerFit</h1>
          <p style={styles.kicker}>Live occupancy</p>
          <p style={styles.sub}>
            Track real-time usage of both the Nick and Bakke
          </p>
        </div>
        <div style={styles.controls}>
          <label style={styles.label}>
            Facility
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              style={styles.select}
              disabled={loading && rows.length === 0}
            >
              <option value="All">All facilities</option>
              {facilities.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void load()} style={styles.btn}>
            Refresh now
          </button>
        </div>
      </header>

      {error && (
        <div style={styles.banner} role="alert">
          {error}
        </div>
      )}

      <div style={styles.meta}>
        {lastFetch && (
          <span style={styles.metaText}>
            Updated {lastFetch.toLocaleTimeString()} · auto every{" "}
            {REFRESH_MS / 1000}s
          </span>
        )}
        {loading && rows.length > 0 && (
          <span style={styles.pulse}>Refreshing…</span>
        )}
      </div>

      <section style={styles.grid}>
        {loading && rows.length === 0 && (
          <p style={styles.placeholder}>Loading live counts…</p>
        )}
        {!loading && sorted.length === 0 && !error && (
          <p style={styles.placeholder}>No locations for this filter.</p>
        )}
        {sorted.map((loc) => {
          const pct = occupancyPercent(loc);
          const tone = busyTone(loc, pct);
          return (
            <article key={loc.LocationId} style={styles.card}>
              <div style={styles.cardTop}>
                <div>
                  <p style={styles.facility}>{loc.FacilityName}</p>
                  <h2 style={styles.location}>{loc.LocationName}</h2>
                </div>
                <span
                  style={{
                    ...styles.badge,
                    borderColor: tone.bar,
                    color: tone.bar,
                    background: tone.glow,
                  }}
                >
                  {tone.label}
                </span>
              </div>
              <div style={styles.stats}>
                <div>
                  <p style={styles.statLabel}>People</p>
                  <p style={styles.statValue}>
                    {loc.LastCount}
                    <span style={styles.statCap}> / {loc.TotalCapacity}</span>
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={styles.statLabel}>Occupancy</p>
                  <p style={{ ...styles.statValue, fontFamily: "var(--mono)" }}>
                    {pct}%
                  </p>
                </div>
              </div>
              <div style={styles.track}>
                <div
                  style={{
                    ...styles.fill,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${tone.bar}, ${tone.bar}cc)`,
                    boxShadow: `0 0 24px ${tone.glow}`,
                  }}
                />
              </div>
              <p style={styles.cardFooter}>
                Last count: {formatTime(loc.LastUpdatedDateAndTime)}
              </p>
            </article>
          );
        })}
      </section>

      <footer style={styles.footer}>
        Powered by facility data from{" "}
        <a
          href="https://www.connect2concepts.com/"
          target="_blank"
          rel="noreferrer noopener"
          style={styles.link}
        >
          Connect2Concepts
        </a>
        . Not affiliated with UW Recreation & Wellness.
      </footer>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "clamp(1.5rem, 4vw, 3rem)",
    paddingBottom: "4rem",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    gap: "2rem",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.5rem",
  },
  kicker: {
    margin: 0,
    fontSize: "0.8125rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--accent)",
  },
  title: {
    margin: "0.25rem 0 0.5rem",
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  sub: {
    margin: 0,
    maxWidth: 520,
    color: "var(--text-muted)",
    fontSize: "0.95rem",
  },
  link: {
    color: "var(--accent)",
    textDecoration: "none",
    borderBottom: "1px solid rgba(94, 234, 212, 0.35)",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    alignItems: "flex-end",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  select: {
    minWidth: 220,
    padding: "0.65rem 0.9rem",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text)",
    fontSize: "0.95rem",
  },
  btn: {
    padding: "0.65rem 1.1rem",
    borderRadius: 10,
    border: "1px solid rgba(94, 234, 212, 0.35)",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  banner: {
    padding: "0.75rem 1rem",
    borderRadius: 10,
    background: "rgba(248, 113, 113, 0.12)",
    border: "1px solid rgba(248, 113, 113, 0.25)",
    color: "#fecaca",
    marginBottom: "1rem",
  },
  meta: {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    marginBottom: "1.25rem",
    minHeight: 24,
  },
  metaText: {
    fontSize: "0.8125rem",
    color: "var(--text-muted)",
  },
  pulse: {
    fontSize: "0.8125rem",
    color: "var(--accent)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
    gap: "1rem",
  },
  placeholder: {
    gridColumn: "1 / -1",
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "3rem",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "1.25rem 1.35rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    transition: "border-color 0.2s ease",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "0.75rem",
  },
  facility: {
    margin: 0,
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  location: {
    margin: "0.15rem 0 0",
    fontSize: "1.05rem",
    fontWeight: 650,
    lineHeight: 1.3,
  },
  badge: {
    flexShrink: 0,
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "0.35rem 0.55rem",
    borderRadius: 8,
    border: "1px solid",
  },
  stats: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "1rem",
  },
  statLabel: {
    margin: 0,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  statValue: {
    margin: "0.1rem 0 0",
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  statCap: {
    fontSize: "1rem",
    fontWeight: 500,
    color: "var(--text-muted)",
  },
  track: {
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.4s ease",
  },
  cardFooter: {
    margin: 0,
    fontSize: "0.75rem",
    color: "var(--text-muted)",
  },
  footer: {
    marginTop: "3rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid var(--border)",
    fontSize: "0.8rem",
    color: "var(--text-muted)",
    textAlign: "center",
  },
};
