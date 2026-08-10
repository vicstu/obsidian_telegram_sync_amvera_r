import { App, Editor, Notice, TFile } from "obsidian";

import { activityLog } from "./activity-log";
import { isAudioFilename } from "./note-builder";
import {
  processTextViaProxyApi,
  transcribeAudioViaProxyApi,
} from "./proxyapi";
import { detectSettingsUiLanguage } from "./settings-i18n";
import {
  TelegramSyncSettings,
  TRANSCRIPTION_MODEL,
} from "./types";

const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

/** Wiki embed/link: ![[path]], [[path]], with optional #heading and |alias. */
const WIKI_LINK_RE =
  /!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

/** Markdown image/link: ![alt](path) or [alt](path). */
const MD_LINK_RE =
  /!?\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

type LinkMatch = {
  raw: string;
  linkpath: string;
  start: number;
  end: number;
};

type NoticeStrings = {
  noEditor: string;
  missingKey: string;
  noAudioLink: string;
  fileNotFound: string;
  notAudio: string;
  tooLarge: string;
  working: string;
  failed: string;
  postProcessFailed: string;
  done: string;
};

function notices(): NoticeStrings {
  if (detectSettingsUiLanguage() === "ru") {
    return {
      noEditor: "Откройте заметку в режиме редактирования",
      missingKey: "Задайте ProxyAPI key в настройках плагина",
      noAudioLink:
        "Под курсором или в выделении нет ссылки на аудиофайл",
      fileNotFound: "Аудиофайл не найден в хранилище",
      notAudio: "Файл не является поддерживаемым аудио",
      tooLarge: "Аудиофайл больше 25 МБ — транскрибация недоступна",
      working: "Транскрибация…",
      failed: "Транскрибация не удалась",
      postProcessFailed:
        "Постобработка не удалась, вставлен сырой текст",
      done: "Транскрипция вставлена",
    };
  }

  return {
    noEditor: "Open a note in the editor",
    missingKey: "Set a ProxyAPI key in plugin settings",
    noAudioLink: "No audio file link under cursor or in selection",
    fileNotFound: "Audio file not found in the vault",
    notAudio: "File is not a supported audio type",
    tooLarge: "Audio file exceeds 25 MB — transcription unavailable",
    working: "Transcribing…",
    failed: "Transcription failed",
    postProcessFailed: "Post-process failed, inserted raw transcript",
    done: "Transcription inserted",
  };
}

function decodeLinkpath(raw: string): string {
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep raw
  }
  return path.replace(/\\/g, "/");
}

