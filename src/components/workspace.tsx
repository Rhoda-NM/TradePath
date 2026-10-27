"use client";
import AccountDeletion from "./account-deletion";
import { InstallGuide } from "./pwa";
import Insights from "./insights";
import type { InsightsData } from "@/lib/insights/model";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import JournalPanel from "./journal/panel";
import type { Journal } from "@/lib/journal/model";
import DailyRemarks from "./daily-remarks";
import TaskOutcome from "./task-outcome";
import Curriculum from "./curriculum";
import WeeklyReview from "./weekly-review";
import {
  phaseNames,
  type Learning,
  type ReviewData,
} from "@/lib/curriculum/model";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  LayoutDashboard,
  ListChecks,
  Plus,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { mutatePractice } from "@/app/practice-actions";
import { signOut } from "@/app/welcome/actions";
import {
  storedSchema,
  empty,
  weekdayTasks,
  weekendTasks,
  isWeekend,
  type Stored,
  type Profile,
  type PracticeCommand,
} from "@/lib/practice/model";
import { localDate, sizePosition, type RiskInput } from "@/lib/trading";

const nav = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "plan", label: "My plan", icon: Flag },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "insights", label: "Insights", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const phases = [
  [
    "Foundations",
    "26 Oct – 25 Nov",
    "Learn the language. Build the routine.",
    "20 annotated charts · 10 risk calculations · Written plan",
  ],
  [
    "Historical testing",
    "26 Nov – 25 Dec",
    "Test the process before the outcome.",
    "70 development samples · 30 held-out samples",
  ],
  [
    "Forward practice",
    "26 Dec – 25 Jan",
    "Observe setups in real time.",
    "Consistent demo sessions · Complete evidence",
  ],
  [
    "Consistency",
    "26 Jan – 25 Feb",
    "Make discipline repeatable.",
    "50 demo executions · 90% adherence · Equity records",
  ],
  [
    "Free simulations",
    "26 Feb – 25 Mar",
    "Practise under documented constraints.",
    "Two documented free evaluations · No breaches",
  ],
  [
    "Independent review",
    "26 Mar – 25 Apr",
    "Reflect, audit, and decide without pressure.",
    "Evidence review · Affordability · Eligibility checks",
  ],
];
function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("tradepath-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("tradepath-change", callback);
  };
}
function getStorage() {
  try {
    return localStorage.getItem("tradepath.workspace.v1") || "";
  } catch {
    return "unavailable";
  }
}
const subscribeHydration = () => () => {};
type Account = {
  deletionConfigured?: boolean;
  insights?: InsightsData;
  journal?: Journal;
  from?: string;
  learning?: Learning;
  review?: ReviewData;
  data: Stored;
  revisions: Record<string, number>;
  taskOutcomes: Record<string, { state: string; reason: string }>;
  profile: Profile;
  today: string;
  phases: {
    phase_number: number;
    planned_start: string;
    planned_end: string;
    state: string;
  }[];
};
export default function Workspace({
  page,
  account,
}: {
  page: string;
  account?: Account;
}) {
  const [cloud, setCloud] = useState<Account | null>(null);
  const activeAccount = cloud || account;
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const decisionOperation = useRef("");
  const taskOperation = useRef<{ signature: string; id: string } | null>(null);
  const href = (path: string) => (account ? path : "/preview" + path);
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(subscribeStorage, getStorage, () => "");
  const stored = useMemo(() => {
    if (!raw) return { data: empty, error: "" };
    try {
      return { data: storedSchema.parse(JSON.parse(raw)), error: "" };
    } catch {
      return {
        data: empty,
        error:
          "Device storage could not be read. Export or clear it before recording new practice.",
      };
    }
  }, [raw]);
  const data = activeAccount?.data || stored.data;
  const timezone = activeAccount?.profile.timezone || "Africa/Nairobi";
  const learning = activeAccount?.learning || account?.learning;
  const learningPhases = learning?.ready
    ? learning.phases
    : activeAccount?.phases;
  const currentPhase =
    learningPhases?.find((p) =>
      ["active", "needs_practice"].includes(p.state),
    ) || learningPhases?.at(-1);
  const phaseNumber = currentPhase?.phase_number || 1;
  const focusLesson = learning?.ready
    ? learning.lessons.find(
        (l) =>
          l.phase_number === phaseNumber &&
          learning.evidence.filter((e) => e.lesson_code === l.code).length <
            l.required_count,
      )
    : undefined;
  const [today, setToday] = useState(account?.today || "");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"skip" | "session" | null>(null);
  const [reason, setReason] = useState("No qualifying setup");
  const [notes, setNotes] = useState("");
  const [emotion, setEmotion] = useState("Calm");
  const [offline, setOffline] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialogRef.current;
    element?.querySelector<HTMLElement>("select, input, button")?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy.current) setDialog(null);
      if (e.key !== "Tab" || !element) return;
      const items = [
        ...element.querySelectorAll<HTMLElement>(
          "button, input, select, textarea, a[href]",
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [dialog]);
  useEffect(() => {
    const updateDate = () => setToday(localDate(new Date(), timezone));
    updateDate();
    const interval = setInterval(updateDate, 30000);
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, [timezone]);
  async function save(next: Stored): Promise<boolean> {
    if (busy.current) return false;
    if (!account) {
      try {
        localStorage.setItem("tradepath.workspace.v1", JSON.stringify(next));
        window.dispatchEvent(new Event("tradepath-change"));
        setMessage("Saved on this device only.");
        return true;
      } catch {
        setMessage("Save failed: device storage is unavailable or full.");
        return false;
      }
    }
    if (!navigator.onLine) {
      setMessage(
        "Offline: this update has not been saved. Reconnect and retry.",
      );
      return false;
    }
    const decision = next.decisions.find(
      (d) => !data.decisions.some((existing) => existing.id === d.id),
    );
    const changedTask =
      (next.days[today] || []).find((t) => !done.includes(t)) ||
      done.find((t) => !(next.days[today] || []).includes(t));
    const revision = activeAccount?.revisions[`${today}:${changedTask}`] || 0;
    if (changedTask) {
      const signature = JSON.stringify([today, changedTask, revision]);
      if (taskOperation.current?.signature !== signature)
        taskOperation.current = { signature, id: crypto.randomUUID() };
    }
    const command = decision
      ? {
          kind: "decision",
          date: today,
          id: decision.id,
          reason: decision.reason,
          notes: decision.notes,
        }
      : changedTask
        ? {
            kind: "task",
            date: today,
            task: changedTask,
            done: (next.days[today] || []).includes(changedTask),
            revision,
            id: taskOperation.current!.id,
          }
        : { kind: "session", date: today, emotion };
    busy.current = true;
    setPending(true);
    setMessage("Saving to your account…");
    try {
      const result = await mutatePractice(command as PracticeCommand);
      if (result.error || !result.workspace) {
        setMessage(result.error || "Save not confirmed. Retry.");
        return false;
      }
      setCloud(result.workspace);
      taskOperation.current = null;
      setMessage("Saved to your account.");
      return true;
    } catch {
      setMessage(
        "Connection interrupted. Save not confirmed; retry to confirm without duplicating the decision.",
      );
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function saveRemarks(
    notes: string,
    expectedNotes: string,
  ): Promise<{ error?: string }> {
    if (!account) {
      const success = await save({
        ...data,
        remarks: { ...data.remarks, [today]: notes.trim() },
      });
      return success
        ? {}
        : {
            error:
              "Device storage is unavailable. Your remarks have not been saved.",
          };
    }
    try {
      const result = await mutatePractice({
        kind: "remarks",
        date: today,
        notes,
        expectedNotes,
      });
      if (result.error || !result.workspace)
        return { error: result.error || "Save not confirmed." };
      setCloud({ ...result.workspace, learning });
      setMessage("Daily journal remarks saved to your account.");
      return {};
    } catch {
      return {
        error: "Save not confirmed. Keep your remarks in this form and retry.",
      };
    }
  }
  async function logout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await signOut();
      if (result.error) {
        setMessage(result.error);
        return;
      }
      try {
        setNotes("");
        setDialog(null);
        localStorage.setItem("tradepath.auth-event", String(Date.now()));
      } catch {
        /* Account data is never cached locally. */
      }
      window.location.replace("/welcome");
    } catch {
      setMessage("Sign-out was not confirmed. Please retry.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  useEffect(() => {
    if (!account) return;
    const signedOut = (event: StorageEvent) => {
      if (event.key === "tradepath.auth-event")
        window.location.replace("/welcome");
    };
    window.addEventListener("storage", signedOut);
    return () => window.removeEventListener("storage", signedOut);
  }, [account]);
  const done = data.days[today] || [];
  const weekend = today ? isWeekend(today) : false;
  const tasks = weekend ? weekendTasks : weekdayTasks;
  const processed =
    done.length +
    tasks.filter(
      (t) => activeAccount?.taskOutcomes[`${today}:${t}`]?.state === "skipped",
    ).length;
  const current = page.split("/")[0];
  const title =
    current === "today"
      ? "Today"
      : current === "plan"
        ? "Your learning path"
        : current === "setups"
          ? "Setup evidence"
          : current === "journal"
            ? "Your journal"
            : current === "insights"
              ? "Process, in perspective"
              : current === "tools"
                ? "Position sizer"
                : current === "funding"
                  ? "Readiness review"
                  : current === "review"
                    ? "Weekly reflection"
                    : current === "settings"
                      ? "Your workspace"
                      : "Page not found";
  async function exportData() {
    if (account) {
      setMessage("Preparing your saved account export…");
      try {
        const response = await fetch("/api/export", { cache: "no-store" });
        if (!response.ok) {
          setMessage(
            "Account export failed. Check the connection and retry after workspace setup is complete.",
          );
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "tradepath-account-export.json";
        link.click();
        URL.revokeObjectURL(url);
        setMessage(
          "Saved account export downloaded. Unsaved form text is not included.",
        );
      } catch {
        setMessage(
          "Connection interrupted. The account export was not downloaded.",
        );
      }
      return;
    }

    const blob = new Blob(
      [!account && stored.error ? raw : JSON.stringify(data, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = account
      ? "tradepath-practice-export.json"
      : "tradepath-device-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href={href("/today")} className="brand">
          <span className="brand-icon">↗</span> TradePath
          <span className="brand-dot">.</span>
        </Link>
        <span className="brand-caption">PROCESS BEFORE PROFIT</span>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              key={n.id}
              href={href("/" + n.id)}
              className={current === n.id ? "nav-link selected" : "nav-link"}
              aria-current={current === n.id ? "page" : undefined}
            >
              <n.icon size={19} />
              {n.label}
              {current === n.id && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <Link href="/guide" className="nav-link">
          <BookOpen size={19} />
          Guide &amp; walkthrough
        </Link>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <ShieldCheck size={23} />
            <strong>Room to learn.</strong>
            <p>
              Demo only. No rush.
              <br />
              Build a process you trust.
            </p>
            <span>LEARNING MODE</span>
          </div>
          <div className="profile">
            <span className="avatar">TP</span>
            <div>
              <strong>Your practice</strong>
              <small>
                {account ? "Account workspace" : "Device workspace"}
              </small>
            </div>
            <Settings2 size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> <strong>{title}</strong>
          </div>
          <div className="top-meta">
            <Link href="/guide" className="workspace-guide-link">
              Guide
            </Link>
            <span className="demo-pill">
              <span /> Demo mode
            </span>
            <span className="timezone">{timezone}</span>
          </div>
        </header>
        <main id="main">
          <div className="storage-banner">
            {offline ? <WifiOff size={14} /> : <ShieldCheck size={14} />}{" "}
            {account
              ? pending
                ? "Saving to your account…"
                : offline
                  ? "Offline · Account changes require a connection."
                  : "Account workspace · Changes are saved after server confirmation."
              : "Local practice workspace · Records stay on this device. No cloud sync."}
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {current === "today"
                  ? today
                    ? new Date(today + "T12:00:00+03:00").toLocaleDateString(
                        "en-GB",
                        {
                          timeZone: "UTC",
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    : "YOUR DAILY PRACTICE"
                  : "PROCESS BEFORE PROFIT"}
              </div>
              <h1>
                {current === "today" ? "Small steps. Stronger habits." : title}
              </h1>
              <p>
                {current === "today"
                  ? "A good trading day starts with a clear process. Let’s focus on yours."
                  : "Build the evidence. Give yourself time to learn."}
              </p>
            </div>
            {current === "today" && (
              <button
                className="button primary"
                disabled={
                  !ready ||
                  pending ||
                  (!!account && offline) ||
                  (!account && !!stored.error)
                }
                onClick={() => setDialog("session")}
              >
                {data.sessions[today] ? "Session check-in" : "Start session"}
                <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          {(message || (!account && stored.error)) && (
            <div role="status" className="status-message">
              {message || (!account && stored.error)}
            </div>
          )}
          {current === "today" && (
            <>
              <section className="hero">
                <div>
                  <span className="pill">
                    PHASE {String(phaseNumber).padStart(2, "0")} / 06
                  </span>
                  <h2>
                    {phaseNumber === 1
                      ? "First, build your foundation."
                      : phaseNames[phaseNumber - 1]}
                  </h2>
                  <p>
                    {phaseNumber === 1
                      ? "Learn the language of risk, read market structure, and make showing up part of your process."
                      : "Keep learning at your own pace. Evidence, not the calendar, determines your next step."}
                  </p>
                  <Link href={href("/plan")} className="text-link">
                    Explore this phase <ArrowRight size={17} />
                  </Link>
                </div>
                <div className="path-art" aria-hidden="true">
                  <div className="path-circle circle-one" />
                  <div className="path-circle circle-two" />
                  <div className="path-circle circle-three" />
                  <span className="path-point p1" />
                  <span className="path-point p2" />
                  <span className="path-point p3" />
                  <Flag className="path-flag" size={30} />
                  <span className="path-caption">
                    ONE DELIBERATE STEP AT A TIME
                  </span>
                </div>
                <div className="hero-footer">
                  <span>
                    <CalendarDays size={15} />{" "}
                    {currentPhase
                      ? `${currentPhase.planned_start} – ${currentPhase.planned_end}`
                      : "26 Oct – 25 Nov 2026"}
                  </span>
                  <span>
                    Evidence unlocks the next phase <ShieldCheck size={15} />
                  </span>
                </div>
              </section>
              {account && (
                <section className="panel focus-card">
                  <div>
                    <span className="eyebrow">
                      {currentPhase?.state === "needs_practice"
                        ? "NEEDS MORE PRACTICE"
                        : "YOUR LEARNING FOCUS"}
                    </span>
                    <h2>
                      {focusLesson?.title ||
                        "Continue documenting your learning"}
                    </h2>
                    <p>
                      {focusLesson
                        ? `Phase ${phaseNumber}, week ${focusLesson.week_number} · ${focusLesson.required_count} evidence records required`
                        : "Learning progress is based on saved evidence."}
                    </p>
                    {learning && !learning.ready && <p>{learning.message}</p>}
                  </div>
                  <div className="focus-actions">
                    <Link
                      className="button secondary"
                      href={`/plan/${phaseNumber}`}
                    >
                      Open lessons
                    </Link>
                    <Link className="button secondary" href="/setups/new">
                      Evaluate a setup
                    </Link>
                    <Link className="button secondary" href="/review">
                      Weekly review
                    </Link>
                  </div>
                </section>
              )}
              {data.sessions[today] === "study_only" && (
                <p className="callout">
                  Study-only today. Chart study, risk exercises and reflection
                  count as practice; no execution is required.
                </p>
              )}
              <div className="stats-grid">
                <Stat
                  label="TODAY’S PROCESS"
                  value={`${processed} / ${tasks.length}`}
                  detail="Done or skipped with a reason"
                  icon={<ListChecks size={18} />}
                />
                <Stat
                  label="DAILY TIME BUDGET"
                  value={`${activeAccount?.profile.available_minutes || 90} min`}
                  detail="A little focus goes a long way"
                  icon={<Clock3 size={18} />}
                />
                <Stat
                  label="RULE ADHERENCE"
                  value="—"
                  detail="Insufficient trade evidence"
                  icon={<ShieldCheck size={18} />}
                />
              </div>
              <div className="content-grid">
                <section className="panel mission">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">YOUR DAILY MISSION</span>
                      <h2>
                        {weekend
                          ? "Pause. Review. Learn."
                          : "Keep it simple. Follow the process."}
                      </h2>
                    </div>
                    <span className="small-tag">
                      {weekend ? "Weekend review" : phaseNames[phaseNumber - 1]}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${(processed / tasks.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="task-list">
                    {tasks.map((t, i) => (
                      <div key={t} className="task-entry">
                        <button
                          disabled={
                            !ready ||
                            pending ||
                            (!!account && offline) ||
                            (!account && !!stored.error)
                          }
                          className={
                            "task " + (done.includes(t) ? "task-done" : "")
                          }
                          key={t}
                          onClick={() =>
                            save({
                              ...data,
                              days: {
                                ...data.days,
                                [today]: done.includes(t)
                                  ? done.filter((x) => x !== t)
                                  : [...done, t],
                              },
                            })
                          }
                          aria-pressed={done.includes(t)}
                        >
                          <span className="task-check">
                            {done.includes(t) ? <Check size={15} /> : null}
                          </span>
                          <span>
                            <strong>{t}</strong>
                            <small>
                              {
                                (weekend
                                  ? [
                                      "Select a chart without hindsight.",
                                      "Include costs and broker minimums.",
                                      "Keep skipped decisions and losses visible.",
                                      "Write one commitment for next week.",
                                    ]
                                  : phaseNumber === 2
                                    ? [
                                        "Check the candidate’s historical event window.",
                                        "Inspect the next sequential historical candidate.",
                                        "Keep development and held-out evidence separate.",
                                        "Do not use candles unavailable at the decision time.",
                                        "Record all outcomes, including rejected candidates.",
                                      ]
                                    : [
                                        "Start with context, not a prediction.",
                                        "Use confirmed swings and the EMA50.",
                                        "Write the plan before the signal.",
                                        "Wait for confirmation. Skipping is valid.",
                                        "Capture what you learned today.",
                                      ])[i]
                              }
                            </small>
                          </span>
                          <span className="task-order">0{i + 1}</span>
                        </button>
                        {account && (
                          <TaskOutcome
                            key={`${today}:${t}:${activeAccount?.revisions[`${today}:${t}`] || 0}`}
                            date={today}
                            task={t}
                            revision={
                              activeAccount?.revisions[`${today}:${t}`] || 0
                            }
                            state={
                              activeAccount?.taskOutcomes[`${today}:${t}`]
                                ?.state || "pending"
                            }
                            reason={
                              activeAccount?.taskOutcomes[`${today}:${t}`]
                                ?.reason || ""
                            }
                            disabled={pending || offline}
                            onSaved={(value) =>
                              setCloud({ ...value, learning })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mission-note">
                    <ShieldCheck size={16} />
                    <span>
                      No qualifying setup? A well-reasoned no-trade day counts.
                    </span>
                  </div>
                  {today && (
                    <DailyRemarks
                      key="daily-remarks"
                      date={today}
                      saved={data.remarks?.[today] || ""}
                      account={!!account}
                      onSave={saveRemarks}
                    />
                  )}
                </section>
                <div className="right-stack">
                  <section className="panel reminder">
                    <span className="icon-tile">
                      <Target size={21} />
                    </span>
                    <span className="eyebrow">A NOTE TO TRADE BY</span>
                    <h2>
                      You don’t have to trade
                      <br />
                      to make progress.
                    </h2>
                    <p>
                      Your job is to follow the rules. Some days, the best
                      decision is to sit out.
                    </p>
                    <button
                      className="button secondary"
                      disabled={
                        !ready ||
                        pending ||
                        (!!account && offline) ||
                        (!account && !!stored.error)
                      }
                      onClick={() => setDialog("skip")}
                    >
                      Record a no-trade decision <ArrowRight size={16} />
                    </button>
                  </section>
                  <Link href={href("/tools/risk")} className="tool-card">
                    <span className="icon-tile">
                      <ShieldCheck size={21} />
                    </span>
                    <div>
                      <strong>Know your risk first.</strong>
                      <p>Open the position sizer</p>
                    </div>
                    <ArrowUpRight size={20} />
                  </Link>
                </div>
              </div>
              <section className="bottom-note">
                <span className="eyebrow">THE LONG GAME</span>
                <p>Consistency is built in decisions, not in a day.</p>
                <Link href={href("/plan")}>
                  View your six-month path <ArrowRight size={15} />
                </Link>
              </section>
            </>
          )}
          {current === "plan" && account && learning && (
            <Curriculum
              learning={learning}
              phase={
                page.split("/")[1] ? Number(page.split("/")[1]) : undefined
              }
              today={today}
              startDate={activeAccount!.profile.start_date}
              onSaved={(value) =>
                setCloud({
                  ...activeAccount!,
                  learning: value,
                  phases: value.ready ? value.phases : activeAccount!.phases,
                })
              }
            />
          )}
          {current === "review" && account?.review && (
            <WeeklyReview
              key={page}
              initial={account.review}
              today={localDate(new Date(), "Africa/Nairobi")}
              startDate={account.profile.start_date}
            />
          )}
          {current === "plan" && !account && (
            <div className="phase-list">
              {phases.map((p, i) => (
                <section
                  className={"panel phase " + (!i ? "active-phase" : "")}
                  key={p[0]}
                >
                  <span className="phase-number">0{i + 1}</span>
                  <div>
                    <span className="eyebrow">
                      {activeAccount?.phases[i]
                        ? `${activeAccount.phases[i].planned_start} – ${activeAccount.phases[i].planned_end}`
                        : p[1]}{" "}
                      · {i === 0 ? "CURRENT PHASE" : "EVIDENCE GATED"}
                    </span>
                    <h2>{p[0]}</h2>
                    <p>{p[2]}</p>
                    <small>{p[3]}</small>
                  </div>
                  <span className="small-tag">
                    {i === 0 ? "In progress" : "Not started"}
                  </span>
                </section>
              ))}
              <p className="muted">
                Dates guide practice. No phase is automatically passed;
                milestone verification requires evidence capture in the next
                phase.
              </p>
            </div>
          )}
          {["journal", "setups"].includes(current) && account?.journal && (
            <JournalPanel
              key={page}
              journal={account.journal}
              path={page}
              from={account.from}
              timezone={timezone}
            />
          )}
          {current === "journal" && page === "journal" && (
            <>
              <section className="panel info-block daily-remarks-history">
                <h2>Daily journal remarks</h2>
                <p>Your dated reflections, separate from trade results.</p>
                {Object.entries(data.remarks || {})
                  .filter(([, text]) => text.trim())
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, text]) => (
                    <article className="evidence-record" key={date}>
                      <span className="eyebrow">{date}</span>
                      <p>{text}</p>
                    </article>
                  ))}
                {!Object.values(data.remarks || {}).some((text) =>
                  text.trim(),
                ) && (
                  <p>
                    No remarks yet. Add your first entry below Today’s mission.
                  </p>
                )}
                <Link className="text-link dark-link" href={href("/today")}>
                  Write today’s remarks →
                </Link>
              </section>

              <div className="toolbar">
                <span className="small-tag">
                  No-trade decisions ·{" "}
                  {account ? "your account" : "device only"}
                </span>
                <button
                  className="button primary"
                  onClick={() => setDialog("skip")}
                  disabled={
                    !ready ||
                    pending ||
                    (!!account && offline) ||
                    (!account && !!stored.error)
                  }
                >
                  <Plus size={16} /> Record decision
                </button>
              </div>
              <section className="panel">
                {data.decisions.length ? (
                  data.decisions.map((d) => (
                    <article className="journal-row" key={d.id}>
                      <span className="icon-tile">
                        <BookOpen size={20} />
                      </span>
                      <div>
                        <span className="eyebrow">
                          {d.date} · NO TRADE · NO P/L
                        </span>
                        <h3>{d.reason}</h3>
                        <p>{d.notes || "No additional notes."}</p>
                      </div>
                      <span className="small-tag">
                        {account ? "Account record" : "Device only"}
                      </span>
                    </article>
                  ))
                ) : (
                  <Empty
                    icon={<BookOpen size={30} />}
                    title="Every decision has a place."
                    text="Record why you sat out. A no-trade decision is part of your learning history, with no profit or loss attached."
                  />
                )}
              </section>
              <p className="muted">
                Daily remarks and no-trade decisions remain separate from
                execution results.
              </p>
            </>
          )}
          {current === "insights" && account?.journal && account.insights && (
            <Insights journal={account.journal} data={account.insights} />
          )}
          {current === "insights" && !account && (
            <>
              <div className="stats-grid">
                <Stat
                  label="DEMO REALISED TRADES"
                  value="0"
                  detail="Backtests are kept separate"
                  icon={<BookOpen size={18} />}
                />
                <Stat
                  label="AFTER-COST AVERAGE R"
                  value="—"
                  detail="Insufficient data"
                  icon={<TrendingUp size={18} />}
                />
                <Stat
                  label="MAXIMUM DRAWDOWN"
                  value="—"
                  detail="Equity history unavailable"
                  icon={<ShieldCheck size={18} />}
                />
              </div>
              <section className="panel">
                <Empty
                  icon={<TrendingUp size={30} />}
                  title="Evidence first. Insights follow."
                  text="Your performance metrics will appear after closed demo trades and account equity records are available. No score is inferred from missing data."
                />
              </section>
              <div className="panel info-block">
                <h2>Your process matters too.</h2>
                <p>
                  {data.decisions.length} no-trade decisions recorded in this
                  {account ? "account" : "device workspace"}. These are separate
                  from trade-rule adherence and realised performance.
                </p>
                <Link href={href("/funding")} className="text-link dark-link">
                  Review readiness evidence <ArrowRight size={16} />
                </Link>
              </div>
            </>
          )}
          {current === "tools" && <RiskCalculator />}
          {current === "funding" && account?.journal && account.insights && (
            <Insights
              journal={account.journal}
              data={account.insights}
              funding
            />
          )}
          {current === "funding" && !account && (
            <section className="panel info-block">
              <span className="small-tag">Insufficient data</span>
              <h2>Readiness requires evidence.</h2>
              <p>
                100 historical samples including 30 held-out examples; 50 demo
                executions; positive after-cost expectancy; at least 90%
                adherence; measured drawdown below 5%; two free evaluations; and
                independently confirmed eligibility and affordability.
              </p>
              <p>
                No evidence has been verified. This review never unlocks live
                orders or guarantees funding.
              </p>
            </section>
          )}
          {current === "settings" && (
            <section className="panel settings-panel">
              <Link href="/guide" className="button secondary">
                Read the app walkthrough →
              </Link>
              <InstallGuide />
              <h2>Practice preferences</h2>
              <div className="setting-row">
                <span>Timezone</span>
                <strong>{timezone}</strong>
              </div>
              <div className="setting-row">
                <span>Trading mode</span>
                <strong>Demo only</strong>
              </div>
              <div className="setting-row">
                <span>Strategy</span>
                <strong>H4H1-v1 · Experimental</strong>
              </div>
              <div className="setting-row">
                <span>Storage</span>
                <strong>
                  {account
                    ? "Your account · Online saves"
                    : "This browser only · No sync"}
                </strong>
              </div>
              {!account && (
                <Link className="button primary" href="/welcome">
                  Sign in to an account
                </Link>
              )}
              {account && (
                <AccountDeletion configured={!!account.deletionConfigured} />
              )}
              <h2>Your data</h2>
              <p>
                {account
                  ? "Download your saved practice, learning evidence and reviews. Previous device-only records remain separate and can be exported in the device workspace."
                  : "Export your device workspace before clearing it. This browser storage is not an account backup."}
              </p>
              {account && (
                <>
                  <Link className="button secondary" href="/onboarding">
                    Edit preferences
                  </Link>
                  <Link className="button secondary" href="/preview/settings">
                    Previous device records
                  </Link>
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={logout}
                  >
                    Sign out of this device
                  </button>
                </>
              )}
              {account && (
                <Link className="button secondary" href="/plan">
                  Learning evidence
                </Link>
              )}
              <button className="button secondary" onClick={exportData}>
                {account
                  ? "Export saved account data (JSON)"
                  : "Export device data (JSON)"}
              </button>
              {!account && (
                <button
                  className="button danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Permanently clear the practice records saved in this browser? Export them first if needed.",
                      )
                    )
                      save(empty);
                  }}
                >
                  Clear device records
                </button>
              )}
            </section>
          )}
          {![
            "today",
            "plan",
            "journal",
            "insights",
            "tools",
            "funding",
            "settings",
            "review",
            "setups",
          ].includes(current) && (
            <Link href={href("/today")} className="button primary">
              Return to Today
            </Link>
          )}
          <footer>
            TradePath <span>·</span> Education and journaling only. Market
            decisions and losses remain your responsibility.
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <Link
            aria-current={current === n.id ? "page" : undefined}
            className={current === n.id ? "selected" : ""}
            href={href("/" + n.id)}
            key={n.id}
          >
            <n.icon size={20} />
            <span>{n.id === "plan" ? "Plan" : n.label}</span>
          </Link>
        ))}
      </nav>
      {dialog && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <h2 id="dialog-title">
              {dialog === "skip"
                ? "A deliberate decision."
                : "Before you begin."}
            </h2>
            <p>
              {dialog === "skip"
                ? "Capture why sitting out supports your process."
                : "Check in with yourself. There is no pressure to trade."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                let saved = false;
                if (dialog === "skip")
                  saved = await save({
                    ...data,
                    decisions: [
                      {
                        id: (decisionOperation.current ||= crypto.randomUUID()),
                        date: today,
                        reason,
                        notes: notes.trim(),
                      },
                      ...data.decisions,
                    ],
                  });
                else
                  saved = await save({
                    ...data,
                    sessions: {
                      ...data.sessions,
                      [today]: emotion === "Calm" ? "active" : "study_only",
                    },
                  });
                if (saved) {
                  setDialog(null);
                  setNotes("");
                  decisionOperation.current = "";
                }
              }}
            >
              {dialog === "skip" ? (
                <>
                  <label>
                    Reason
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      <option>No qualifying setup</option>
                      <option>High-impact news window</option>
                      <option>Risk exceeds broker minimum</option>
                      <option>Daily risk limit reached</option>
                      <option>Study-only session</option>
                    </select>
                  </label>
                  <label>
                    What did you observe?
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={2000}
                      placeholder="A short note for your future self…"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    How are you arriving today?
                    <select
                      value={emotion}
                      onChange={(e) => setEmotion(e.target.value)}
                    >
                      <option>Calm</option>
                      <option>Distracted</option>
                      <option>Fatigued</option>
                      <option>Pressure to recover</option>
                    </select>
                  </label>
                  <div className="callout">
                    {emotion === "Calm"
                      ? "Review your risk rules and focus on learning."
                      : "Study-only is the default today. Fatigue or pressure can make consistent decisions harder. This app cannot stop external executions."}
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={pending}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  type="submit"
                  disabled={pending || (!!account && offline)}
                >
                  {dialog === "skip"
                    ? account
                      ? "Save to my account"
                      : "Save on this device"
                    : emotion === "Calm"
                      ? "Begin practice"
                      : "Begin study-only"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="panel stat">
      <div>
        <span className="eyebrow">{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function RiskCalculator() {
  const [input, setInput] = useState<RiskInput>({
    balance: 10000,
    currency: "KES",
    rate: 129.89,
    side: "buy",
    entry: 1.08,
    stop: 1.078,
    riskPercent: 0.5,
    pipCost: 1,
    commission: 0,
    minLot: 0.01,
    lotStep: 0.01,
  });
  let result: ReturnType<typeof sizePosition> | undefined;
  let error = "";
  try {
    result = sizePosition(input);
  } catch {
    error =
      "Enter positive values, risk at most 0.5%, and a stop on the correct side of entry.";
  }
  const fields: { key: keyof RiskInput; label: string; step: string }[] = [
    { key: "balance", label: "Account balance", step: "any" },
    { key: "rate", label: "Manual USD/KES reference rate", step: "any" },
    { key: "entry", label: "Entry price", step: "any" },
    { key: "stop", label: "Stop price", step: "any" },
    { key: "riskPercent", label: "Risk budget (%)", step: ".1" },
    { key: "pipCost", label: "Spread / slippage allowance (pips)", step: ".1" },
    {
      key: "commission",
      label: "Commission per standard lot (USD)",
      step: ".1",
    },
    { key: "minLot", label: "Broker minimum lot", step: ".001" },
    { key: "lotStep", label: "Broker lot increment", step: ".001" },
  ];
  return (
    <div className="calculator-grid">
      <section className="panel info-block">
        <h2>Size for the risk you can take.</h2>
        <p>EUR/USD · Approximate pip value USD 10 / standard lot</p>
        <div className="form-grid">
          <label>
            Currency
            <select
              value={input.currency}
              onChange={(e) =>
                setInput({
                  ...input,
                  currency: e.target.value as "KES" | "USD",
                })
              }
            >
              <option>KES</option>
              <option>USD</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={input.side}
              onChange={(e) =>
                setInput({ ...input, side: e.target.value as "buy" | "sell" })
              }
            >
              <option value="buy">BUY</option>
              <option value="sell">SELL</option>
            </select>
          </label>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type="number"
                step={f.step}
                value={Number.isNaN(input[f.key]) ? "" : input[f.key]}
                onChange={(e) =>
                  setInput({
                    ...input,
                    [f.key]:
                      e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>
      <section className="panel info-block risk-result" aria-live="polite">
        <ShieldCheck size={30} />
        <h2>
          {error
            ? "Check your inputs"
            : result?.skip
              ? "Skip this position."
              : "Modeled position size"}
        </h2>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          result && (
            <>
              <strong className="result-value">
                {result.skip ? "Below minimum" : `${result.lots} lots`}
              </strong>
              <p>Risk budget: USD {result.riskUSD.toFixed(4)}</p>
              <p>Stop distance: {result.distancePips.toFixed(2)} pips</p>
              <p>Rounded down: {result.lots} lots</p>
              <p>
                {result.skip
                  ? "The broker minimum would exceed this risk budget. Do not round up."
                  : "This estimate stays within the modeled risk budget."}
              </p>
            </>
          )
        )}
        <div className="callout">
          Manual exchange-rate assumption, not a live quote. Actual spread and
          slippage may exceed this model. A calculated size is not setup
          eligibility.
        </div>
      </section>
    </div>
  );
}
