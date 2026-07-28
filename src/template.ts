import { App, TFile } from "obsidian";

import { DEFAULT_ENTRY_TEMPLATE, TelegramSyncSettings } from "./types";

async function ensureParentFolder(app: App, filePath: string): Promise<void> {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 1) {
    return;
  }

  let current = "";
  for (const part of parts.slice(0, -1)) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

export async function loadEntryTemplate(
  app: App,
  settings: TelegramSyncSettings,
): Promise<{ template: string; createdPath?: string }> {
  const path = settings.templateFile.trim();
  if (!path) {
    return { template: DEFAULT_ENTRY_TEMPLATE };
  }

  let file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    await ensureParentFolder(app, path);
    await app.vault.create(path, `${DEFAULT_ENTRY_TEMPLATE.trim()}\n`);
    file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      throw new Error(`Failed to create template file: ${path}`);
    }
    const content = (await app.vault.read(file)).trim();
    return {
      template: content || DEFAULT_ENTRY_TEMPLATE,
      createdPath: path,
    };
  }

  const content = (await app.vault.read(file)).trim();
  if (!content) {
    return { template: DEFAULT_ENTRY_TEMPLATE };
  }

  return { template: content };
}
