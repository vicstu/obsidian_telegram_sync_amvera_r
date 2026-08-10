import { App, ButtonComponent, Notice, PluginSettingTab, Setting } from "obsidian";

import { TelegramApiClient } from "./api";
import TelegramSyncPlugin from "./main";
import {
  fetchProxyApiBalance,
  formatProxyApiBalance,
} from "./proxyapi";
import { getSettingsStrings } from "./settings-i18n";
import { checkTelegramBotAccess } from "./telegram-access";
import {
  DEFAULT_POST_PROCESS_PROMPT,
  DEFAULT_SERVER_API_TOKEN,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATE_FILE,
  DEFAULT_TARGET_FILE,
  mergeSettings,
  POST_PROCESS_MODELS,
  resolvePostProcessModel,
  TRANSCRIPTION_MODEL,
} from "./types";

export class TelegramSyncSettingTab extends PluginSettingTab {
  plugin: TelegramSyncPlugin;

  constructor(app: App, plugin: TelegramSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private t() {
    return getSettingsStrings();
  }

  private addSectionHeading(
    containerEl: HTMLElement,
    title: string,
    siteHref?: string,
    siteLabel?: string,
  ): void {
    const heading = new Setting(containerEl).setName(title).setHeading();

    if (siteHref && siteLabel) {
      heading.nameEl.createEl("a", {
        text: siteLabel,
        href: siteHref,
        cls: "telegram-sync-heading-link",
        attr: {
          target: "_blank",
          rel: "noopener",
        },
      });
    }
  }

  display(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = this.t();
    const useDefaults = this.plugin.settings.useDefaultServer;

    this.renderAboutSection(containerEl);

    new Setting(containerEl)
      .setName(t.architecture)
      .setDesc(t.architectureDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption("direct", t.architectureDirect);
        dropdown.addOption("via-server", t.architectureViaServer);
        dropdown.setValue("via-server").onChange((value) => {
          if (value === "via-server") {
            return;
          }
          dropdown.setValue("via-server");
          new Notice(t.directNotImplemented, 6000);
        });
      });

    new Setting(containerEl)
      .setName(t.viaServerMode)
      .setDesc(t.viaServerModeDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption("default", t.viaServerUseDefaults);
        dropdown.addOption("custom", t.viaServerConfigure);
        dropdown
          .setValue(this.plugin.settings.useDefaultServer ? "default" : "custom")
          .onChange(async (value) => {
            this.plugin.settings.useDefaultServer = value === "default";
            if (this.plugin.settings.useDefaultServer) {
              this.plugin.settings.serverUrl = "";
            }
            await this.plugin.saveSettings();
            this.renderSettings();
          });
      });

    this.renderTelegramSection(containerEl, {
      lockedDefault: useDefaults,
    });

    this.renderViaServerSection(containerEl);

    this.addSectionHeading(containerEl, t.obsidianLinks);

