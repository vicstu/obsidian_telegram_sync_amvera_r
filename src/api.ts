import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";

import { activityLog } from "./activity-log";
import {
  ConnectionCheckResult,
  MarkProcessedResponse,
  MessagesResponse,
  StatusResponse,
  TelegramSyncSettings,
} from "./types";

export class TelegramApiClient {
  constructor(private readonly settings: TelegramSyncSettings) {}

  private getServerUrl(): string {
    const url = this.settings.serverUrl.trim();
    if (!url) {
      throw new Error("Server URL is not configured");
    }
    return url.replace(/\/+$/, "");
  }

  private buildUrl(path: string): string {
    return `${this.getServerUrl()}${path}`;
  }

  private async request(
    params: Omit<RequestUrlParam, "headers"> & {
      headers?: Record<string, string>;
    },
    logLabel?: string,
  ): Promise<RequestUrlResponse> {
    const method = (params.method ?? "GET").toUpperCase();
    const label = logLabel ?? `${method} ${params.url}`;
    activityLog.info("api", `Request ${label}`, `${method} ${params.url}`);

    try {
      const response = await requestUrl({
        ...params,
        headers: {
          ...params.headers,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        activityLog.success(
          "api",
          `Response ${label}: HTTP ${response.status}`,
          params.url,
        );
      } else {
        activityLog.warn(
          "api",
          `Response ${label}: HTTP ${response.status}`,
          params.url,
        );
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      activityLog.error("api", `Request failed: ${label}`, message);
      throw error;
    }
  }

  async checkHealth(): Promise<void> {
    const url = this.buildUrl("/health");
    const response = await this.request(
      {
        url,
        method: "GET",
      },
      "health",
    );

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = response.json as { status?: string };
    if (body.status !== "ok") {
      throw new Error("Unexpected health response");
    }
  }

  async checkStatus(): Promise<StatusResponse> {
    const response = await this.request(
      {
        url: this.buildUrl("/api/telegram/status"),
        method: "GET",
      },
      "telegram/status",
    );

    if (response.status !== 200) {
      throw new Error(`Telegram sync unavailable: HTTP ${response.status}`);
    }

    return response.json as StatusResponse;
  }

  async checkConnection(): Promise<ConnectionCheckResult> {
    const processId = activityLog.startProcess(
      "Connection check",
      this.getServerUrl(),
    );
    const result: ConnectionCheckResult = {
      serverOk: false,
      syncReady: false,
    };

    try {
      await this.checkHealth();
      result.serverOk = true;
    } catch (error) {
      result.serverError = error instanceof Error ? error.message : String(error);
      activityLog.endProcess(
        processId,
        "failed",
        "Connection check",
        result.serverError,
      );
      return result;
    }

    try {
      result.status = await this.checkStatus();
      result.syncReady = result.status.sync_ready;
    } catch (error) {
      result.syncError = error instanceof Error ? error.message : String(error);
    }

    if (result.syncReady) {
      activityLog.endProcess(
        processId,
        "done",
        "Connection check — sync ready",
        this.getServerUrl(),
      );
    } else {
      activityLog.endProcess(
        processId,
        "failed",
        "Connection check — sync not ready",
        result.syncError ?? "sync_ready=false",
      );
    }

    return result;
  }

  async fetchMessages(options: { limit?: number }): Promise<MessagesResponse> {
    const response = await this.request(
      {
        url: this.buildUrl("/api/telegram/messages/sync"),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: options.limit,
        }),
      },
      "messages/sync",
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch messages: HTTP ${response.status}`);
    }

    return response.json as MessagesResponse;
  }

  async markProcessed(messageIds: string[]): Promise<MarkProcessedResponse> {
    if (messageIds.length === 0) {
      return { updated: 0, message_ids: [] };
    }

    const response = await this.request(
      {
        url: this.buildUrl("/api/telegram/messages/mark-processed"),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message_ids: messageIds }),
      },
      `mark-processed (${messageIds.length})`,
    );

    if (response.status !== 200) {
      throw new Error(`Failed to mark messages synced: HTTP ${response.status}`);
    }

    return response.json as MarkProcessedResponse;
  }

  async downloadMedia(mediaUrl: string): Promise<ArrayBuffer> {
    const normalized = mediaUrl.replace(/^\/+/, "");
    const url = this.buildUrl(`/api/telegram/media/${normalized}`);
    const response = await this.request(
      {
        url,
        method: "GET",
      },
      `media/${normalized}`,
    );

    if (response.status !== 200) {
      throw new Error(`Failed to download media: HTTP ${response.status}`);
    }

    activityLog.info(
      "api",
      `Downloaded media ${normalized}`,
      `${response.arrayBuffer.byteLength} bytes`,
    );

    return response.arrayBuffer;
  }
}
