# Telegram Sync Amvera

Плагин [Obsidian](https://obsidian.md/) для синхронизации сообщений из личного Telegram-бота в vault.

Сообщения сначала попадают на ваш sync-сервер на [Amvera](https://amvera.ru/), а плагин по команде забирает их в заметки. Опционально голосовые и аудио можно транскрибировать через [ProxyAPI](https://proxyapi.ru/).

**Только desktop** (Obsidian 1.5.0+).

---

## Что нужно заранее

1. Установить плагин в Obsidian.
2. Создать Telegram-бота.
3. Развернуть sync-сервер на Amvera.
4. Настроить плагин и проверить связь.

Ниже — по шагам.

---

## 1. Установите плагин

### Через пользовательские (Community) плагины

1. Откройте **Настройки → Сторонние плагины** (Community plugins).
2. Отключите безопасный режим, если он включён.
3. Найдите **Telegram Sync Amvera**, установите и включите.

### Ручная установка

1. Скачайте `main.js`, `manifest.json` и `styles.css` из релизов репозитория плагина.
2. Создайте папку:

```text
<ваш-vault>/.obsidian/plugins/telegram-sync-amvera-r/
```

3. Скопируйте туда все три файла.
4. В **Сторонние плагины** включите **Telegram Sync Amvera**.

На этом этапе плагин уже есть в Obsidian, но без бота и сервера синхронизация работать не будет.

---

## 2. Создайте Telegram-бота

1. В Telegram откройте [@BotFather](https://t.me/BotFather).
2. Отправьте `/newbot`.
3. Укажите **имя** бота (как его будут видеть люди), например: `My Obsidian Sync`.
4. Укажите **username** бота (должен заканчиваться на `bot`), например: `my_obsidian_sync_bot`.
5. BotFather пришлёт **токен** вида:

```text
1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Сохраните токен — он понадобится на сервере (`TELEGRAM_OBSIDIAN_BOT_TOKEN`). Никому его не передавайте.

6. Узнайте свой **Telegram user ID** (число, не username):
   - откройте [@userinfobot](https://t.me/userinfobot) или [@getmyid_bot](https://t.me/getmyid_bot);
   - отправьте любое сообщение и скопируйте ваш `Id` / `user id`.

Этот ID понадобится как `MY_TELEGRAM_USER_ID`: бот принимает сообщения **только от вас**.

7. Откройте своего нового бота в Telegram и нажмите **Start** (`/start`), чтобы чат был активен.

---

## 3. Разверните sync-сервер на Amvera

Плагину нужен backend: он принимает сообщения от бота, кладёт их в очередь и отдаёт Obsidian по API.

Исходники сервера: **[файлы сервера на GitHub](https://github.com/vicstu/YOUR-SERVER-REPO)**  
*(замените ссылку на актуальный репозиторий с кодом Amvera-проекта).*

### 3.1. Регистрация и проект

1. Зарегистрируйтесь на [Amvera](https://amvera.ru/).
2. Создайте новый проект (приложение).
3. Подключите репозиторий с сервером или загрузите файлы проекта в Amvera (как удобнее в вашем тарифе/интерфейсе).

В корне проекта должны быть, в частности:

- `amvera.yml` — сборка и запуск;
- `main.py`, `requirements.txt`;
- код API и Telegram-бота для Obsidian sync.

### 3.2. Переменные окружения

В настройках проекта Amvera задайте:

| Переменная | Значение |
|------------|----------|
| `TELEGRAM_OBSIDIAN_BOT_TOKEN` | токен от BotFather |
| `MY_TELEGRAM_USER_ID` | ваш числовой Telegram user ID |

Без этих переменных sync на сервере не считается настроенным.

При необходимости можно задать также `TELEGRAM_MEDIA_FOLDER` (по умолчанию `/data/telegram_media`) и `LOG_LEVEL`.

Убедитесь, что у приложения есть **постоянное хранилище** (в `amvera.yml` обычно `persistenceMount: /data`) — туда пишется база сообщений.

### 3.3. Запуск

1. Задеплойте / запустите приложение в Amvera.
2. Дождитесь успешного статуса деплоя.
3. Скопируйте **публичный URL** приложения, например:

```text
https://ваш-проект-xxx.amvera.tech
```

Без слэша в конце — его потом вставите в настройки плагина.

### 3.4. Проверьте, что сервер работает

1. В браузере откройте health-эндпоинт вашего приложения (часто `/health`), например:

```text
https://ваш-проект-xxx.amvera.tech/health
```

Должен быть успешный ответ (не ошибка 502/404 от хостинга).

2. Напишите боту в Telegram текст или голосовое — сообщение должно уйти на сервер в очередь.
3. В логах Amvera не должно быть ошибок вроде «токен не задан» или падения при старте бота.

Когда сервер отвечает и бот принимает ваши сообщения — можно настраивать плагин.

---

## 4. Настройка плагина

Откройте **Настройки → Telegram Sync Amvera**.

При желании переключите **язык настроек** на русский.

### Amvera server

| Параметр | Что указать |
|----------|-------------|
| **Server URL** | Публичный URL вашего приложения на Amvera **без** `/` в конце |
| **Connection check** | Нажмите **Check** — сервер должен быть доступен, Telegram sync — ready |

Если Check пишет, что sync не готов: проверьте переменные `TELEGRAM_OBSIDIAN_BOT_TOKEN` и `MY_TELEGRAM_USER_ID` и перезапуск приложения на Amvera.

### Obsidian links

| Параметр | По умолчанию | Назначение |
|----------|--------------|------------|
| **Template file** | `Telegram/template.md` | Шаблон одной записи |
| **Target file** | `Telegram/Inbox.md` | Куда дописываются новые сообщения |
| **Attachments Folder** | `Telegram/Media` | Куда сохраняются медиа |

Файлы и папки создадутся при первой синхронизации, если их ещё нет (шаблон — с содержимым по умолчанию).

### ProxyAPI (необязательно)

Нужно только если хотите транскрибировать голосовые/аудио при sync.

1. Зарегистрируйтесь на [ProxyAPI](https://proxyapi.ru/).
2. Создайте API-ключ. **Обязательно** включите разрешение **«Запрос баланса»** (Balance request) — без него плагин не сможет проверить баланс и нормально работать с ключом.
3. Включите **Transcribe audio**.
4. Вставьте **API key**.
5. При необходимости включите **Post-process transcription**, выберите модель и задайте prompt.

Тарифы: [proxyapi.ru/pricing/list](https://proxyapi.ru/pricing/list).  
Ограничение: размер аудиофайла для транскрибации **не больше 25 МБ**.

---

## 5. Как пользоваться

1. Пишите боту в Telegram (текст, фото, voice, файлы).
2. В Obsidian откройте Command Palette (`Ctrl` / `Cmd` + `P`) и выполните **Fetch new messages**.
3. Новые записи появятся в target-файле, медиа — в папке вложений.

Полезные команды:

| Команда | Действие |
|---------|----------|
| **Fetch new messages** | Забрать новые сообщения с сервера |
| **Check ProxyAPI balance** | Показать баланс ProxyAPI |
| **Open activity log** | Журнал запросов и процессов плагина |

---

## Шаблон сообщения

Переменные в template-файле:

| Переменная | Значение |
|------------|----------|
| `{{date}}` | Дата |
| `{{time}}` | Время |
| `{{created}}` | Дата и время |
| `{{sender}}` | Имя отправителя |
| `{{sender_id}}` | ID отправителя |
| `{{message_id}}` | ID сообщения |
| `{{type}}` | Тип (text, voice, photo, …) |
| `{{text}}` | Текст / подпись |
| `{{attachment}}` | Путь к файлу в vault |
| `{{file}}` | Имя файла |
| `{{transcription}}` | Текст транскрипции |
| `{{tags}}` | Теги (для аудио при включённой транскрибации — `#ГГГГ-месяц` и `#ГГГГ-год`) |

Пример:

```markdown
**{{sender}}** · {{date}} {{time}}
{{tags}}
{{text}}
![[{{attachment}}]]
{{transcription}}
```

Для вставки файла: `![[{{attachment}}]]`, для ссылки: `[[{{attachment}}]]`.

---

## Краткий чеклист

- [ ] Плагин установлен и включён
- [ ] Бот создан в BotFather, токен сохранён
- [ ] Известен ваш Telegram user ID
- [ ] С ботом начат диалог (`/start`)
- [ ] Проект на Amvera создан, файлы сервера загружены
- [ ] Заданы `TELEGRAM_OBSIDIAN_BOT_TOKEN` и `MY_TELEGRAM_USER_ID`
- [ ] Приложение запущено, URL скопирован
- [ ] Health / логи в порядке, бот принимает сообщения
- [ ] В плагине указан Server URL, **Connection check** успешен
- [ ] Выполнена команда **Fetch new messages**

---

## Лицензия

MIT

---

# English

# Telegram Sync Amvera

An [Obsidian](https://obsidian.md/) plugin that syncs messages from your personal Telegram bot into your vault.

Messages first go to your sync server on [Amvera](https://amvera.ru/), and the plugin pulls them into notes on command. Optionally, voice and audio can be transcribed via [ProxyAPI](https://proxyapi.ru/).

**Desktop only** (Obsidian 1.5.0+).

---

## What you need beforehand

1. Install the plugin in Obsidian.
2. Create a Telegram bot.
3. Deploy the sync server on Amvera.
4. Configure the plugin and verify the connection.

Step-by-step below.

---

## 1. Install the plugin

### Via Community plugins

1. Open **Settings → Community plugins**.
2. Turn off Safe mode if it is enabled.
3. Find **Telegram Sync Amvera**, install it, and enable it.

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the plugin repository releases.
2. Create the folder:

```text
<your-vault>/.obsidian/plugins/telegram-sync-amvera-r/
```

3. Copy all three files into that folder.
4. Under **Community plugins**, enable **Telegram Sync Amvera**.

At this point the plugin is in Obsidian, but sync will not work without a bot and server.

---

## 2. Create a Telegram bot

1. In Telegram, open [@BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. Set the bot **name** (what people see), for example: `My Obsidian Sync`.
4. Set the bot **username** (must end with `bot`), for example: `my_obsidian_sync_bot`.
5. BotFather will send a **token** like:

```text
1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save the token — you will need it on the server (`TELEGRAM_OBSIDIAN_BOT_TOKEN`). Do not share it with anyone.

6. Find your **Telegram user ID** (a number, not a username):
   - open [@userinfobot](https://t.me/userinfobot) or [@getmyid_bot](https://t.me/getmyid_bot);
   - send any message and copy your `Id` / `user id`.

This ID is used as `MY_TELEGRAM_USER_ID`: the bot accepts messages **only from you**.

7. Open your new bot in Telegram and press **Start** (`/start`) so the chat is active.

---

## 3. Deploy the sync server on Amvera

The plugin needs a backend: it receives messages from the bot, queues them, and serves them to Obsidian via API.

Server source: **[server files on GitHub](https://github.com/vicstu/YOUR-SERVER-REPO)**  
*(replace the link with the actual repository that contains the Amvera project code).*

### 3.1. Registration and project

1. Sign up at [Amvera](https://amvera.ru/).
2. Create a new project (application).
3. Connect the server repository or upload the project files to Amvera (whichever your plan/UI supports).

The project root should include, among other things:

- `amvera.yml` — build and run config;
- `main.py`, `requirements.txt`;
- API and Telegram bot code for Obsidian sync.

### 3.2. Environment variables

In the Amvera project settings, set:

| Variable | Value |
|----------|-------|
| `TELEGRAM_OBSIDIAN_BOT_TOKEN` | token from BotFather |
| `MY_TELEGRAM_USER_ID` | your numeric Telegram user ID |

Without these variables, sync on the server is not considered configured.

Optionally you can also set `TELEGRAM_MEDIA_FOLDER` (default `/data/telegram_media`) and `LOG_LEVEL`.

Make sure the app has **persistent storage** (in `amvera.yml` usually `persistenceMount: /data`) — that is where the message database is written.

### 3.3. Launch

1. Deploy / start the application on Amvera.
2. Wait for a successful deploy status.
3. Copy the app **public URL**, for example:

```text
https://your-project-xxx.amvera.tech
```

No trailing slash — you will paste it into the plugin settings later.

### 3.4. Verify that the server works

1. In a browser, open your app’s health endpoint (often `/health`), for example:

```text
https://your-project-xxx.amvera.tech/health
```

You should get a successful response (not a hosting 502/404).

2. Send the bot a text or voice message in Telegram — it should be queued on the server.
3. Amvera logs should not show errors like “token not set” or a bot crash on startup.

When the server responds and the bot accepts your messages, you can configure the plugin.

---

## 4. Configure the plugin

Open **Settings → Telegram Sync Amvera**.

Optionally switch the **settings language** to English or Russian.

### Amvera server

| Setting | What to enter |
|---------|---------------|
| **Server URL** | Public URL of your Amvera app **without** a trailing `/` |
| **Connection check** | Click **Check** — the server should be reachable and Telegram sync ready |

If Check says sync is not ready: verify `TELEGRAM_OBSIDIAN_BOT_TOKEN` and `MY_TELEGRAM_USER_ID`, then restart the Amvera app.

### Obsidian links

| Setting | Default | Purpose |
|---------|---------|---------|
| **Template file** | `Telegram/template.md` | Template for one entry |
| **Target file** | `Telegram/Inbox.md` | Where new messages are appended |
| **Attachments Folder** | `Telegram/Media` | Where media files are saved |

Files and folders are created on the first sync if they do not exist yet (the template gets default content).

### ProxyAPI (optional)

Only needed if you want to transcribe voice/audio during sync.

1. Sign up at [ProxyAPI](https://proxyapi.ru/).
2. Create an API key. You **must** enable the **Balance request** permission — without it the plugin cannot check the balance or work with the key properly.
3. Enable **Transcribe audio**.
4. Paste the **API key**.
5. Optionally enable **Post-process transcription**, choose a model, and set a prompt.

Pricing: [proxyapi.ru/pricing/list](https://proxyapi.ru/pricing/list).  
Limit: audio file size for transcription must be **no more than 25 MB**.

---

## 5. How to use

1. Send messages to the bot in Telegram (text, photos, voice, files).
2. In Obsidian, open the Command Palette (`Ctrl` / `Cmd` + `P`) and run **Fetch new messages**.
3. New entries appear in the target file; media go to the attachments folder.

Useful commands:

| Command | Action |
|---------|--------|
| **Fetch new messages** | Pull new messages from the server |
| **Check ProxyAPI balance** | Show ProxyAPI balance |
| **Open activity log** | Plugin request and process log |

---

## Message template

Variables in the template file:

| Variable | Value |
|----------|-------|
| `{{date}}` | Date |
| `{{time}}` | Time |
| `{{created}}` | Date and time |
| `{{sender}}` | Sender name |
| `{{sender_id}}` | Sender ID |
| `{{message_id}}` | Message ID |
| `{{type}}` | Type (text, voice, photo, …) |
| `{{text}}` | Text / caption |
| `{{attachment}}` | Path to the file in the vault |
| `{{file}}` | File name |
| `{{transcription}}` | Transcription text |
| `{{tags}}` | Tags (for audio with transcription enabled — `#YYYY-month` and `#YYYY-year`) |

Example:

```markdown
**{{sender}}** · {{date}} {{time}}
{{tags}}
{{text}}
![[{{attachment}}]]
{{transcription}}
```

To embed a file: `![[{{attachment}}]]`; to link: `[[{{attachment}}]]`.

---

## Quick checklist

- [ ] Plugin installed and enabled
- [ ] Bot created in BotFather, token saved
- [ ] Your Telegram user ID is known
- [ ] Chat with the bot started (`/start`)
- [ ] Amvera project created, server files uploaded
- [ ] `TELEGRAM_OBSIDIAN_BOT_TOKEN` and `MY_TELEGRAM_USER_ID` set
- [ ] App running, URL copied
- [ ] Health / logs OK, bot accepts messages
- [ ] Server URL set in the plugin, **Connection check** succeeded
- [ ] **Fetch new messages** command run

---

## License

MIT
