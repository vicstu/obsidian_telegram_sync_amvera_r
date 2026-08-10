import { Editor, Notice, Plugin } from "obsidian";

import { activityLog } from "./activity-log";
import { openActivityLogModal } from "./activity-log-modal";
import {
  fetchProxyApiBalance,
  formatProxyApiBalance,
} from "./proxyapi";
import { TelegramSyncSettingTab, mergeSettings } from "./settings";
import { MessageSyncService } from "./sync";
import { transcribeAudioUnderCursor } from "./transcribe-under-cursor";
import { TelegramSyncSettings } from "./types";

export default class TelegramSyncPlugin extends Plugin {
  settings!: TelegramSyncSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new TelegramSyncSettingTab(this.app, this));

    this.addCommand({
      id: "obsidian-telegram-sync-amvera-fetch-messages",
      name: "Fetch new messages",
      callback: () => {
        activityLog.info("command", "Command: Fetch new messages");
        void this.syncNewMessages();
      },
    });

    this.addCommand({
      id: "obsidian-telegram-sync-amvera-transcribe-audio-under-cursor",
      name: "Transcribe audio under cursor / selection",
      editorCallback: (editor: Editor, ctx) => {
        activityLog.info(
          "command",
          "Command: Transcribe audio under cursor / selection",
        );
        void transcribeAudioUnderCursor(
          this.app,
          editor,
          ctx.file ?? null,
          this.settings,
        );
      },
    });

    this.addCommand({
      id: "obsidian-telegram-sync-amvera-check-proxyapi-balance",
      name: "Check ProxyAPI balance",
      callback: () => {
        activityLog.info("command", "Command: Check ProxyAPI balance");
        void this.checkProxyApiBalance();
      },
    });

    this.addCommand({
      id: "obsidian-telegram-sync-amvera-open-activity-log",
      name: "Open activity log",
      callback: () => {
        activityLog.info("command", "Command: Open activity log");
        openActivityLogModal(this.app);
      },
    });

    activityLog.info("system", "Plugin loaded");
  }

  onunload(): void {
    activityLog.info("system", "Plugin unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = mergeSettings(
      (await this.loadData()) as Partial<TelegramSyncSettings> | null,
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private createSyncService(): MessageSyncService {
    return new MessageSyncService(this.app, this.settings);
  }

  async syncNewMessages(): Promise<void> {
    new Notice("Telegram: fetching new messages...");
    await this.createSyncService().syncNewMessages();
  }

  async checkProxyApiBalance(): Promise<void> {
    if (!this.settings.proxyApiKey.trim()) {
      new Notice("ProxyAPI key is not configured", 6000);
      return;
    }

    new Notice("ProxyAPI: checking balance…");
    const result = await fetchProxyApiBalance(this.settings.proxyApiKey);

    if (!result.ok || !result.balance) {
      new Notice(result.error ?? "Failed to load ProxyAPI balance", 8000);
      return;
    }

    const formatted = formatProxyApiBalance(result.balance);
    new Notice(`ProxyAPI balance: ${formatted}`, 8000);
  }
}
