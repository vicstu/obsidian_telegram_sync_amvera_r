import { App, ButtonComponent, Notice, PluginSettingTab, Setting } from "obsidian";

import { TelegramApiClient } from "./api";
import TelegramSyncPlugin from "./main";
import {
  fetchProxyApiBalance,
  formatProxyApiBalance,
} from "./proxyapi";
import {
  getSettingsStrings,
  SETTINGS_UI_LANGUAGES,
} from "./settings-i18n";
import {
  DEFAULT_POST_PROCESS_PROMPT,
  DEFAULT_SERVER_URL,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATE_FILE,
  DEFAULT_TARGET_FILE,
  mergeSettings,
  POST_PROCESS_MODELS,
  resolvePostProcessModel,
  resolveSettingsUiLanguage,
  TelegramSyncSettings,
  TRANSCRIPTION_MODEL,
} from "./types";

export class TelegramSyncSettingTab extends PluginSettingTab {
  plugin: TelegramSyncPlugin;

  constructor(app: App, plugin: TelegramSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private t() {
    return getSettingsStrings(this.plugin.settings.settingsUiLanguage);
  }

  private addSectionHeading(
    containerEl: HTMLElement,
    title: string,
    siteHref?: string,
    siteLabel?: string,
  ): void {
    const headerRow = containerEl.createDiv();
    headerRow.style.display = "flex";
    headerRow.style.alignItems = "baseline";
    headerRow.style.gap = "0.5em";
    headerRow.style.marginTop = "1.5em";
    headerRow.style.marginBottom = "0.5em";

    headerRow.createEl("h3", { text: title });
    if (siteHref && siteLabel) {
      const siteLink = headerRow.createEl("a", {
        text: siteLabel,
        href: siteHref,
      });
      siteLink.target = "_blank";
      siteLink.rel = "noopener";
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = this.t();
    const lang = this.plugin.settings.settingsUiLanguage;

    new Setting(containerEl)
      .setName(t.settingsLanguage)
      .setDesc(t.settingsLanguageDesc)
      .addDropdown((dropdown) => {
        for (const option of SETTINGS_UI_LANGUAGES) {
          dropdown.addOption(
            option.id,
            lang === "ru" ? option.labelRu : option.labelEn,
          );
        }
        dropdown.setValue(lang).onChange(async (value) => {
          this.plugin.settings.settingsUiLanguage =
            resolveSettingsUiLanguage(value);
          await this.plugin.saveSettings();
          this.display();
        });
      });

    this.addSectionHeading(containerEl, t.amveraServer);

    new Setting(containerEl)
      .setName(t.serverUrl)
      .setDesc(t.serverUrlDesc)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SERVER_URL)
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim() || DEFAULT_SERVER_URL;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t.connectionCheck)
      .setDesc(t.connectionCheckDesc)
      .addButton((button) => {
        button.setButtonText(t.check).onClick(async () => {
          button.setDisabled(true);
          const strings = this.t();
          try {
            const result = await new TelegramApiClient(
              this.plugin.settings,
            ).checkConnection();

            if (!result.serverOk) {
              new Notice(
                `${strings.serverUnavailable}${result.serverError ? `: ${result.serverError}` : ""}`,
                8000,
              );
              return;
            }

            if (!result.syncReady) {
              new Notice(
                `${strings.syncNotReady}${result.syncError ? `: ${result.syncError}` : ""}.`,
                8000,
              );
              return;
            }

            new Notice(strings.syncReady, 8000);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`${strings.connectionCheckFailed}: ${message}`, 8000);
          } finally {
            button.setDisabled(false);
          }
        });
      });

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
      .setDesc(options.desc);

    setting.settingEl.style.display = "flex";
    setting.settingEl.style.flexDirection = "column";
    setting.settingEl.style.alignItems = "stretch";
    setting.infoEl.style.width = "100%";
    setting.infoEl.style.marginRight = "0";
    setting.controlEl.style.display = "none";

    const textarea = setting.descEl.createEl("textarea");
    textarea.value = options.value;
    textarea.placeholder = options.placeholder;
    textarea.rows = options.rows ?? 4;
    textarea.style.display = "block";
    textarea.style.width = "100%";
    textarea.style.maxWidth = "100%";
    textarea.style.minWidth = "0";
    textarea.style.marginTop = "0.6em";
    textarea.style.boxSizing = "border-box";
    textarea.style.resize = "vertical";
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

    new Setting(containerEl)
      .setName(t.transcribeAudio)
      .setDesc(t.transcribeAudioDesc.replace("{model}", TRANSCRIPTION_MODEL))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.transcribeAudio)
          .onChange(async (value) => {
            this.plugin.settings.transcribeAudio = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (!this.plugin.settings.transcribeAudio) {
      return;
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
      .setName(t.postProcess)
      .setDesc(t.postProcessDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.postProcessTranscription)
          .onChange(async (value) => {
            this.plugin.settings.postProcessTranscription = value;
            await this.plugin.saveSettings();
            this.display();
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
      const pricingLink = modelSetting.descEl.createEl("a", {
        text: t.tokenPricing,
        href: "https://proxyapi.ru/pricing/list",
      });
      pricingLink.target = "_blank";
      pricingLink.rel = "noopener";
      pricingLink.title = `${t.tokenPricing} — https://proxyapi.ru/pricing/list`;
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
