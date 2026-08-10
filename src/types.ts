export type { SettingsUiLanguage } from "./settings-i18n";
export {
  detectSettingsUiLanguage,
  getSettingsStrings,
} from "./settings-i18n";

export interface TelegramMessage {
  id: number;
  message_id: string;
  chat_id: number;
  sender_id: number;
  sender_name: string | null;
  text: string | null;
  media_url: string | null;
  media_type: string | null;
  file_name: string | null;
  transcribed_text: string | null;
  tags: string | null;
  created_at: string;
  processed: boolean;
  type?: string;
  transcribed?: boolean;
}

export interface MessagesResponse {
  messages: TelegramMessage[];
  count: number;
}

export interface MarkProcessedResponse {
  updated: number;
  message_ids: string[];
}

export interface StatusResponse {
  user_id: number;
  sync_ready: boolean;
  /** Unsynced messages for this user; present on current servers. */
  pending_count?: number;
}

export interface SyncMessagesRequest {
  limit?: number;
}

export interface ConnectionCheckResult {
  serverOk: boolean;
  serverError?: string;
  syncReady: boolean;
  syncError?: string;
  status?: StatusResponse;
}

export const DEFAULT_SERVER_URL =
  "https://bots-and-pages-myeasycoding.waw0.amvera.tech";

/** Auth value sent to the default shared sync server. */
export const DEFAULT_SERVER_API_TOKEN = "default";

export type SyncArchitecture = "direct" | "via-server";

export const SYNC_ARCHITECTURES = [
  { id: "direct" as const, labelKey: "architectureDirect" as const },
  { id: "via-server" as const, labelKey: "architectureViaServer" as const },
];

export function resolveSyncArchitecture(
  value: string | null | undefined,
): SyncArchitecture {
  return value === "direct" ? "direct" : "via-server";
}

export interface TelegramSyncSettings {
  /** How messages reach Obsidian: direct Telegram API or via sync server. */
  syncArchitecture: SyncArchitecture;
  /** Bot token from @BotFather. */
  telegramBotToken: string;
  /** Numeric Telegram user ID (not username). */
  telegramUserId: string;
  /** When true (via-server), use the built-in default sync server. */
  useDefaultServer: boolean;
  /** Custom sync server URL (used when useDefaultServer is false). */
  serverUrl: string;
  targetFile: string;
  templateFile: string;
  attachmentsFolder: string;
  proxyApiKey: string;
  /** Send voice/audio attachments to ProxyAPI for transcription during sync. */
  transcribeAudio: boolean;
  /** After transcription, send text to a chat model with the command prompt. */
  postProcessTranscription: boolean;
  postProcessModel: PostProcessModelId;
  /** Instructions for what to do with the transcribed text. */
  postProcessPrompt: string;
}

/** Effective base URL for via-server requests. */
export function getEffectiveServerUrl(settings: TelegramSyncSettings): string {
  if (settings.useDefaultServer) {
    return DEFAULT_SERVER_URL;
  }
  const custom = settings.serverUrl.trim().replace(/\/+$/, "");
  if (!custom) {
    throw new Error("Custom server URL is not configured");
  }
  return custom;
}

/**
 * Token sent to the sync server API:
 * - default shared server → "default"
 * - custom server → Telegram bot token
 */
export function getServerApiAuthToken(settings: TelegramSyncSettings): string {
  if (settings.useDefaultServer) {
    return DEFAULT_SERVER_API_TOKEN;
  }
  const token = settings.telegramBotToken.trim();
  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }
  return token;
}

export const DEFAULT_ENTRY_TEMPLATE = `**{{sender}}** · {{date}} {{time}}
{{tags}}
{{text}}
![[{{attachment}}]]
{{transcription}}`;

export const DEFAULT_TARGET_FILE = "Telegram/Inbox.md";
export const DEFAULT_TEMPLATE_FILE = "Telegram/template.md";

/** Fixed speech-to-text model used for all transcriptions. */
export const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export const POST_PROCESS_MODELS = [
  { id: "gpt-5-nano", label: "gpt-5-nano" },
  { id: "gpt-4.1-nano", label: "gpt-4.1-nano" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini" },
  { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
] as const;

export type PostProcessModelId = (typeof POST_PROCESS_MODELS)[number]["id"];

export const DEFAULT_POST_PROCESS_MODEL: PostProcessModelId = "gpt-4o-mini";

export function resolvePostProcessModel(
  value: string | null | undefined,
): PostProcessModelId {
  const trimmed = value?.trim();
  const match = POST_PROCESS_MODELS.find((model) => model.id === trimmed);
  return match?.id ?? DEFAULT_POST_PROCESS_MODEL;
}

export const DEFAULT_POST_PROCESS_PROMPT =
  "Исправь ошибки распознавания речи, расставь пунктуацию и абзацы. Сохрани смысл и язык оригинала. Верни только итоговый текст без пояснений.";

export const DEFAULT_SETTINGS: TelegramSyncSettings = {
  syncArchitecture: "via-server",
  telegramBotToken: "",
  telegramUserId: "",
  useDefaultServer: true,
  serverUrl: "",
  targetFile: DEFAULT_TARGET_FILE,
  templateFile: DEFAULT_TEMPLATE_FILE,
  attachmentsFolder: "Telegram/Media",
  proxyApiKey: "",
  transcribeAudio: false,
  postProcessTranscription: false,
  postProcessModel: DEFAULT_POST_PROCESS_MODEL,
  postProcessPrompt: DEFAULT_POST_PROCESS_PROMPT,
};

export function mergeSettings(
  stored: Partial<TelegramSyncSettings> | null | undefined,
): TelegramSyncSettings {
  const storedUrl = stored?.serverUrl?.trim() || "";
  const useDefaultServer =
    stored?.useDefaultServer ??
    (!storedUrl || storedUrl === DEFAULT_SERVER_URL);

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    syncArchitecture: "via-server",
    telegramBotToken: stored?.telegramBotToken?.trim() || "",
    telegramUserId: stored?.telegramUserId?.trim() || "",
    useDefaultServer,
    serverUrl: useDefaultServer
      ? ""
      : storedUrl === DEFAULT_SERVER_URL
        ? ""
        : storedUrl,
    targetFile: stored?.targetFile?.trim() || DEFAULT_TARGET_FILE,
    templateFile: stored?.templateFile?.trim() || DEFAULT_TEMPLATE_FILE,
    attachmentsFolder:
      stored?.attachmentsFolder?.trim() || DEFAULT_SETTINGS.attachmentsFolder,
    proxyApiKey: stored?.proxyApiKey?.trim() || "",
    transcribeAudio: stored?.transcribeAudio ?? DEFAULT_SETTINGS.transcribeAudio,
    postProcessTranscription:
      stored?.postProcessTranscription ??
      DEFAULT_SETTINGS.postProcessTranscription,
    postProcessModel: resolvePostProcessModel(stored?.postProcessModel),
    postProcessPrompt:
      stored?.postProcessPrompt?.trim() || DEFAULT_POST_PROCESS_PROMPT,
  };
}