    new Setting(containerEl)
      .setName(t.templateFile)
      .setDesc(t.templateFileDesc)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_TEMPLATE_FILE)
          .setValue(this.plugin.settings.templateFile)
          .onChange(async (value) => {
            this.plugin.settings.templateFile =
              value.trim() || DEFAULT_TEMPLATE_FILE;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t.targetFile)
      .setDesc(t.targetFileDesc)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_TARGET_FILE)
          .setValue(this.plugin.settings.targetFile)
          .onChange(async (value) => {
            this.plugin.settings.targetFile = value.trim() || DEFAULT_TARGET_FILE;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t.attachmentsFolder)
      .setDesc(t.attachmentsFolderDesc)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.attachmentsFolder)
          .setValue(this.plugin.settings.attachmentsFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentsFolder =
              value.trim() || DEFAULT_SETTINGS.attachmentsFolder;
            await this.plugin.saveSettings();
          }),
      );

    this.renderProxyApiSection(containerEl);
  }

  private renderTelegramSection(
    containerEl: HTMLElement,
    options?: { lockedDefault?: boolean },
  ): void {
    const t = this.t();
    const lockedDefault = options?.lockedDefault === true;
    const defaultBotUsername = "obsidian_sync_amvera_r_bot";

    this.addSectionHeading(containerEl, t.telegram);

    const tokenSetting = new Setting(containerEl)
      .setName(t.telegramBotToken)
      .addText((text) => {
        text
          .setPlaceholder("123456:ABC-DEF...")
          .setValue(
            lockedDefault
              ? DEFAULT_SERVER_API_TOKEN
              : this.plugin.settings.telegramBotToken,
          )
          .setDisabled(lockedDefault)
          .onChange(async (value) => {
            if (lockedDefault) {
              return;
            }
            this.plugin.settings.telegramBotToken = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = lockedDefault ? "text" : "password";
        text.inputEl.autocomplete = "off";
      });

    tokenSetting.descEl.empty();
    if (lockedDefault) {
      const botLine = tokenSetting.descEl.createDiv();
      botLine.createSpan({ text: `${t.defaultBotConnectNote} ` });
      botLine.createEl("a", {
        text: `@${defaultBotUsername}`,
        href: `https://t.me/${defaultBotUsername}`,
        attr: {
          target: "_blank",
          rel: "noopener",
        },
      });
    } else {
      tokenSetting.descEl.createDiv({ text: t.telegramBotTokenDesc });
    }

    new Setting(containerEl)
      .setName(t.telegramUserId)
      .setDesc(
        lockedDefault ? t.telegramUserIdDescDefault : t.telegramUserIdDesc,
      )
      .addText((text) => {
        text
          .setPlaceholder("123456789")
          .setValue(this.plugin.settings.telegramUserId)
          .onChange(async (value) => {
            this.plugin.settings.telegramUserId = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.inputMode = "numeric";
        text.inputEl.autocomplete = "off";
      });

    this.renderTelegramCheck(containerEl);
  }

  private renderAboutSection(containerEl: HTMLElement): void {
    const t = this.t();
    this.addSectionHeading(containerEl, t.about);

    const block = containerEl.createDiv({ cls: "telegram-sync-about" });
    block.createEl("p", { text: t.aboutIntro });
    const list = block.createEl("ol", { cls: "telegram-sync-about-list" });
    list.createEl("li", { text: t.aboutBulletDirect });
    list.createEl("li", { text: t.aboutBulletViaServer });
    block.createEl("p", {
      cls: "telegram-sync-about-note",
      text: t.aboutViaServerNote,
    });
  }

  private renderTelegramCheck(containerEl: HTMLElement): void {
    const t = this.t();
    let statusEl: HTMLElement;

    new Setting(containerEl)
      .setName(t.telegramCheck)
      .setDesc(t.telegramCheckDesc)
      .addButton((button) => {
        button.setButtonText(t.check).onClick(async () => {
          button.setDisabled(true);
          statusEl.setText("");
          statusEl.removeClass("is-ok");
          statusEl.removeClass("is-warn");
          statusEl.removeClass("is-error");

          try {
            const result = await this.runTelegramAccessCheck();
            statusEl.setText(result.message);
            statusEl.addClass(`is-${result.level}`);
            new Notice(result.message, 7000);
          } finally {
            button.setDisabled(false);
          }
        });
      });

    statusEl = containerEl.createDiv({ cls: "telegram-sync-check-status" });
  }

  private async runTelegramAccessCheck(): Promise<{
    message: string;
    level: "ok" | "warn" | "error";
  }> {
    const t = this.t();
    const settings = this.plugin.settings;

    if (!settings.telegramUserId.trim()) {
      return { message: t.telegramCheckMissingUserId, level: "error" };
    }

    if (settings.syncArchitecture === "direct") {
      if (!settings.telegramBotToken.trim()) {
        return { message: t.telegramCheckMissingToken, level: "error" };
      }
      const result = await checkTelegramBotAccess(settings.telegramBotToken);
      return result.ok
        ? { message: t.telegramAccessOk, level: "ok" }
        : { message: t.telegramAccessDenied, level: "error" };
    }

    // via-server: Variant A — auth + pending queue (does not mark messages processed)
    if (!settings.useDefaultServer) {
      if (!settings.serverUrl.trim()) {
        return { message: t.telegramCheckMissingServer, level: "error" };
      }
      if (!settings.telegramBotToken.trim()) {
        return { message: t.telegramCheckMissingToken, level: "error" };
      }
    }

    try {
      const client = new TelegramApiClient(settings);
      const connection = await client.checkConnection();
      if (!connection.serverOk || !connection.syncReady) {
        return { message: t.telegramCheckNoBotAccess, level: "error" };
      }

      let count = connection.status?.pending_count;
      if (typeof count !== "number") {
        // Older servers without pending_count: fall back to a non-destructive sync peek.
        try {
          const queue = await client.fetchMessages({ limit: 50 });
          count = queue.count ?? queue.messages?.length ?? 0;
        } catch {
          return { message: t.telegramCheckQueueFailed, level: "error" };
        }
      }

      if (count > 0) {
        return {
          message: t.telegramAccessOkPending.replace("{count}", String(count)),
          level: "ok",
        };
      }
      return { message: t.telegramAccessOkNoPending, level: "warn" };
    } catch {
      return { message: t.telegramCheckNoBotAccess, level: "error" };
    }
  }

  private renderViaServerSection(containerEl: HTMLElement): void {
    const t = this.t();
    const useDefaults = this.plugin.settings.useDefaultServer;
    const serverRepoUrl =
      "https://github.com/vicstu/server_obsidian_telegram_sync_amvera_r";

    this.addSectionHeading(containerEl, t.syncServer);

    const serverUrlSetting = new Setting(containerEl)
      .setName(t.serverUrl)
      .addText((text) =>
        text
          .setPlaceholder("https://your-server.example.com")
          .setValue(
            useDefaults
              ? DEFAULT_SERVER_API_TOKEN
              : this.plugin.settings.serverUrl,
          )
          .setDisabled(useDefaults)
          .onChange(async (value) => {
            if (useDefaults) {
              return;
            }
            this.plugin.settings.serverUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    serverUrlSetting.descEl.empty();
    serverUrlSetting.descEl.createDiv({ text: t.serverUrlDesc });
    if (!useDefaults) {
      const repoLine = serverUrlSetting.descEl.createDiv({
        cls: "telegram-sync-setting-desc-extra",
      });
      repoLine.createSpan({ text: t.syncServerRepoNote });
      repoLine.createEl("a", {
        text: "GitHub",
        href: serverRepoUrl,
        attr: {
          target: "_blank",
          rel: "noopener",
        },
      });
    }

    let serverStatusEl: HTMLElement;

    new Setting(containerEl)
      .setName(t.connectionCheck)
      .setDesc(t.connectionCheckDesc)
      .addButton((button) => {
        button.setButtonText(t.check).onClick(async () => {
          button.setDisabled(true);
          serverStatusEl.setText("");
          serverStatusEl.removeClass("is-ok");
          serverStatusEl.removeClass("is-error");

          try {
            const { message, ok } = await this.runServerConnectionCheck();
            serverStatusEl.setText(message);
            serverStatusEl.addClass(ok ? "is-ok" : "is-error");
            new Notice(message, 8000);
          } finally {
            button.setDisabled(false);
          }
        });
      });

    serverStatusEl = containerEl.createDiv({ cls: "telegram-sync-check-status" });
  }

  private async runServerConnectionCheck(): Promise<{
    message: string;
    ok: boolean;
  }> {
    const strings = this.t();

    if (
      !this.plugin.settings.useDefaultServer &&
      !this.plugin.settings.serverUrl.trim()
    ) {
      return { message: strings.missingCustomServer, ok: false };
    }
    if (
      !this.plugin.settings.useDefaultServer &&
      !this.plugin.settings.telegramBotToken.trim()
    ) {
      return { message: strings.missingBotToken, ok: false };
    }
    if (!this.plugin.settings.telegramUserId.trim()) {
      return { message: strings.telegramCheckMissingUserId, ok: false };
    }

    try {
      const result = await new TelegramApiClient(
        this.plugin.settings,
      ).checkConnection();

      if (!result.serverOk) {
        return {
          message: `${strings.serverUnavailable}${result.serverError ? `: ${result.serverError}` : ""}`,
          ok: false,
        };
      }

      if (!result.syncReady) {
        return {
          message: `${strings.syncNotReady}${result.syncError ? `: ${result.syncError}` : ""}.`,
          ok: false,
        };
      }

      return { message: strings.syncReady, ok: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        message: `${strings.connectionCheckFailed}: ${detail}`,
        ok: false,
      };
    }
  }

  private addFullWidthPromptSetting(
    containerEl: HTMLElement,
    options: {
      name: string;
      desc: string;
      value: string;
      placeholder: string;
      rows?: number;
      onChange: (value: string) => Promise<void>;
    },
  ): void {
    const setting = new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.desc)
      .setClass("telegram-sync-fullwidth-prompt");

    const textarea = setting.descEl.createEl("textarea");
    textarea.value = options.value;
    textarea.placeholder = options.placeholder;
    textarea.rows = options.rows ?? 4;
    textarea.addEventListener("input", () => {
      void options.onChange(textarea.value);
    });
  }

  private renderProxyApiSection(containerEl: HTMLElement): void {
    const t = this.t();

    this.addSectionHeading(
      containerEl,
      t.proxyApi,
      "https://proxyapi.ru/",
      "proxyapi.ru",
    );
    containerEl.createDiv({
      cls: "telegram-sync-about-note",
      text: t.proxyApiDesc,
    });

    new Setting(containerEl)
      .setName(t.transcribeAudio)
      .setDesc(t.transcribeAudioDesc.replace("{model}", TRANSCRIPTION_MODEL))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.transcribeAudio)
          .onChange(async (value) => {
            this.plugin.settings.transcribeAudio = value;
            await this.plugin.saveSettings();
            this.renderSettings();
          }),
      );

    if (!this.plugin.settings.transcribeAudio) {
      return;
    }

    const balanceSetting = new Setting(containerEl)
      .setName(t.balance)
      .setDesc(t.balanceDesc)
      .addButton((button) => {
        button.setButtonText(t.refresh).onClick(async () => {
          await this.refreshProxyApiBalance(balanceSetting, button, true);
        });
      });

    if (this.plugin.settings.proxyApiKey.trim()) {
      void this.refreshProxyApiBalance(balanceSetting, undefined, false);
    }

    new Setting(containerEl)
      .setName(t.apiKey)
      .setDesc(t.apiKeyDesc)
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.proxyApiKey)
          .onChange(async (value) => {
            this.plugin.settings.proxyApiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.postProcess)
      .setDesc(t.postProcessDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.postProcessTranscription)
          .onChange(async (value) => {
            this.plugin.settings.postProcessTranscription = value;
            await this.plugin.saveSettings();
            this.renderSettings();
          }),
      );

    if (this.plugin.settings.postProcessTranscription) {
      const modelSetting = new Setting(containerEl)
        .setName(t.postProcessModel)
        .addDropdown((dropdown) => {
          for (const model of POST_PROCESS_MODELS) {
            dropdown.addOption(model.id, model.label);
          }
          dropdown
            .setValue(
              resolvePostProcessModel(this.plugin.settings.postProcessModel),
            )
            .onChange(async (value) => {
              this.plugin.settings.postProcessModel =
                resolvePostProcessModel(value);
              await this.plugin.saveSettings();
            });
        });

      modelSetting.descEl.empty();
      modelSetting.descEl.createEl("a", {
        text: t.tokenPricing,
        href: "https://proxyapi.ru/pricing/list",
        attr: {
          target: "_blank",
          rel: "noopener",
          title: `${t.tokenPricing} — https://proxyapi.ru/pricing/list`,
        },
      });
      modelSetting.descEl.createSpan({
        text: t.tokenPricingSuffix,
      });

      this.addFullWidthPromptSetting(containerEl, {
        name: t.postProcessPrompt,
        desc: t.postProcessPromptDesc,
        value: this.plugin.settings.postProcessPrompt,
        placeholder: DEFAULT_POST_PROCESS_PROMPT,
        rows: 8,
        onChange: async (value) => {
          this.plugin.settings.postProcessPrompt =
            value.trim() || DEFAULT_POST_PROCESS_PROMPT;
          await this.plugin.saveSettings();
        },
      });
    }
  }

  private async refreshProxyApiBalance(
    balanceSetting: Setting,
    button?: ButtonComponent,
    showNotice = true,
  ): Promise<void> {
    const t = this.t();

    if (button) {
      button.setDisabled(true);
    }

    balanceSetting.setName(t.balanceLoading);

    try {
      const result = await fetchProxyApiBalance(this.plugin.settings.proxyApiKey);

      if (!result.ok || !result.balance) {
        balanceSetting.setName(t.balance);
        if (showNotice) {
          new Notice(result.error ?? t.balanceFailed, 8000);
        }
        return;
      }

      const formatted = formatProxyApiBalance(result.balance);
      balanceSetting.setName(`${t.balance}: ${formatted}`);
      if (showNotice) {
        new Notice(`ProxyAPI ${t.balance.toLowerCase()}: ${formatted}`, 5000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      balanceSetting.setName(t.balance);
      if (showNotice) {
        new Notice(`${t.balanceCheckFailed}: ${message}`, 8000);
      }
    } finally {
      button?.setDisabled(false);
    }
  }
}

export { mergeSettings };
