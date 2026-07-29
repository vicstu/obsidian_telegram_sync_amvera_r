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

    new Setting(contentEl).setName("Processes").setHeading();
    this.processesEl = contentEl.createDiv({
      cls: "telegram-sync-activity-panel",
    });

    new Setting(contentEl).setName("Event log").setHeading();
    this.entriesEl = contentEl.createDiv({
      cls: "telegram-sync-activity-panel is-entries",
    });

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
      this.appendProcessRow(this.processesEl, process);
    }
  }

  private appendProcessRow(
    parent: HTMLElement,
    process: ActivityProcess,
  ): void {
    const row = parent.createDiv({ cls: "telegram-sync-activity-process" });

    row.createSpan({
      cls: `telegram-sync-activity-status is-${process.status}`,
      text: `[${process.status}]`,
    });

    row.createSpan({
      cls: "telegram-sync-activity-time",
      text: formatActivityTime(process.startedAt),
    });

    row.createSpan({ text: process.name });

    if (process.detail) {
      row.createDiv({
        cls: "telegram-sync-activity-detail",
        text: process.detail,
      });
    }
  }

  private renderEntries(): void {
    this.entriesEl.empty();
    const entries = activityLog.getEntries();

    if (entries.length === 0) {
      this.entriesEl.createDiv({ text: "No events yet." });
      return;
    }

    for (const entry of entries) {
      this.appendEntryRow(this.entriesEl, entry);
    }
  }

  private appendEntryRow(parent: HTMLElement, entry: ActivityEntry): void {
    const row = parent.createDiv({ cls: "telegram-sync-activity-entry" });
    const header = row.createDiv();

    header.createSpan({
      cls: "telegram-sync-activity-time",
      text: formatActivityTime(entry.at),
    });

    header.createSpan({
      cls: `telegram-sync-activity-level is-${entry.level}`,
      text: entry.level.toUpperCase(),
    });

    header.createSpan({
      cls: "telegram-sync-activity-category",
      text: `[${entry.category}]`,
    });

    header.createSpan({ text: entry.message });

    if (entry.detail) {
      row.createDiv({
        cls: "telegram-sync-activity-entry-detail",
        text: entry.detail,
      });
    }
  }
}

export function openActivityLogModal(app: App): void {
  new ActivityLogModal(app).open();
}
