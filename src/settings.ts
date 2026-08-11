import {
  App,
  ButtonComponent,
  Notice,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
} from "obsidian";

import { TelegramApiClient } from "./api";
import TelegramSyncPlugin from "./main";
import { isObsidianAtLeast } from "./obsidian-version";
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
    if (isObsidianAtLeast("1.13.0")) {
      return;
    }
    this.renderSettings(this.containerEl);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    if (!isObsidianAtLeast("1.13.0")) {
      return [];
    }

    const t = this.t();

    return [
      {
        type: "group",
        heading: t.about,
        items: [
          {
            name: t.aboutIntro,
            desc: `${t.aboutBulletDirect} ${t.aboutBulletViaServer}`,
            searchable: true,
          },
        ],
      },
      {
        type: "group",
        heading: t.architecture,
        items: [
          {
            name: t.architecture,
            desc: t.architectureDesc,
            render: (setting) => {
              this.renderArchitectureControls(setting.settingEl);
            },
          },
          {
            name: t.viaServerMode,
            desc: t.viaServerModeDesc,
            render: (setting) => {
              this.renderViaServerModeControl(setting.settingEl);
            },
          },
        ],
      },
      {
        type: "group",
        heading: t.telegram,
        items: [
          {
            name: t.telegramBotToken,
            render: (setting) => {
              this.renderTelegramTokenControl(setting.settingEl);
            },
          },
          {
            name: t.telegramUserId,
            desc: this.plugin.settings.useDefaultServer
              ? t.telegramUserIdDescDefault
              : t.telegramUserIdDesc,
            control: {
              type: "text",
              key: "telegramUserId",
              placeholder: "123456789",
            },
          },
          {
            name: t.telegramCheck,
            desc: t.telegramCheckDesc,
            action: () => {
              void this.runTelegramCheckWithNotice();
            },
          },
        ],
      },
      {
        type: "group",
        heading: t.syncServer,
        items: [
          {
            name: t.serverUrl,
            desc: t.serverUrlDesc,
            render: (setting) => {
              this.renderServerUrlControl(setting.settingEl);
            },
          },
          {
            name: t.connectionCheck,
            desc: t.connectionCheckDesc,
            action: () => {
              void this.runServerConnectionCheckWithNotice();
            },
          },
        ],
      },
      {
        type: "group",
        heading: t.obsidianLinks,
        items: [
          {
            name: t.templateFile,
            desc: t.templateFileDesc,
            control: {
              type: "file",
              key: "templateFile",
              placeholder: DEFAULT_TEMPLATE_FILE,
              filter: (file) => file.extension === "md",
            },
          },
          {
            name: t.targetFile,
            desc: t.targetFileDesc,
            control: {
              type: "file",
              key: "targetFile",
              placeholder: DEFAULT_TARGET_FILE,
              filter: (file) => file.extension === "md",
            },
          },
          {
            name: t.attachmentsFolder,
            desc: t.attachmentsFolderDesc,
            control: {
              type: "folder",
              key: "attachmentsFolder",
              placeholder: DEFAULT_SETTINGS.attachmentsFolder,
            },
          },
        ],
      },
      {
        type: "group",
        heading: t.proxyApi,
        items: [
          {
            name: t.transcribeAudio,
            desc: t.transcribeAudioDesc.replace("{model}", TRANSCRIPTION_MODEL),
            control: {
              type: "toggle",
              key: "transcribeAudio",
            },
          },
          {
            name: t.balance,
            desc: t.balanceDesc,
            visible: () => this.plugin.settings.transcribeAudio,
            action: () => {
              void this.refreshProxyApiBalanceFromAction();
            },
          },
          {
            name: t.apiKey,
            desc: t.apiKeyDesc,
            visible: () => this.plugin.settings.transcribeAudio,
            render: (setting) => {
              this.renderProxyApiKeyControl(setting.settingEl);
            },
          },
          {
            name: t.postProcess,
            desc: t.postProcessDesc,
            visible: () => this.plugin.settings.transcribeAudio,
            control: {
              type: "toggle",
              key: "postProcessTranscription",
            },
          },
          {
            name: t.postProcessModel,
            visible: () =>
              this.plugin.settings.transcribeAudio &&
              this.plugin.settings.postProcessTranscription,
            control: {
              type: "dropdown",
              key: "postProcessModel",
              options: Object.fromEntries(
                POST_PROCESS_MODELS.map((model) => [model.id, model.label]),
              ),
            },
          },
          {
            name: t.postProcessPrompt,
            desc: t.postProcessPromptDesc,
            visible: () =>
              this.plugin.settings.transcribeAudio &&
              this.plugin.settings.postProcessTranscription,
            control: {
              type: "textarea",
              key: "postProcessPrompt",
              rows: 8,
              placeholder: DEFAULT_POST_PROCESS_PROMPT,
            },
          },
        ],
      },
    ];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings;

    switch (key) {
      case "postProcessModel":
        settings.postProcessModel = resolvePostProcessModel(String(value));
        break;
      case "templateFile":
        settings.templateFile = String(value).trim() || DEFAULT_TEMPLATE_FILE;
        break;
      case "targetFile":
        settings.targetFile = String(value).trim() || DEFAULT_TARGET_FILE;
        break;
      case "attachmentsFolder":
        settings.attachmentsFolder =
          String(value).trim() || DEFAULT_SETTINGS.attachmentsFolder;
        break;
      case "postProcessPrompt":
        settings.postProcessPrompt =
          String(value).trim() || DEFAULT_POST_PROCESS_PROMPT;
        break;
      default:
        (settings as unknown as Record<string, unknown>)[key] = value;
    }

    await this.plugin.saveSettings();

    if (key === "transcribeAudio" || key === "postProcessTranscription") {
      this.update();
    }
  }

  getControlValue(key: string): unknown {
    if (key === "postProcessModel") {
      return resolvePostProcessModel(this.plugin.settings.postProcessModel);
    }
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  private renderSettings(containerEl: HTMLElement = this.containerEl): void {
    containerEl.empty();
    const t = this.t();
    const useDefaults = this.plugin.settings.useDefaultServer;

    this.renderAboutSection(containerEl);

    this.renderArchitectureControls(containerEl);

    this.renderViaServerModeControl(containerEl);

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

  private renderArchitectureControls(containerEl: HTMLElement): void {
    const t = this.t();

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
  }

  private renderViaServerModeControl(containerEl: HTMLElement): void {
    const t = this.t();

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
            if (isObsidianAtLeast("1.13.0")) {
              this.update();
              return;
            }
            this.renderSettings(containerEl);
          });
      });
  }

  private renderTelegramTokenControl(containerEl: HTMLElement): void {
    const t = this.t();
    const lockedDefault = this.plugin.settings.useDefaultServer;
    const defaultBotUsername = "obsidian_sync_amvera_r_bot";

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
  }

  private renderServerUrlControl(containerEl: HTMLElement): void {
    const t = this.t();
    const useDefaults = this.plugin.settings.useDefaultServer;
    const serverRepoUrl =
      "https://github.com/vicstu/server_obsidian_telegram_sync_amvera_r";

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
  }

  private renderProxyApiKeyControl(containerEl: HTMLElement): void {
    new Setting(containerEl).addText((text) => {
      text
        .setPlaceholder("sk-...")
        .setValue(this.plugin.settings.proxyApiKey)
        .onChange(async (value) => {
          this.plugin.settings.proxyApiKey = value.trim();
          await this.plugin.saveSettings();
        });
      text.inputEl.type = "password";
      text.inputEl.autocomplete = "off";
    });
  }

  private async runTelegramCheckWithNotice(): Promise<void> {
    const result = await this.runTelegramAccessCheck();
    new Notice(result.message, 7000);
  }

  private async runServerConnectionCheckWithNotice(): Promise<void> {
    const { message, ok } = await this.runServerConnectionCheck();
    new Notice(message, 8000);
    if (!ok) {
      return;
    }
  }

  private async refreshProxyApiBalanceFromAction(): Promise<void> {
    const t = this.t();

    if (!this.plugin.settings.proxyApiKey.trim()) {
      new Notice(t.apiKeyDesc, 8000);
      return;
    }

    try {
      const result = await fetchProxyApiBalance(this.plugin.settings.proxyApiKey);
      if (!result.ok || !result.balance) {
        new Notice(result.error ?? t.balanceFailed, 8000);
        return;
      }

      const formatted = formatProxyApiBalance(result.balance);
      new Notice(`ProxyAPI ${t.balance.toLowerCase()}: ${formatted}`, 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${t.balanceCheckFailed}: ${message}`, 8000);
    }
  }

  private renderTelegramSection(
    containerEl: HTMLElement,
    options?: { lockedDefault?: boolean },
  ): void {
    const t = this.t();
    const lockedDefault = options?.lockedDefault === true;

    this.addSectionHeading(containerEl, t.telegram);
    this.renderTelegramTokenControl(containerEl);
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

    this.addSectionHeading(containerEl, t.syncServer);
    this.renderServerUrlControl(containerEl);

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
            if (isObsidianAtLeast("1.13.0")) {
              this.update();
              return;
            }
            this.renderSettings(containerEl);
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
            if (isObsidianAtLeast("1.13.0")) {
              this.update();
              return;
            }
            this.renderSettings(containerEl);
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
