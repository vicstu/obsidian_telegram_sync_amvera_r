export type SettingsUiLanguage = "en" | "ru";

export const SETTINGS_UI_LANGUAGES = [
  { id: "en" as const, labelEn: "English", labelRu: "Английский" },
  { id: "ru" as const, labelEn: "Russian", labelRu: "Русский" },
];

export function resolveSettingsUiLanguage(
  value: string | null | undefined,
): SettingsUiLanguage {
  return value === "ru" ? "ru" : "en";
}

type SettingsStrings = {
  settingsLanguage: string;
  settingsLanguageDesc: string;
  amveraServer: string;
  serverUrl: string;
  serverUrlDesc: string;
  connectionCheck: string;
  connectionCheckDesc: string;
  check: string;
  serverUnavailable: string;
  syncNotReady: string;
  syncReady: string;
  connectionCheckFailed: string;
  obsidianLinks: string;
  templateFile: string;
  templateFileDesc: string;
  targetFile: string;
  targetFileDesc: string;
  attachmentsFolder: string;
  attachmentsFolderDesc: string;
  proxyApi: string;
  transcribeAudio: string;
  transcribeAudioDesc: string;
  apiKey: string;
  apiKeyDesc: string;
  balance: string;
  balanceDesc: string;
  refresh: string;
  balanceLoading: string;
  balanceFailed: string;
  balanceCheckFailed: string;
  postProcess: string;
  postProcessDesc: string;
  postProcessModel: string;
  tokenPricing: string;
  tokenPricingSuffix: string;
  postProcessPrompt: string;
  postProcessPromptDesc: string;
};

const EN: SettingsStrings = {
  settingsLanguage: "Settings language",
  settingsLanguageDesc: "Language for this settings page",
  amveraServer: "Amvera server",
  serverUrl: "Server URL",
  serverUrlDesc: "Base URL of the sync server (no trailing slash)",
  connectionCheck: "Connection check",
  connectionCheckDesc: "Checks server availability and Telegram sync status",
  check: "Check",
  serverUnavailable: "Server unavailable",
  syncNotReady: "Server is up. Telegram sync is not ready",
  syncReady: "Server is up. Telegram sync is ready.",
  connectionCheckFailed: "Connection check failed",
  obsidianLinks: "Obsidian links",
  templateFile: "Template file",
  templateFileDesc:
    "Path to a .md file with the message template. Variables: {{date}}, {{time}}, {{created}}, {{sender}}, {{sender_id}}, {{message_id}}, {{type}}, {{text}}, {{attachment}} (vault path), {{file}} (filename with extension), {{transcription}}, {{tags}}. Use ![[{{attachment}}]] or [[{{attachment}}]] in the template to embed or link the file.",
  targetFile: "Target file",
  targetFileDesc: "Path to a file in the vault. New messages are appended to the end",
  attachmentsFolder: "Attachments Folder",
  attachmentsFolderDesc: "Folder where media files will be saved",
  proxyApi: "ProxyAPI",
  transcribeAudio: "Transcribe audio",
  transcribeAudioDesc:
    "During sync, send voice/audio attachments to ProxyAPI ({model}) for speech-to-text, in parallel with saving the file to the vault. The result is inserted below the audio embed via {{transcription}}. Audio file size must not exceed 25 MB.",
  apiKey: "API key",
  apiKeyDesc:
    'Your ProxyAPI key. Enable "Balance request" for this key in the ProxyAPI dashboard.',
  balance: "Balance",
  balanceDesc: "Click Refresh to update your remaining ProxyAPI balance",
  refresh: "Refresh",
  balanceLoading: "Balance: …",
  balanceFailed: "Failed to load ProxyAPI balance",
  balanceCheckFailed: "ProxyAPI balance check failed",
  postProcess: "Post-process transcription",
  postProcessDesc:
    "After transcription, send the text to a chat model with your instructions (cleanup, summary, formatting, etc.).",
  postProcessModel: "Post-process model",
  tokenPricing: "Token pricing",
  tokenPricingSuffix: " — view token costs for each model",
  postProcessPrompt: "Post-process prompt",
  postProcessPromptDesc:
    "Commands for what to do with the transcribed text. Sent as the system message; the transcript is the user message.",
};

const RU: SettingsStrings = {
  settingsLanguage: "Язык настроек",
  settingsLanguageDesc: "Язык этой страницы настроек",
  amveraServer: "Amvera server",
  serverUrl: "URL сервера",
  serverUrlDesc: "Базовый URL сервера синхронизации (без слэша в конце)",
  connectionCheck: "Проверка соединения",
  connectionCheckDesc: "Проверяет доступность сервера и статус синхронизации Telegram",
  check: "Проверить",
  serverUnavailable: "Сервер недоступен",
  syncNotReady: "Сервер доступен. Синхронизация Telegram не готова",
  syncReady: "Сервер доступен. Синхронизация Telegram готова.",
  connectionCheckFailed: "Ошибка проверки соединения",
  obsidianLinks: "Obsidian links",
  templateFile: "Файл шаблона",
  templateFileDesc:
    "Путь к .md-файлу с шаблоном сообщения. Переменные: {{date}}, {{time}}, {{created}}, {{sender}}, {{sender_id}}, {{message_id}}, {{type}}, {{text}}, {{attachment}} (путь в vault), {{file}} (имя файла с расширением), {{transcription}}, {{tags}}. Используйте ![[{{attachment}}]] или [[{{attachment}}]] для вставки или ссылки на файл.",
  targetFile: "Целевой файл",
  targetFileDesc: "Путь к файлу в vault. Новые сообщения добавляются в конец",
  attachmentsFolder: "Папка вложений",
  attachmentsFolderDesc: "Папка, куда сохраняются медиафайлы",
  proxyApi: "ProxyAPI",
  transcribeAudio: "Транскрибация аудио",
  transcribeAudioDesc:
    "При синхронизации голосовые/аудио вложения отправляются в ProxyAPI ({model}) для распознавания речи параллельно с сохранением в vault. Результат вставляется под аудио через {{transcription}}. Размер аудиофайла не должен превышать 25 МБ.",
  apiKey: "API-ключ",
  apiKeyDesc:
    "Ваш ключ ProxyAPI. Включите «Запрос баланса» для этого ключа в личном кабинете ProxyAPI.",
  balance: "Баланс",
  balanceDesc: "Нажмите «Обновить», чтобы загрузить оставшийся баланс ProxyAPI",
  refresh: "Обновить",
  balanceLoading: "Баланс: …",
  balanceFailed: "Не удалось загрузить баланс ProxyAPI",
  balanceCheckFailed: "Ошибка проверки баланса ProxyAPI",
  postProcess: "Постобработка транскрипции",
  postProcessDesc:
    "После транскрибации отправить текст в чат-модель с вашими инструкциями (правка, саммари, форматирование и т.д.).",
  postProcessModel: "Модель постобработки",
  tokenPricing: "Стоимость токенов",
  tokenPricingSuffix: " — цены по моделям",
  postProcessPrompt: "Промпт постобработки",
  postProcessPromptDesc:
    "Инструкции, что сделать с транскрибированным текстом. Отправляется как system message; транскрипт — как user message.",
};

export function getSettingsStrings(lang: SettingsUiLanguage): SettingsStrings {
  return lang === "ru" ? RU : EN;
}
