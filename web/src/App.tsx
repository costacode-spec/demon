import { useCallback, useEffect, useState } from "react";
import {
  createScan,
  getScan,
  listScans,
  SCAN_PROFILES,
  SEVERITY_LEVELS,
  type ScanDetail,
  type ScanProfile,
  type ScanSummary,
  type SeverityCounts,
} from "./api";

export function App() {
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ScanDetail | null>(null);

  // Refresh the list and, if one is open, the selected scan too — so a detail
  // opened while queued/running keeps updating as findings land.
  const refresh = useCallback(async () => {
    setScans(await listScans());
    if (selectedId !== null) {
      try {
        setSelected(await getScan(selectedId));
      } catch {
        setSelectedId(null); // scan no longer exists — drop the selection
        setSelected(null);
      }
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <main>
      <h1>Scans</h1>
      <ScanForm onSubmitted={refresh} />
      <ScanList scans={scans} onSelect={setSelectedId} />
      {selected && <ScanDetailView scan={selected} />}
    </main>
  );
}

function ScanForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [target, setTarget] = useState("");
  const [profile, setProfile] = useState<ScanProfile>("standard");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!target.trim()) return;
        try {
          await createScan(target.trim(), profile);
          setError(null);
          setTarget("");
          setTimeout(onSubmitted, 300);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <div className="row">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="http://localhost"
        />
        <select value={profile} onChange={(e) => setProfile(e.target.value as ScanProfile)}>
          {SCAN_PROFILES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit">Scan</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function ScanList({
  scans,
  onSelect,
}: {
  scans: ScanSummary[];
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="scan-list">
      {scans.map((s) => (
        <li key={s.id} onClick={() => onSelect(s.id)}>
          <span className="mono">#{s.id}</span>{" "}
          <span className={`status status-${s.status}`}>{s.status}</span>{" "}
          <span className="profile">{s.profile}</span> {s.target}{" "}
          <SeverityBadges counts={s.severityCounts} />
        </li>
      ))}
    </ul>
  );
}

function SeverityBadges({ counts }: { counts: SeverityCounts }) {
  const shown = SEVERITY_LEVELS.filter((l) => counts[l] > 0);
  if (shown.length === 0) return <span className="muted">no findings</span>;
  return (
    <span className="badges">
      {shown.map((l) => (
        <span key={l} className={`badge badge-${l}`}>
          {counts[l]} {l}
        </span>
      ))}
    </span>
  );
}

function ScanDetailView({ scan }: { scan: ScanDetail }) {
  return (
    <section className="detail">
      <h2>
        Scan #{scan.id} — {scan.status} ({scan.profile})
      </h2>
      {scan.failureReason && <p className="error">failure: {scan.failureReason}</p>}
      {scan.findings.length === 0 ? (
        <p className="muted">no findings</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>severity</th>
              <th>template</th>
              <th>matched</th>
            </tr>
          </thead>
          <tbody>
            {scan.findings.map((f, i) => (
              <tr key={i}>
                <td>{f.severity ?? "-"}</td>
                <td>{f.templateId}</td>
                <td className="mono">{f.matchedAt ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
