import { getLanguage } from "obsidian";

export type SettingsUiLanguage = "en" | "ru";

/** Resolve settings UI language from Obsidian app language. Non-Russian → English. */
export function detectSettingsUiLanguage(): SettingsUiLanguage {
  let code = "";

  try {
    if (typeof getLanguage === "function") {
      code = getLanguage();
    }
  } catch {
    // Older Obsidian builds may not expose getLanguage.
  }

  if (!code) {
    code = window.localStorage.getItem("language") ?? "";
  }

  const normalized = code.trim().toLowerCase();
  return normalized === "ru" || normalized.startsWith("ru-") ? "ru" : "en";
}

type SettingsStrings = {
  about: string;
  aboutIntro: string;
  aboutBulletDirect: string;
  aboutBulletViaServer: string;
  aboutViaServerNote: string;
  architecture: string;
  architectureDesc: string;
  architectureDirect: string;
  architectureViaServer: string;
  architectureDirectHint: string;
  viaServerMode: string;
  viaServerModeDesc: string;
  viaServerUseDefaults: string;
  viaServerConfigure: string;
  telegram: string;
  telegramBotToken: string;
  telegramBotTokenDesc: string;
  telegramUserId: string;
  telegramUserIdDesc: string;
  telegramUserIdDescDefault: string;
  telegramCheck: string;
  telegramCheckDesc: string;
  telegramAccessOk: string;
  telegramAccessOkPending: string;
  telegramAccessOkNoPending: string;
  telegramAccessDenied: string;
  telegramCheckMissingServer: string;
  telegramCheckMissingToken: string;
  telegramCheckMissingUserId: string;
  telegramCheckNoBotAccess: string;
  telegramCheckQueueFailed: string;
  syncServer: string;
  syncServerRepoNote: string;
  defaultBotConnectNote: string;
  useDefaultServer: string;
  useDefaultServerDesc: string;
  useDefaultServerOption: string;
  useCustomServer: string;
  serverUrl: string;
  serverUrlDesc: string;
  connectionCheck: string;
  connectionCheckDesc: string;
  check: string;
  serverUnavailable: string;
  syncNotReady: string;
  syncReady: string;
  connectionCheckFailed: string;
  directNotImplemented: string;
  missingBotToken: string;
  missingCustomServer: string;
  obsidianLinks: string;
  templateFile: string;
  templateFileDesc: string;
  targetFile: string;
  targetFileDesc: string;
  attachmentsFolder: string;
  attachmentsFolderDesc: string;
  proxyApi: string;
  proxyApiDesc: string;
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
  about: "About",
  aboutIntro:
    "There are several ways to set up the architecture, depending on whether you have direct access to the Telegram Bot API or it is blocked in your network.",
  aboutBulletDirect:
    "Telegram → Obsidian — if access is available, the plugin requests data from Telegram directly.",
  aboutBulletViaServer:
    "Telegram → server → Obsidian — if access is blocked, data is requested from an intermediate sync server.",
  aboutViaServerNote:
    "In the second case you can use the default shared server or deploy your own and point the plugin to it.",
  architecture: "Architecture",
  architectureDesc:
    "How messages are delivered to Obsidian. Only via-server can be selected for now; direct mode is listed but not available yet.",
  architectureDirect: "1. Telegram → Obsidian",
  architectureViaServer: "2. Telegram → server → Obsidian",
  architectureDirectHint:
    "Direct mode will fetch messages from Telegram inside the plugin. Configure your bot token below. (Direct fetch is not implemented yet — use via-server for now.)",
  viaServerMode: "Server and bot",
  viaServerModeDesc:
    "Use the shared default server and bot, or configure your own",
  viaServerUseDefaults: "Use default server and Telegram bot",
  viaServerConfigure: "Configure server and Telegram bot",
  telegram: "Telegram",
  telegramBotToken: "Bot API token",
  telegramBotTokenDesc:
    "Token from @BotFather. Sent to your custom sync server as the API auth token.",
  telegramUserId: "User ID",
  telegramUserIdDesc:
    "Your numeric Telegram user ID (not username). You can get it from @userinfobot or @getmyid_bot.",
  telegramUserIdDescDefault:
    "Your numeric Telegram user ID (not username). You can find it after you start the default bot.",
  telegramCheck: "Connection check",
  telegramCheckDesc:
    "Send any message to the bot in Telegram, then press Check. Verifies server auth and whether there are pending (unsynced) messages for your User ID.",
  telegramAccessOk: "Access established",
  telegramAccessOkPending:
    "Access OK. Unsynced messages in queue: {count}. Run Fetch new messages to import them.",
  telegramAccessOkNoPending:
    "Server auth OK, but the queue is empty for this User ID. Send a message to the bot and press Check again.",
  telegramAccessDenied: "No access",
  telegramCheckMissingServer: "Server is not specified",
  telegramCheckMissingToken: "Telegram API token is not specified",
  telegramCheckMissingUserId: "Telegram user ID is not specified",
  telegramCheckNoBotAccess: "No access to the bot",
  telegramCheckQueueFailed: "Could not read the message queue from the server",
  syncServer: "Sync server",
  syncServerRepoNote:
    "Server code on ",
  defaultBotConnectNote:
    "Connect to the default bot in Telegram and press Start:",
  useDefaultServer: "Server",
  useDefaultServerDesc:
    "Default shared server, or your own sync server URL",
  useDefaultServerOption: "Default (shared server)",
  useCustomServer: "Custom server",
  serverUrl: "Server URL",
  serverUrlDesc: "Base URL of your sync server (no trailing slash)",
  connectionCheck: "Connection check",
  connectionCheckDesc: "Checks server availability and Telegram sync status",
  check: "Check",
  serverUnavailable: "Server unavailable",
  syncNotReady: "Server is up. Telegram sync is not ready",
  syncReady: "Server is up. Telegram sync is ready.",
  connectionCheckFailed: "Connection check failed",
  directNotImplemented:
    "Telegram → Obsidian (direct) is not implemented yet. Switch architecture to Telegram → server → Obsidian.",
  missingBotToken: "Enter the Telegram bot API token",
  missingCustomServer: "Enter your custom server URL",
  obsidianLinks: "Obsidian links",
  templateFile: "Template file",
  templateFileDesc:
    "Path to a .md file with the message template. Variables: {{date}}, {{time}}, {{created}}, {{sender}}, {{sender_id}}, {{message_id}}, {{type}}, {{text}}, {{attachment}} (vault path), {{file}} (filename with extension), {{transcription}}, {{tags}}. Use ![[{{attachment}}]] or [[{{attachment}}]] in the template to embed or link the file.",
  targetFile: "Target file",
  targetFileDesc: "Path to a file in the vault. New messages are appended to the end",
  attachmentsFolder: "Attachments Folder",
  attachmentsFolderDesc: "Folder where media files will be saved",
  proxyApi: "ProxyAPI",
  proxyApiDesc:
    "To transcribe audio to text, register at proxyapi.ru, create an API key, and enable it below.",
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
  about: "About",
  aboutIntro:
    "Есть несколько вариантов настройки архитектуры в зависимости от того, есть ли у вас прямой доступ к API Telegram или он закрыт.",
  aboutBulletDirect:
    "Telegram → Obsidian — если доступ есть, данные запрашивает сам плагин напрямую из Telegram.",
  aboutBulletViaServer:
    "Telegram → Sync server → Obsidian — если доступа нет, данные запрашиваются с промежуточного сервера синхронизации.",
  aboutViaServerNote:
    "Во втором случае можно использовать сервер по умолчанию или развернуть свой и указать его в настройках.",
  architecture: "Архитектура",
  architectureDesc:
    "Как сообщения попадают в Obsidian. Сейчас можно выбрать только режим через sync-сервер; прямой режим показан в списке, но пока недоступен.",
  architectureDirect: "Telegram → Obsidian",
  architectureViaServer: "Telegram → sync server → Obsidian",
  architectureDirectHint:
    "В прямом режиме плагин будет запрашивать сообщения у Telegram сам. Укажите токен бота ниже. (Прямой режим пока не реализован — сейчас используйте вариант через сервер.)",
  viaServerMode: "Сервер и бот",
  viaServerModeDesc:
    "Использовать общий сервер и бота по умолчанию или настроить свои",
  viaServerUseDefaults: "По умолчанию",
  viaServerConfigure: "Настроить",
  telegram: "Telegram",
  telegramBotToken: "API-токен бота",
  telegramBotTokenDesc:
    "Токен от @BotFather. Передаётся на ваш сервер синхронизации как API-токен.",
  telegramUserId: "User ID",
  telegramUserIdDesc:
    "Ваш числовой Telegram user ID (не username). Можно узнать у @userinfobot или @getmyid_bot.",
  telegramUserIdDescDefault:
    "Ваш числовой Telegram user ID (не username). Его можно узнать после того, как запустите бота по умолчанию.",
  telegramCheck: "Проверить",
  telegramCheckDesc:
    "Напишите боту любое сообщение в Telegram, затем нажмите «Проверить». Проверяется авторизация на сервере и наличие несинхронизированных сообщений для вашего User ID.",
  telegramAccessOk: "Доступ установлен",
  telegramAccessOkPending:
    "Доступ есть. Несинхронизированных сообщений в очереди: {count}. Выполните Fetch new messages, чтобы забрать их.",
  telegramAccessOkNoPending:
    "Авторизация на сервере успешна, но очередь для этого User ID пуста. Напишите боту сообщение и нажмите «Проверить» снова.",
  telegramAccessDenied: "Нет доступа",
  telegramCheckMissingServer: "Не указан сервер",
  telegramCheckMissingToken: "Не указан API-токен в Telegram",
  telegramCheckMissingUserId: "Не указан User ID в Telegram",
  telegramCheckNoBotAccess: "Нет доступа к боту",
  telegramCheckQueueFailed: "Не удалось прочитать очередь сообщений с сервера",
  syncServer: "Сервер синхронизации",
  syncServerRepoNote:
    "Код сервера на ",
  defaultBotConnectNote:
    "Подключитесь к боту по умолчанию в Telegram и нажмите Start:",
  useDefaultServer: "Сервер",
  useDefaultServerDesc:
    "Общий сервер по умолчанию или URL вашего собственного сервера",
  useDefaultServerOption: "По умолчанию (общий сервер)",
  useCustomServer: "Свой сервер",
  serverUrl: "URL сервера",
  serverUrlDesc: "Базовый URL вашего сервера синхронизации (без слэша в конце)",
  connectionCheck: "Проверка соединения",
  connectionCheckDesc: "Проверяет доступность сервера и статус синхронизации Telegram",
  check: "Проверить",
  serverUnavailable: "Сервер недоступен",
  syncNotReady: "Сервер доступен. Синхронизация Telegram не готова",
  syncReady: "Сервер доступен. Синхронизация Telegram готова.",
  connectionCheckFailed: "Ошибка проверки соединения",
  directNotImplemented:
    "Режим Telegram → Obsidian (напрямую) пока не реализован. Выберите архитектуру Telegram → server → Obsidian.",
  missingBotToken: "Укажите API-токен Telegram-бота",
  missingCustomServer: "Укажите URL своего сервера",
  obsidianLinks: "Obsidian links",
  templateFile: "Файл шаблона",
  templateFileDesc:
    "Путь к .md-файлу с шаблоном сообщения. Переменные: {{date}}, {{time}}, {{created}}, {{sender}}, {{sender_id}}, {{message_id}}, {{type}}, {{text}}, {{attachment}} (путь в vault), {{file}} (имя файла с расширением), {{transcription}}, {{tags}}. Используйте ![[{{attachment}}]] или [[{{attachment}}]] для вставки или ссылки на файл.",
  targetFile: "Целевой файл",
  targetFileDesc: "Путь к файлу в vault. Новые сообщения добавляются в конец",
  attachmentsFolder: "Папка вложений",
  attachmentsFolderDesc: "Папка, куда сохраняются медиафайлы",
  proxyApi: "ProxyAPI",
  proxyApiDesc:
    "Для транскрибации аудио в текст зарегистрируйтесь на proxyapi.ru, создайте API-ключ и включите опцию ниже.",
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

export function getSettingsStrings(lang?: SettingsUiLanguage): SettingsStrings {
  const resolved = lang ?? detectSettingsUiLanguage();
  return resolved === "ru" ? RU : EN;
}
