import { App, Notice, TFile } from "obsidian";

import { activityLog } from "./activity-log";
import { TelegramApiClient } from "./api";
import {
  appendEntryToFile,
  buildEntryBlock,
  buildInitialTargetFileContent,
  buildAttachmentPath,
  getMessageCreatedTimestampMs,
  isAudioMessage,
  resolveMediaFilename,
} from "./note-builder";
import {
  processTextViaProxyApi,
  transcribeAudioViaProxyApi,
} from "./proxyapi";
import { TelegramMessage, TelegramSyncSettings, TRANSCRIPTION_MODEL, getEffectiveServerUrl } from "./types";
import { loadEntryTemplate } from "./template";
import { getSettingsStrings } from "./settings-i18n";

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const parts = folderPath.replace(/\\/g, "/").split("/").filter(Boolean);

  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

async function ensureParentFolder(app: App, filePath: string): Promise<void> {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 1) {
    return;
  }

  await ensureFolder(app, parts.slice(0, -1).join("/"));
}

export class MessageSyncService {
  constructor(
    private readonly app: App,
    private readonly settings: TelegramSyncSettings,
  ) {}

  private createClient(): TelegramApiClient {
    return new TelegramApiClient(this.settings);
  }

  async syncNewMessages(): Promise<void> {
    await this.syncMessages({ limit: 50, label: "new" });
  }

