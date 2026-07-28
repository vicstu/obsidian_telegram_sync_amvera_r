import { App, Modal, Setting } from "obsidian";

import {
  ActivityEntry,
  ActivityProcess,
  activityLog,
  formatActivityTime,
} from "./activity-log";

export class ActivityLogModal extends Modal {
  private unsubscribe: (() => void) | null = null;
  private processesEl!: HTMLElement;
  private entriesEl!: HTMLElement;

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Telegram Sync — Activity log");
    this.modalEl.addClass("telegram-sync-activity-modal");
    this.modalEl.style.width = "720px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.userSelect = "text";
    this.modalEl.style.webkitUserSelect = "text";
    this.contentEl.style.userSelect = "text";
    this.contentEl.style.webkitUserSelect = "text";

    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Live process view")
      .setDesc("Running and recent operations, commands, and API calls.")
      .addButton((button) => {
        button.setButtonText("Clear").onClick(() => {
          activityLog.clear();
        });
      })
      .addButton((button) => {
        button.setButtonText("Close").onClick(() => this.close());
      });

    contentEl.createEl("h4", { text: "Processes" });
    this.processesEl = contentEl.createDiv({
      cls: "telegram-sync-activity-processes",
    });
    this.processesEl.style.maxHeight = "160px";
    this.processesEl.style.overflow = "auto";
    this.processesEl.style.marginBottom = "1em";
    this.processesEl.style.fontFamily = "var(--font-monospace)";
    this.processesEl.style.fontSize = "12px";
    this.processesEl.style.lineHeight = "1.45";
    this.processesEl.style.padding = "0.5em 0.75em";
    this.processesEl.style.border = "1px solid var(--background-modifier-border)";
    this.processesEl.style.borderRadius = "6px";
    this.processesEl.style.background = "var(--background-secondary)";
    this.processesEl.style.userSelect = "text";
    this.processesEl.style.webkitUserSelect = "text";

    contentEl.createEl("h4", { text: "Event log" });
    this.entriesEl = contentEl.createDiv({
      cls: "telegram-sync-activity-entries",
    });
    this.entriesEl.style.maxHeight = "420px";
    this.entriesEl.style.overflow = "auto";
    this.entriesEl.style.fontFamily = "var(--font-monospace)";
    this.entriesEl.style.fontSize = "12px";
    this.entriesEl.style.lineHeight = "1.45";
    this.entriesEl.style.padding = "0.5em 0.75em";
    this.entriesEl.style.border = "1px solid var(--background-modifier-border)";
    this.entriesEl.style.borderRadius = "6px";
    this.entriesEl.style.background = "var(--background-secondary)";
    this.entriesEl.style.whiteSpace = "pre-wrap";
    this.entriesEl.style.wordBreak = "break-word";
    this.entriesEl.style.userSelect = "text";
    this.entriesEl.style.webkitUserSelect = "text";

    this.render();
    this.unsubscribe = activityLog.subscribe(() => this.render());
  }

  onClose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.contentEl.empty();
  }

  private render(): void {
    this.renderProcesses();
    this.renderEntries();
  }

  private renderProcesses(): void {
    this.processesEl.empty();
    const processes = activityLog.getRecentProcesses();

    if (processes.length === 0) {
      this.processesEl.createDiv({ text: "No processes yet." });
      return;
    }

    for (const process of processes) {
      this.processesEl.appendChild(this.buildProcessRow(process));
    }
  }

  private buildProcessRow(process: ActivityProcess): HTMLElement {
    const row = document.createElement("div");
    row.style.marginBottom = "0.35em";

    const statusColor =
      process.status === "running"
        ? "var(--color-accent)"
        : process.status === "done"
          ? "var(--text-success)"
          : "var(--text-error)";

    const status = document.createElement("span");
    status.textContent = `[${process.status}]`;
    status.style.color = statusColor;
    status.style.fontWeight = "600";
    status.style.marginRight = "0.5em";

    const time = document.createElement("span");
    time.textContent = formatActivityTime(process.startedAt);
    time.style.opacity = "0.7";
    time.style.marginRight = "0.5em";

    const name = document.createElement("span");
    name.textContent = process.name;

    row.appendChild(status);
    row.appendChild(time);
    row.appendChild(name);

    if (process.detail) {
      const detail = document.createElement("div");
      detail.textContent = process.detail;
      detail.style.opacity = "0.75";
      detail.style.paddingLeft = "1em";
      detail.style.whiteSpace = "pre-wrap";
      detail.style.wordBreak = "break-word";
      row.appendChild(detail);
    }

    return row;
  }

  private renderEntries(): void {
    this.entriesEl.empty();
    const entries = activityLog.getEntries();

    if (entries.length === 0) {
      this.entriesEl.createDiv({ text: "No events yet." });
      return;
    }

    for (const entry of entries) {
      this.entriesEl.appendChild(this.buildEntryRow(entry));
    }
  }

  private buildEntryRow(entry: ActivityEntry): HTMLElement {
    const row = document.createElement("div");
    row.style.marginBottom = "0.4em";
    row.style.borderBottom = "1px solid var(--background-modifier-border)";
    row.style.paddingBottom = "0.35em";

    const header = document.createElement("div");

    const time = document.createElement("span");
    time.textContent = formatActivityTime(entry.at);
    time.style.opacity = "0.7";
    time.style.marginRight = "0.5em";

    const level = document.createElement("span");
    level.textContent = entry.level.toUpperCase();
    level.style.fontWeight = "600";
    level.style.marginRight = "0.5em";
    level.style.color = this.levelColor(entry.level);

    const category = document.createElement("span");
    category.textContent = `[${entry.category}]`;
    category.style.opacity = "0.8";
    category.style.marginRight = "0.5em";

    const message = document.createElement("span");
    message.textContent = entry.message;

    header.appendChild(time);
    header.appendChild(level);
    header.appendChild(category);
    header.appendChild(message);
    row.appendChild(header);

    if (entry.detail) {
      const detail = document.createElement("div");
      detail.textContent = entry.detail;
      detail.style.opacity = "0.75";
      detail.style.paddingLeft = "0.25em";
      detail.style.marginTop = "0.15em";
      detail.style.whiteSpace = "pre-wrap";
      detail.style.wordBreak = "break-word";
      row.appendChild(detail);
    }

    return row;
  }

  private levelColor(level: ActivityEntry["level"]): string {
    switch (level) {
      case "success":
        return "var(--text-success)";
      case "warn":
        return "var(--text-warning)";
      case "error":
        return "var(--text-error)";
      default:
        return "var(--text-muted)";
    }
  }
}

export function openActivityLogModal(app: App): void {
  new ActivityLogModal(app).open();
}
