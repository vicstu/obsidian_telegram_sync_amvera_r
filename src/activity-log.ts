export type ActivityLevel = "info" | "success" | "warn" | "error";

export interface ActivityEntry {
  id: string;
  at: number;
  level: ActivityLevel;
  category: string;
  message: string;
  detail?: string;
  processId?: string;
}

export interface ActivityProcess {
  id: string;
  name: string;
  startedAt: number;
  status: "running" | "done" | "failed";
  detail?: string;
  endedAt?: number;
}

type ActivityListener = () => void;

const MAX_ENTRIES = 300;
const MAX_FINISHED_PROCESSES = 40;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ActivityLog {
  private entries: ActivityEntry[] = [];
  private processes = new Map<string, ActivityProcess>();
  private listeners = new Set<ActivityListener>();

  subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  log(
    level: ActivityLevel,
    category: string,
    message: string,
    detail?: string,
    processId?: string,
  ): ActivityEntry {
    const entry: ActivityEntry = {
      id: nextId("log"),
      at: Date.now(),
      level,
      category,
      message,
      detail,
      processId,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    this.notify();
    return entry;
  }

  info(category: string, message: string, detail?: string, processId?: string): void {
    this.log("info", category, message, detail, processId);
  }

  success(
    category: string,
    message: string,
    detail?: string,
    processId?: string,
  ): void {
    this.log("success", category, message, detail, processId);
  }

  warn(category: string, message: string, detail?: string, processId?: string): void {
    this.log("warn", category, message, detail, processId);
  }

  error(
    category: string,
    message: string,
    detail?: string,
    processId?: string,
  ): void {
    this.log("error", category, message, detail, processId);
  }

  startProcess(name: string, detail?: string): string {
    const id = nextId("proc");
    this.processes.set(id, {
      id,
      name,
      startedAt: Date.now(),
      status: "running",
      detail,
    });
    this.info("process", `Started: ${name}`, detail, id);
    this.notify();
    return id;
  }

  endProcess(
    processId: string,
    status: "done" | "failed",
    message?: string,
    detail?: string,
  ): void {
    const process = this.processes.get(processId);
    if (!process) {
      return;
    }

    process.status = status;
    process.endedAt = Date.now();
    if (detail) {
      process.detail = detail;
    }

    const label = message ?? process.name;
    if (status === "done") {
      this.success("process", `Finished: ${label}`, process.detail, processId);
    } else {
      this.error("process", `Failed: ${label}`, process.detail, processId);
    }

    this.trimFinishedProcesses();
    this.notify();
  }

  private trimFinishedProcesses(): void {
    const finished = [...this.processes.values()]
      .filter((p) => p.status !== "running")
      .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));

    const overflow = finished.length - MAX_FINISHED_PROCESSES;
    if (overflow <= 0) {
      return;
    }

    for (const process of finished.slice(0, overflow)) {
      this.processes.delete(process.id);
    }
  }

  getEntries(): ActivityEntry[] {
    return [...this.entries].reverse();
  }

  getRunningProcesses(): ActivityProcess[] {
    return [...this.processes.values()]
      .filter((p) => p.status === "running")
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  getRecentProcesses(): ActivityProcess[] {
    return [...this.processes.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  clear(): void {
    this.entries = [];
    for (const [id, process] of this.processes) {
      if (process.status !== "running") {
        this.processes.delete(id);
      }
    }
    this.info("system", "Activity log cleared");
  }
}

/** Shared in-memory activity log for the plugin lifetime. */
export const activityLog = new ActivityLog();

export function formatActivityTime(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${String(date.getMilliseconds()).padStart(3, "0")}`
  );
}
