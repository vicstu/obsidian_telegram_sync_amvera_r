import {
  resolveSettingsUiLanguage,
  SettingsUiLanguage,
} from "./settings-i18n";

export type { SettingsUiLanguage };
export {
  resolveSettingsUiLanguage,
  SETTINGS_UI_LANGUAGES,
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

export interface TelegramSyncSettings {
  serverUrl: string;
  targetFile: string;
  templateFile: string;
  attachmentsFolder: string;
  proxyApiKey: string;
  /** UI language for the plugin settings tab. */
  settingsUiLanguage: SettingsUiLanguage;
  /** Send voice/audio attachments to ProxyAPI for transcription during sync. */
  transcribeAudio: boolean;
  /** After transcription, send text to a chat model with the command prompt. */
  postProcessTranscription: boolean;
  postProcessModel: PostProcessModelId;
  /** Instructions for what to do with the transcribed text. */
  postProcessPrompt: string;
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
  serverUrl: DEFAULT_SERVER_URL,
  targetFile: DEFAULT_TARGET_FILE,
  templateFile: DEFAULT_TEMPLATE_FILE,
  attachmentsFolder: "Telegram/Media",
  proxyApiKey: "",
  settingsUiLanguage: "en",
  transcribeAudio: false,
  postProcessTranscription: false,
  postProcessModel: DEFAULT_POST_PROCESS_MODEL,
  postProcessPrompt: DEFAULT_POST_PROCESS_PROMPT,
};

export function mergeSettings(
  stored: Partial<TelegramSyncSettings> | null | undefined,
): TelegramSyncSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    serverUrl: stored?.serverUrl?.trim() || DEFAULT_SERVER_URL,
    targetFile: stored?.targetFile?.trim() || DEFAULT_TARGET_FILE,
    templateFile: stored?.templateFile?.trim() || DEFAULT_TEMPLATE_FILE,
    attachmentsFolder:
      stored?.attachmentsFolder?.trim() || DEFAULT_SETTINGS.attachmentsFolder,
    proxyApiKey: stored?.proxyApiKey?.trim() || "",
    settingsUiLanguage: resolveSettingsUiLanguage(stored?.settingsUiLanguage),
    transcribeAudio: stored?.transcribeAudio ?? DEFAULT_SETTINGS.transcribeAudio,
    postProcessTranscription:
      stored?.postProcessTranscription ??
      DEFAULT_SETTINGS.postProcessTranscription,
    postProcessModel: resolvePostProcessModel(stored?.postProcessModel),
    postProcessPrompt:
      stored?.postProcessPrompt?.trim() || DEFAULT_POST_PROCESS_PROMPT,
  };
}