function collectLinks(text: string, baseOffset = 0): LinkMatch[] {
  const matches: LinkMatch[] = [];

  for (const re of [WIKI_LINK_RE, MD_LINK_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const linkpath = decodeLinkpath(match[1] ?? "");
      if (!linkpath || !isAudioFilename(linkpath)) {
        continue;
      }
      matches.push({
        raw: match[0],
        linkpath,
        start: baseOffset + match.index,
        end: baseOffset + match.index + match[0].length,
      });
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

function pickLink(
  content: string,
  cursorOffset: number,
  selectionFrom: number,
  selectionTo: number,
): LinkMatch | null {
  const hasSelection = selectionTo > selectionFrom;
  const all = collectLinks(content);

  if (hasSelection) {
    const inSelection = all.filter(
      (link) => link.start < selectionTo && link.end > selectionFrom,
    );
    if (inSelection.length > 0) {
      return inSelection[0] ?? null;
    }
    // Selection may be just the path text without brackets — treat as path.
    const selectedRaw = content.slice(selectionFrom, selectionTo);
    const selected = selectedRaw.trim();
    if (selected && isAudioFilename(selected)) {
      const trimStart = selectedRaw.indexOf(selected);
      const start = selectionFrom + trimStart;
      return {
        raw: selected,
        linkpath: decodeLinkpath(selected),
        start,
        end: start + selected.length,
      };
    }
  }

  const underCursor = all.find(
    (link) => link.start <= cursorOffset && cursorOffset <= link.end,
  );
  if (underCursor) {
    return underCursor;
  }

  // Nearest link on the same line as the cursor.
  const lineStart = content.lastIndexOf("\n", Math.max(0, cursorOffset - 1)) + 1;
  const lineEndIdx = content.indexOf("\n", cursorOffset);
  const lineEnd = lineEndIdx === -1 ? content.length : lineEndIdx;
  const onLine = all.filter(
    (link) => link.start >= lineStart && link.end <= lineEnd,
  );
  if (onLine.length === 0) {
    return null;
  }

  return onLine.reduce((best, link) => {
    const bestDist = Math.min(
      Math.abs(best.start - cursorOffset),
      Math.abs(best.end - cursorOffset),
    );
    const dist = Math.min(
      Math.abs(link.start - cursorOffset),
      Math.abs(link.end - cursorOffset),
    );
    return dist < bestDist ? link : best;
  });
}

function resolveAudioFile(
  app: App,
  sourcePath: string,
  linkpath: string,
): TFile | null {
  const dest = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
  if (dest instanceof TFile) {
    return dest;
  }

  const normalized = linkpath.replace(/^\/+/, "");
  const abstract = app.vault.getAbstractFileByPath(normalized);
  return abstract instanceof TFile ? abstract : null;
}

/**
 * Transcribe the audio wiki/markdown link under the cursor or in the selection,
 * then insert the transcript text immediately after that link.
 */
export async function transcribeAudioUnderCursor(
  app: App,
  editor: Editor,
  sourceFile: TFile | null,
  settings: TelegramSyncSettings,
): Promise<void> {
  const t = notices();
  if (!sourceFile) {
    new Notice(t.noEditor, 5000);
    return;
  }

  const apiKey = settings.proxyApiKey.trim();
  if (!apiKey) {
    new Notice(t.missingKey, 6000);
    return;
  }

  const content = editor.getValue();
  const cursor = editor.getCursor();
  const cursorOffset = editor.posToOffset(cursor);
  const from = editor.posToOffset(editor.getCursor("from"));
  const to = editor.posToOffset(editor.getCursor("to"));

  const link = pickLink(content, cursorOffset, Math.min(from, to), Math.max(from, to));
  if (!link) {
    new Notice(t.noAudioLink, 6000);
    return;
  }

  const audioFile = resolveAudioFile(app, sourceFile.path, link.linkpath);
  if (!audioFile) {
    new Notice(`${t.fileNotFound}: ${link.linkpath}`, 6000);
    return;
  }

  if (!isAudioFilename(audioFile.name)) {
    new Notice(t.notAudio, 5000);
    return;
  }

  activityLog.info(
    "command",
    "Transcribe audio under cursor",
    `${audioFile.path} (after ${link.raw})`,
  );

  new Notice(`${t.working} ${audioFile.name}`, 4000);

  let buffer: ArrayBuffer;
  try {
    buffer = await app.vault.readBinary(audioFile);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    activityLog.error("command", "Failed to read audio file", detail);
    new Notice(`${t.failed}: ${detail}`, 8000);
    return;
  }

  if (buffer.byteLength > MAX_TRANSCRIPTION_BYTES) {
    new Notice(t.tooLarge, 8000);
    return;
  }

  const transcription = await transcribeAudioViaProxyApi({
    apiKey,
    model: TRANSCRIPTION_MODEL,
    filename: audioFile.name,
    data: buffer,
  });

  if (!transcription.ok || !transcription.text) {
    const err = transcription.error ?? "unknown error";
    new Notice(`${t.failed}: ${err}`, 8000);
    return;
  }

  let text = transcription.text;

  if (settings.postProcessTranscription) {
    const processed = await processTextViaProxyApi({
      apiKey,
      model: settings.postProcessModel,
      prompt: settings.postProcessPrompt,
      text,
    });

    if (!processed.ok || !processed.text) {
      new Notice(t.postProcessFailed, 8000);
    } else {
      text = processed.text;
    }
  }

  const insertAt = editor.offsetToPos(link.end);
  const insertion = text.startsWith("\n") ? text : `\n${text}`;
  editor.replaceRange(insertion, insertAt);

  activityLog.success(
    "command",
    `Transcription inserted after ${audioFile.name}`,
    text,
  );
  new Notice(t.done, 4000);
}
