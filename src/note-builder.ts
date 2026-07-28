import {
  DEFAULT_ENTRY_TEMPLATE,
  TelegramMessage,
  TelegramSyncSettings,
} from "./types";

const TYPE_ALIASES: Record<string, string> = {
  image: "photo",
  audio: "voice",
  file: "document",
  document: "document",
  photo: "photo",
  voice: "voice",
  video: "video",
  text: "text",
  sticker: "sticker",
};

export function normalizeMessageType(message: TelegramMessage): string {
  if (message.type) {
    return message.type;
  }

  const mediaType = message.media_type?.toLowerCase();
  if (!mediaType || mediaType === "text") {
    return "text";
  }

  return TYPE_ALIASES[mediaType] ?? mediaType;
}

const AUDIO_EXTENSIONS = new Set([
  "ogg",
  "opus",
  "mp3",
  "mpeg",
  "m4a",
  "wav",
  "webm",
  "flac",
]);

/** Voice notes and audio files that should go through ProxyAPI transcription. */
export function isAudioMessage(message: TelegramMessage): boolean {
  const messageType = normalizeMessageType(message);
  if (messageType === "voice" || messageType === "audio") {
    return true;
  }

  const mediaType = message.media_type?.toLowerCase() ?? "";
  if (mediaType === "voice" || mediaType === "audio") {
    return true;
  }

  const name = message.file_name?.trim() || "";
  const ext = name.includes(".")
    ? name.split(".").pop()?.toLowerCase() ?? ""
    : "";
  return AUDIO_EXTENSIONS.has(ext);
}

export function isTranscribed(message: TelegramMessage): boolean {
  if (message.transcribed !== undefined) {
    return message.transcribed;
  }

  return Boolean(message.transcribed_text?.trim());
}

const MONTH_NAMES_RU = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
] as const;

/** Tags like `2026-май` and `2026-год` from message date. */
export function buildYearMonthTags(createdAt: string): string[] {
  const date = parseMessageCreatedAt(createdAt) ?? new Date();
  const year = date.getFullYear();
  const monthName = MONTH_NAMES_RU[date.getMonth()];
  return [`${year}-${monthName}`, `${year}-год`];
}

export function buildTags(
  message: TelegramMessage,
  settings?: TelegramSyncSettings,
): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  const addTag = (tag: string): void => {
    const normalized = tag.trim().replace(/^#+/, "").toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    tags.push(normalized);
  };

  if (message.tags) {
    for (const tag of message.tags.split(",")) {
      addTag(tag);
    }
  }

  // When transcription is enabled, audio notes get year-month and year tags.
  if (settings?.transcribeAudio && isAudioMessage(message)) {
    for (const tag of buildYearMonthTags(message.created_at)) {
      addTag(tag);
    }
  }

  return tags;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

function parseMessageCreatedAt(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasTimezone =
    trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed);
  const iso = hasTimezone ? trimmed : `${trimmed}Z`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getMessageCreatedTimestampMs(value: string): number {
  return parseMessageCreatedAt(value)?.getTime() ?? Date.now();
}

export function formatAttachmentYearMonth(createdAt: string): string {
  const date = parseMessageCreatedAt(createdAt) ?? new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function pad2(part: number): string {
  return String(part).padStart(2, "0");
}

function formatCreated(value: string): string {
  const date = parseMessageCreatedAt(value);
  if (!date) {
    return value;
  }

  return `${formatDate(value)} ${formatTime(value)}`;
}

function formatDate(value: string): string {
  const date = parseMessageCreatedAt(value);
  if (!date) {
    return value;
  }

  return [pad2(date.getDate()), pad2(date.getMonth() + 1), date.getFullYear()].join(
    ".",
  );
}

function formatTime(value: string): string {
  const date = parseMessageCreatedAt(value);
  if (!date) {
    return value;
  }

  return [pad2(date.getHours()), pad2(date.getMinutes()), pad2(date.getSeconds())].join(
    ":",
  );
}

function buildAttachmentValue(attachmentPath: string | null): string {
  return attachmentPath ?? "";
}

function buildFileValue(
  message: TelegramMessage,
  attachmentPath: string | null,
): string {
  if (attachmentPath) {
    const normalized = attachmentPath.replace(/\\/g, "/");
    const basename = normalized.split("/").pop();
    if (basename) {
      return basename;
    }
  }

  if (!message.media_url) {
    return "";
  }

  return resolveMediaFilename(message);
}

function buildTranscriptionBlock(message: TelegramMessage): string {
  if (!message.transcribed_text?.trim()) {
    return "";
  }
  return message.transcribed_text.trim();
}

export function buildTemplateVariables(
  message: TelegramMessage,
  settings: TelegramSyncSettings,
  attachmentPath: string | null,
): Record<string, string> {
  const messageType = normalizeMessageType(message);
  const tags = buildTags(message, settings);

  return {
    created: formatCreated(message.created_at),
    date: formatDate(message.created_at),
    time: formatTime(message.created_at),
    sender: message.sender_name?.trim() || "Unknown",
    sender_id: String(message.sender_id),
    message_id: message.message_id,
    type: messageType,
    text: message.text?.trim() || "",
    attachment: buildAttachmentValue(attachmentPath),
    file: buildFileValue(message, attachmentPath),
    transcription: buildTranscriptionBlock(message),
    tags: tags.map((tag) => `#${tag}`).join(" "),
  };
}

export function renderEntryTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return variables[key] ?? "";
  });
}

export function buildEntryBlock(
  message: TelegramMessage,
  settings: TelegramSyncSettings,
  attachmentPath: string | null,
  template: string,
): string {
  const normalizedTemplate = template.trim() || DEFAULT_ENTRY_TEMPLATE;
  const variables = buildTemplateVariables(message, settings, attachmentPath);
  return renderEntryTemplate(normalizedTemplate, variables).trim();
}

export function buildInitialTargetFileContent(): string {
  return "# Telegram Inbox\n";
}

export function appendEntryToFile(fileContent: string, entry: string): string {
  const trimmed = fileContent.trimEnd();
  if (!trimmed) {
    return `${buildInitialTargetFileContent().trimEnd()}\n\n${entry}\n`;
  }
  return `${trimmed}\n\n${entry}\n`;
}

export function buildAttachmentPath(
  settings: TelegramSyncSettings,
  message: TelegramMessage,
  originalName: string,
): string {
  const baseFolder = settings.attachmentsFolder
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  const yearMonth = formatAttachmentYearMonth(message.created_at);
  const baseName = sanitizeFilename(
    originalName || message.file_name || message.message_id,
  );
  return `${baseFolder}/${yearMonth}/${baseName}`;
}

export function resolveMediaFilename(message: TelegramMessage): string {
  const messageType = normalizeMessageType(message);

  if (messageType === "photo") {
    return sanitizeFilename(`${message.message_id}.jpg`);
  }

  if (message.file_name?.trim()) {
    return sanitizeFilename(message.file_name.trim());
  }

  const extensionByType: Record<string, string> = {
    voice: "ogg",
    audio: "mp3",
    video: "mp4",
    document: "bin",
    file: "bin",
  };

  const mediaType = message.media_type?.toLowerCase() ?? "";
  const ext = extensionByType[mediaType] ?? "bin";
  return sanitizeFilename(`${message.message_id}.${ext}`);
}
