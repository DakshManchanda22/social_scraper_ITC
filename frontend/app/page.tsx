"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Settings {
  accounts: string[];
  recipient_emails: string[];
  schedule_days: number;
}

interface Status {
  running: boolean;
  last_run: string | null;
  last_error: string | null;
  status: "idle" | "running" | "success" | "error";
}

function Tag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span style={styles.tag}>
      {label}
      <button
        onClick={onRemove}
        style={styles.tagRemove}
        title={`Remove ${label}`}
        aria-label={`Remove ${label}`}
      >
        ✕
      </button>
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{title}</h2>
        {subtitle && <p style={styles.cardSubtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>({
    accounts: [],
    recipient_emails: [],
    schedule_days: 7,
  });
  const [status, setStatus] = useState<Status>({
    running: false,
    last_run: null,
    last_error: null,
    status: "idle",
  });
  const [accountInput, setAccountInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/settings`);
      if (res.ok) setSettings(await res.json());
    } catch {
      /* backend not reachable yet */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/status`);
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchStatus();
  }, [fetchSettings, fetchStatus]);

  // Poll status while running
  useEffect(() => {
    if (status.running) {
      pollRef.current = setInterval(fetchStatus, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status.running, fetchStatus]);

  const addAccount = () => {
    const val = accountInput.trim().replace(/^@/, "").toLowerCase();
    if (!val || settings.accounts.includes(val)) return;
    setSettings((s) => ({ ...s, accounts: [...s.accounts, val] }));
    setAccountInput("");
  };

  const removeAccount = (a: string) =>
    setSettings((s) => ({ ...s, accounts: s.accounts.filter((x) => x !== a) }));

  const addEmail = () => {
    const val = emailInput.trim().toLowerCase();
    if (!val || !val.includes("@") || settings.recipient_emails.includes(val)) return;
    setSettings((s) => ({ ...s, recipient_emails: [...s.recipient_emails, val] }));
    setEmailInput("");
  };

  const removeEmail = (e: string) =>
    setSettings((s) => ({
      ...s,
      recipient_emails: s.recipient_emails.filter((x) => x !== e),
    }));

  const handleKeyDown =
    (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") fn();
    };

  const saveSettings = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveMsg("Saved successfully");
      } else {
        const err = await res.json();
        setSaveMsg(`Error: ${err.detail ?? "unknown error"}`);
      }
    } catch {
      setSaveMsg("Could not reach backend — is it running?");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const runNow = async () => {
    try {
      const res = await fetch(`${API}/api/run`, { method: "POST" });
      if (res.ok) {
        setStatus((s) => ({ ...s, running: true, status: "running" }));
        fetchStatus();
      } else {
        const err = await res.json();
        alert(err.detail ?? "Failed to start run.");
      }
    } catch {
      alert("Could not reach backend — is it running?");
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  };

  const statusColor =
    status.status === "success"
      ? "var(--green)"
      : status.status === "error"
      ? "var(--red)"
      : status.status === "running"
      ? "var(--gold)"
      : "var(--text-muted)";

  const statusLabel =
    status.status === "running"
      ? "Running…"
      : status.status === "success"
      ? "Last run succeeded"
      : status.status === "error"
      ? "Last run failed"
      : "No runs yet";

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingDot} />
      </div>
    );
  }

  return (
    <main style={styles.main}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Instagram Trend Agent</h1>
          <p style={styles.headerSub}>Competitive analysis on autopilot</p>
        </div>
        <div style={styles.statusBadge}>
          <span style={{ ...styles.statusDot, background: statusColor }} />
          <span style={{ color: statusColor, fontSize: 13 }}>{statusLabel}</span>
        </div>
      </header>

      <div style={styles.grid}>
        {/* Accounts */}
        <Card
          title="Instagram Accounts"
          subtitle="Add competitor or category handles to monitor (without @)"
        >
          <div style={styles.inputRow}>
            <input
              placeholder="e.g. nike"
              value={accountInput}
              onChange={(e) => setAccountInput(e.target.value)}
              onKeyDown={handleKeyDown(addAccount)}
            />
            <button onClick={addAccount} style={styles.addBtn}>
              Add
            </button>
          </div>
          <div style={styles.tagWrap}>
            {settings.accounts.length === 0 && (
              <span style={styles.emptyHint}>No accounts added yet</span>
            )}
            {settings.accounts.map((a) => (
              <Tag key={a} label={`@${a}`} onRemove={() => removeAccount(a)} />
            ))}
          </div>
        </Card>

        {/* Emails */}
        <Card
          title="Report Recipients"
          subtitle="Who receives the HTML report email"
        >
          <div style={styles.inputRow}>
            <input
              placeholder="e.g. team@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown(addEmail)}
            />
            <button onClick={addEmail} style={styles.addBtn}>
              Add
            </button>
          </div>
          <div style={styles.tagWrap}>
            {settings.recipient_emails.length === 0 && (
              <span style={styles.emptyHint}>No recipients added yet</span>
            )}
            {settings.recipient_emails.map((e) => (
              <Tag key={e} label={e} onRemove={() => removeEmail(e)} />
            ))}
          </div>
        </Card>

        {/* Schedule */}
        <Card
          title="Report Schedule"
          subtitle="How often the report is automatically generated and sent"
        >
          <div style={styles.scheduleWrap}>
            <div style={styles.scheduleValue}>
              Every{" "}
              <span style={styles.scheduleNum}>{settings.schedule_days}</span>{" "}
              {settings.schedule_days === 1 ? "day" : "days"}
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={settings.schedule_days}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  schedule_days: Number(e.target.value),
                }))
              }
              style={styles.slider}
            />
            <div style={styles.sliderLabels}>
              <span>Daily</span>
              <span>Weekly (7)</span>
              <span>Monthly (30)</span>
            </div>
          </div>
        </Card>

        {/* Status */}
        <Card title="Run History">
          <div style={styles.statusGrid}>
            <div style={styles.statBlock}>
              <div style={styles.statLabel}>Last successful run</div>
              <div style={styles.statValue}>{formatDate(status.last_run)}</div>
            </div>
            {status.last_error && (
              <div style={{ ...styles.statBlock, gridColumn: "1 / -1" }}>
                <div style={{ ...styles.statLabel, color: "var(--red)" }}>
                  Last error
                </div>
                <div style={{ ...styles.statValue, color: "var(--red)", fontSize: 12 }}>
                  {status.last_error}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Action bar */}
      <div style={styles.actionBar}>
        <div style={styles.actionLeft}>
          {saveMsg && (
            <span
              style={{
                color: saveMsg.startsWith("Error") ? "var(--red)" : "var(--green)",
                fontSize: 13,
              }}
            >
              {saveMsg}
            </span>
          )}
        </div>
        <div style={styles.actionRight}>
          <button onClick={saveSettings} disabled={saving} style={styles.saveBtn}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
          <button onClick={runNow} disabled={status.running} style={styles.runBtn}>
            {status.running ? (
              <>
                <span style={styles.spinner} /> Running…
              </>
            ) : (
              "▶  Run Now"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "40px 20px 80px",
  },
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "var(--gold)",
    animation: "pulse 1s infinite",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 36,
    paddingBottom: 24,
    borderBottom: "2px solid var(--gold)",
  },
  h1: {
    color: "var(--gold)",
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 1,
  },
  headerSub: {
    color: "var(--text-muted)",
    fontSize: 13,
    marginTop: 4,
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: "6px 14px",
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    marginBottom: 24,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 24,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
  },
  cardSubtitle: {
    color: "var(--text-muted)",
    fontSize: 12,
    marginTop: 4,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
  },
  addBtn: {
    background: "var(--gold)",
    color: "#0f0f0f",
    flexShrink: 0,
    fontWeight: 700,
    padding: "9px 16px",
  },
  tagWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 32,
  },
  tag: {
    alignItems: "center",
    background: "#242424",
    border: "1px solid var(--border)",
    borderRadius: 16,
    color: "var(--gold)",
    display: "inline-flex",
    fontSize: 13,
    gap: 6,
    padding: "4px 12px",
  },
  tagRemove: {
    background: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 11,
    lineHeight: 1,
    padding: 0,
    transition: "color 0.15s",
  },
  emptyHint: {
    color: "var(--text-muted)",
    fontSize: 13,
    fontStyle: "italic",
  },
  scheduleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  scheduleValue: {
    color: "var(--text)",
    fontSize: 16,
  },
  scheduleNum: {
    color: "var(--gold)",
    fontSize: 28,
    fontWeight: 700,
  },
  slider: {
    accentColor: "var(--gold)",
    cursor: "pointer",
    width: "100%",
  },
  sliderLabels: {
    color: "var(--text-muted)",
    display: "flex",
    fontSize: 11,
    justifyContent: "space-between",
  },
  statusGrid: {
    display: "grid",
    gap: 16,
  },
  statBlock: {
    background: "#111",
    borderRadius: 8,
    padding: "12px 16px",
  },
  statLabel: {
    color: "var(--text-muted)",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValue: {
    color: "var(--text)",
    fontSize: 15,
    fontWeight: 500,
  },
  actionBar: {
    alignItems: "center",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    bottom: 24,
    display: "flex",
    justifyContent: "space-between",
    left: "50%",
    maxWidth: 860,
    padding: "14px 24px",
    position: "fixed",
    transform: "translateX(-50%)",
    width: "calc(100% - 40px)",
  },
  actionLeft: {
    flex: 1,
  },
  actionRight: {
    display: "flex",
    gap: 12,
  },
  saveBtn: {
    background: "#2a2a2a",
    border: "1px solid var(--border-hover)",
    color: "var(--text)",
  },
  runBtn: {
    alignItems: "center",
    background: "var(--gold)",
    color: "#0f0f0f",
    display: "flex",
    gap: 8,
    padding: "9px 22px",
  },
  spinner: {
    animation: "spin 0.8s linear infinite",
    border: "2px solid #0f0f0f",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    display: "inline-block",
    height: 14,
    width: 14,
  },
};