  private async syncMessages(options: {
    limit?: number;
    label: string;
  }): Promise<void> {
    const strings = getSettingsStrings();

    if (this.settings.syncArchitecture === "direct") {
      new Notice(strings.directNotImplemented, 8000);
      activityLog.warn("sync", strings.directNotImplemented);
      return;
    }

    if (
      !this.settings.useDefaultServer &&
      !this.settings.serverUrl.trim()
    ) {
      new Notice(strings.missingCustomServer, 6000);
      return;
    }

    if (
      !this.settings.useDefaultServer &&
      !this.settings.telegramBotToken.trim()
    ) {
      new Notice(strings.missingBotToken, 6000);
      return;
    }

    if (!this.settings.telegramUserId.trim()) {
      new Notice(strings.telegramCheckMissingUserId, 6000);
      return;
    }

    const client = this.createClient();
    let serverLabel = "server";
    try {
      serverLabel = getEffectiveServerUrl(this.settings);
    } catch {
      // getEffectiveServerUrl may throw; validation above covers the usual cases
    }
    const processId = activityLog.startProcess(
      `Sync ${options.label} messages`,
      `server=${serverLabel} · target=${this.settings.targetFile}`,
    );

    try {
      await ensureFolder(this.app, this.settings.attachmentsFolder);
      await ensureParentFolder(this.app, this.settings.targetFile);

      const { template: entryTemplate, createdPath } = await loadEntryTemplate(
        this.app,
        this.settings,
      );
      if (createdPath) {
        activityLog.info("sync", `Created template ${createdPath}`, undefined, processId);
        new Notice(`Telegram: created template ${createdPath}`, 5000);
      }

      activityLog.info(
        "sync",
        "Fetching messages from sync server",
        `limit=${options.limit ?? "default"}`,
        processId,
      );
      const response = await client.fetchMessages({
        limit: options.limit,
      });

      if (response.count === 0) {
        activityLog.success("sync", "No new messages", undefined, processId);
        activityLog.endProcess(processId, "done", "Sync — no new messages");
        new Notice("Telegram: no new messages");
        return;
      }

      activityLog.info(
        "sync",
        `Received ${response.count} message(s)`,
        undefined,
        processId,
      );

      let created = 0;

      for (const message of response.messages) {
        activityLog.info(
          "sync",
          `Importing message ${message.message_id}`,
          `type=${message.media_type ?? "text"}`,
          processId,
        );
        await this.importMessage(client, message, entryTemplate);
        await client.markProcessed([message.message_id]);
        created += 1;
      }

      activityLog.endProcess(
        processId,
        "done",
        `Sync imported ${created} ${options.label} message(s)`,
      );
      new Notice(`Telegram: imported ${created} ${options.label} message(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      activityLog.endProcess(processId, "failed", "Sync failed", message);
      new Notice(`Telegram sync failed: ${message}`);
      console.error("Telegram sync failed:", error);
    }
  }

  private async importMessage(
    client: TelegramApiClient,
    message: TelegramMessage,
    entryTemplate: string,
  ): Promise<void> {
    const targetPath = this.settings.targetFile.trim();
    if (!targetPath) {
      throw new Error("Target file is not configured");
    }

    const existingFile = this.app.vault.getAbstractFileByPath(targetPath);
    let currentContent = "";

    if (existingFile instanceof TFile) {
      currentContent = await this.app.vault.read(existingFile);
    }

    const { attachmentVaultPath, transcribedText } =
      await this.resolveAttachmentAndTranscription(client, message);

    const messageForEntry: TelegramMessage = {
      ...message,
      transcribed_text: transcribedText,
      transcribed: Boolean(transcribedText?.trim()),
    };

    const entry = buildEntryBlock(
      messageForEntry,
      this.settings,
      attachmentVaultPath,
      entryTemplate,
    );

    if (existingFile instanceof TFile) {
      const updated = appendEntryToFile(currentContent, entry);
      await this.app.vault.modify(existingFile, updated);
      activityLog.success(
        "sync",
        `Appended entry for ${message.message_id}`,
        targetPath,
      );
      return;
    }

    const initialContent = buildInitialTargetFileContent();
    const updated = appendEntryToFile(initialContent, entry);
    await this.app.vault.create(targetPath, updated);
    activityLog.success(
      "sync",
      `Created target file and entry for ${message.message_id}`,
      targetPath,
    );
  }

  private async resolveAttachmentAndTranscription(
    client: TelegramApiClient,
    message: TelegramMessage,
  ): Promise<{
    attachmentVaultPath: string | null;
    transcribedText: string | null;
  }> {
    if (!message.media_url) {
      return {
        attachmentVaultPath: null,
        transcribedText: message.transcribed_text,
      };
    }

    const filename = resolveMediaFilename(message);
    const vaultPath = buildAttachmentPath(this.settings, message, filename);
    const shouldTranscribe = this.shouldTranscribe(message);

    if (
      isAudioMessage(message) &&
      this.settings.transcribeAudio &&
      !this.settings.proxyApiKey.trim()
    ) {
      activityLog.warn(
        "sync",
        "Audio transcription skipped: ProxyAPI key is missing",
        message.message_id,
      );
      new Notice(
        "Telegram: ProxyAPI key is required to transcribe audio",
        6000,
      );
    }

    try {
      const existing = this.app.vault.getAbstractFileByPath(vaultPath);
      let buffer: ArrayBuffer | null = null;

      if (existing instanceof TFile) {
        activityLog.info("sync", `Attachment already in vault`, vaultPath);
        if (shouldTranscribe) {
          buffer = await this.app.vault.readBinary(existing);
        }
      } else {
        activityLog.info(
          "sync",
          `Downloading attachment ${filename}`,
          message.media_url,
        );
        buffer = await client.downloadMedia(message.media_url);
      }

      const savePromise =
        existing instanceof TFile
          ? Promise.resolve(vaultPath)
          : this.saveAttachmentBuffer(message, vaultPath, buffer!);

      const transcriptionPromise = shouldTranscribe
        ? this.transcribeAudioBuffer(message, filename, buffer!)
        : Promise.resolve(message.transcribed_text);

      activityLog.info(
        "sync",
        shouldTranscribe
          ? "Saving attachment and transcribing in parallel"
          : "Saving attachment",
        vaultPath,
      );

      const [attachmentVaultPath, transcribedText] = await Promise.all([
        savePromise,
        transcriptionPromise,
      ]);

      return { attachmentVaultPath, transcribedText };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      activityLog.error(
        "sync",
        `Attachment handling failed for ${message.message_id}`,
        detail,
      );
      console.error("Telegram attachment handling failed:", error);
      new Notice(
        `Telegram: attachment not saved for ${message.message_id}`,
        5000,
      );
      return {
        attachmentVaultPath: null,
        transcribedText: message.transcribed_text,
      };
    }
  }

  private shouldTranscribe(message: TelegramMessage): boolean {
    if (!this.settings.transcribeAudio) {
      return false;
    }
    if (!this.settings.proxyApiKey.trim()) {
      return false;
    }
    return isAudioMessage(message);
  }

  private async saveAttachmentBuffer(
    message: TelegramMessage,
    vaultPath: string,
    buffer: ArrayBuffer,
  ): Promise<string> {
    const timestamp = getMessageCreatedTimestampMs(message.created_at);
    await ensureParentFolder(this.app, vaultPath);
    await this.app.vault.createBinary(vaultPath, buffer, {
      ctime: timestamp,
      mtime: timestamp,
    });
    activityLog.success(
      "sync",
      `Saved attachment for ${message.message_id}`,
      `${vaultPath} (${buffer.byteLength} bytes)`,
    );
    return vaultPath;
  }

  private async transcribeAudioBuffer(
    message: TelegramMessage,
    filename: string,
    buffer: ArrayBuffer,
  ): Promise<string | null> {
    const apiKey = this.settings.proxyApiKey;
    new Notice(`Telegram: transcribing ${message.message_id}…`, 4000);

    const transcription = await transcribeAudioViaProxyApi({
      apiKey,
      model: TRANSCRIPTION_MODEL,
      filename,
      data: buffer,
    });

    if (!transcription.ok || !transcription.text) {
      console.error(
        "Telegram transcription failed:",
        transcription.error ?? "unknown error",
      );
      new Notice(
        `Telegram: transcription failed for ${message.message_id}: ${transcription.error ?? "unknown error"}`,
        8000,
      );
      return message.transcribed_text;
    }

    let text = transcription.text;

    if (this.settings.postProcessTranscription) {
      const processed = await processTextViaProxyApi({
        apiKey,
        model: this.settings.postProcessModel,
        prompt: this.settings.postProcessPrompt,
        text,
      });

      if (!processed.ok || !processed.text) {
        console.error(
          "Telegram transcription post-process failed:",
          processed.error ?? "unknown error",
        );
        new Notice(
          `Telegram: post-process failed for ${message.message_id}, using raw transcript`,
          8000,
        );
      } else {
        text = processed.text;
      }
    }

    activityLog.success(
      "sync",
      `Transcription ready for ${message.message_id}`,
      text,
    );
    return text;
  }
}
