import { requestUrl } from "obsidian";

import { activityLog } from "./activity-log";

const PROXYAPI_BALANCE_URL = "https://api.proxyapi.ru/proxyapi/balance";
const PROXYAPI_OPENAI_BASE = "https://api.proxyapi.ru/openai/v1";

export interface ProxyApiBalance {
  balance: number;
  budget?: {
    limit: number;
    used: number;
  };
}

export interface ProxyApiBalanceResult {
  ok: boolean;
  balance?: ProxyApiBalance;
  error?: string;
}

export interface TranscriptionResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface ChatCompletionResult {
  ok: boolean;
  text?: string;
  error?: string;
}

type MultipartField =
  | { name: string; value: string }
  | {
      name: string;
      filename: string;
      contentType: string;
      data: ArrayBuffer;
    };

function concatUint8Arrays(parts: Uint8Array[]): ArrayBuffer {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
}

/** Build multipart/form-data for Obsidian requestUrl (no native FormData support). */
function buildMultipartBody(fields: MultipartField[]): {
  body: ArrayBuffer;
  contentType: string;
} {
  const boundary = `----ObsidianBoundary${Date.now().toString(16)}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  for (const field of fields) {
    parts.push(encoder.encode(`--${boundary}\r\n`));

    if ("filename" in field) {
      parts.push(
        encoder.encode(
          `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n` +
            `Content-Type: ${field.contentType}\r\n\r\n`,
        ),
      );
      parts.push(new Uint8Array(field.data));
      parts.push(encoder.encode("\r\n"));
    } else {
      parts.push(
        encoder.encode(
          `Content-Disposition: form-data; name="${field.name}"\r\n\r\n` +
            `${field.value}\r\n`,
        ),
      );
    }
  }

  parts.push(encoder.encode(`--${boundary}--\r\n`));

  return {
    body: concatUint8Arrays(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export function guessAudioMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ogg: "audio/ogg",
    opus: "audio/ogg",
    mp3: "audio/mpeg",
    mpeg: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    wav: "audio/wav",
    webm: "audio/webm",
    flac: "audio/flac",
  };
  return map[ext] ?? "application/octet-stream";
}

async function requestProxyApiBalance(
  apiKey: string,
): Promise<ProxyApiBalanceResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { ok: false, error: "API key is not configured" };
  }

  try {
    const response = await requestUrl({
      url: PROXYAPI_BALANCE_URL,
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
      },
    });

    if (response.status === 401) {
      return { ok: false, error: "Invalid API key" };
    }

    if (response.status === 403) {
      return {
        ok: false,
        error:
          'Balance access is disabled for this API key. Enable "Balance request" in the ProxyAPI dashboard.',
      };
    }

    if (response.status !== 200) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const body = response.json as ProxyApiBalance;
    if (typeof body.balance !== "number") {
      return { ok: false, error: "Unexpected response from ProxyAPI" };
    }

    return { ok: true, balance: body };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchProxyApiBalance(
  apiKey: string,
): Promise<ProxyApiBalanceResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    activityLog.warn("proxyapi", "Balance check skipped: API key is not configured");
    return { ok: false, error: "API key is not configured" };
  }

  const processId = activityLog.startProcess(
    "ProxyAPI balance",
    `GET ${PROXYAPI_BALANCE_URL}`,
  );

  const result = await requestProxyApiBalance(trimmedKey);

  if (!result.ok || !result.balance) {
    activityLog.endProcess(
      processId,
      "failed",
      "ProxyAPI balance",
      result.error ?? "Failed to load balance",
    );
    return result;
  }

  activityLog.endProcess(
    processId,
    "done",
    "ProxyAPI balance",
    formatProxyApiBalance(result.balance),
  );
  return result;
}

/** After an AI ProxyAPI call, refresh and log the remaining balance. */
export async function checkProxyApiBalanceAfterResponse(
  apiKey: string,
  context: string,
): Promise<void> {
  const result = await requestProxyApiBalance(apiKey);

  if (result.ok && result.balance) {
    activityLog.info(
      "proxyapi",
      `Balance after ${context}`,
      formatProxyApiBalance(result.balance),
    );
    return;
  }

  activityLog.warn(
    "proxyapi",
    `Balance check after ${context} failed`,
    result.error ?? "unknown error",
  );
}

export function formatProxyApiBalance(balance: ProxyApiBalance): string {
  const amount = balance.balance.toFixed(2);

  if (balance.budget) {
    return `${amount} ₽ remaining (limit: ${balance.budget.limit.toFixed(2)} ₽, used: ${balance.budget.used.toFixed(2)} ₽)`;
  }

  return `${amount} ₽`;
}

function extractErrorMessage(responseText: string, status: number): string {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (
      parsed.error &&
      typeof parsed.error === "object" &&
      parsed.error.message?.trim()
    ) {
      return parsed.error.message.trim();
    }
    if (parsed.message?.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // fall through
  }

  const trimmed = responseText.trim();
  if (trimmed) {
    return trimmed.slice(0, 300);
  }
  return `HTTP ${status}`;
}

export async function transcribeAudioViaProxyApi(options: {
  apiKey: string;
  model: string;
  filename: string;
  data: ArrayBuffer;
}): Promise<TranscriptionResult> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    activityLog.warn("proxyapi", "Transcription skipped: API key is not configured");
    return { ok: false, error: "API key is not configured" };
  }

  const model = options.model.trim();
  if (!model) {
    return { ok: false, error: "Transcription model is not configured" };
  }

  const url = `${PROXYAPI_OPENAI_BASE}/audio/transcriptions`;
  const processId = activityLog.startProcess(
    `Transcribe ${options.filename}`,
    `POST ${url} · model=${model} · ${options.data.byteLength} bytes`,
  );

  // Request body: audio.transcriptions.create({ file, model })
  const fields: MultipartField[] = [
    {
      name: "file",
      filename: options.filename,
      contentType: guessAudioMimeType(options.filename),
      data: options.data,
    },
    { name: "model", value: model },
  ];

  activityLog.info(
    "proxyapi",
    `Transcription request: sending audio file`,
    [
      `url: ${url}`,
      `fields: file, model`,
      `model: ${model}`,
      `filename: ${options.filename}`,
      `size: ${options.data.byteLength} bytes`,
    ].join("\n"),
    processId,
  );

  const { body, contentType } = buildMultipartBody(fields);

  try {
    const response = await requestUrl({
      url,
      method: "POST",
      contentType,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    if (response.status < 200 || response.status >= 300) {
      const error = extractErrorMessage(response.text, response.status);
      activityLog.error(
        "proxyapi",
        `Transcription response error for ${options.filename}`,
        error,
        processId,
      );
      activityLog.endProcess(processId, "failed", `Transcribe ${options.filename}`, error);
      return { ok: false, error };
    }

    const payload = response.json as { text?: string } | string;
    const text =
      typeof payload === "string"
        ? payload.trim()
        : payload.text?.trim() ?? "";

    if (!text) {
      activityLog.error(
        "proxyapi",
        `Transcription response empty for ${options.filename}`,
        typeof payload === "string" ? payload : JSON.stringify(payload),
        processId,
      );
      activityLog.endProcess(
        processId,
        "failed",
        `Transcribe ${options.filename}`,
        "Empty transcription response",
      );
      return { ok: false, error: "Empty transcription response" };
    }

    activityLog.success(
      "proxyapi",
      `Transcription response (full text) for ${options.filename}`,
      text,
      processId,
    );
    activityLog.endProcess(
      processId,
      "done",
      `Transcribe ${options.filename}`,
      text,
    );
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    activityLog.endProcess(processId, "failed", `Transcribe ${options.filename}`, message);
    return { ok: false, error: message };
  } finally {
    await checkProxyApiBalanceAfterResponse(
      apiKey,
      `transcription (${options.filename})`,
    );
  }
}

export async function processTextViaProxyApi(options: {
  apiKey: string;
  model: string;
  prompt: string;
  text: string;
}): Promise<ChatCompletionResult> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    activityLog.warn("proxyapi", "Post-process skipped: API key is not configured");
    return { ok: false, error: "API key is not configured" };
  }

  const model = options.model.trim();
  if (!model) {
    return { ok: false, error: "Post-process model is not configured" };
  }

  const prompt = options.prompt.trim();
  const text = options.text.trim();
  if (!text) {
    return { ok: false, error: "No text to process" };
  }

  if (!prompt) {
    activityLog.info("proxyapi", "Post-process skipped: empty prompt");
    return { ok: true, text };
  }

  const url = `${PROXYAPI_OPENAI_BASE}/chat/completions`;
  const processId = activityLog.startProcess(
    "Post-process transcription",
    `POST ${url} · model=${model} · input ${text.length} chars`,
  );

  activityLog.info(
    "proxyapi",
    "Post-process request (full text)",
    [
      `url: ${url}`,
      `model: ${model}`,
      "",
      "--- system prompt ---",
      prompt,
      "",
      "--- transcribed text (user) ---",
      text,
    ].join("\n"),
    processId,
  );

  try {
    const response = await requestUrl({
      url,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text },
        ],
        temperature: 0.2,
      }),
    });

    if (response.status < 200 || response.status >= 300) {
      const error = extractErrorMessage(response.text, response.status);
      activityLog.error(
        "proxyapi",
        "Post-process response error",
        error,
        processId,
      );
      activityLog.endProcess(processId, "failed", "Post-process transcription", error);
      return { ok: false, error };
    }

    const payload = response.json as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      activityLog.error(
        "proxyapi",
        "Post-process response empty",
        JSON.stringify(payload),
        processId,
      );
      activityLog.endProcess(
        processId,
        "failed",
        "Post-process transcription",
        "Empty chat completion response",
      );
      return { ok: false, error: "Empty chat completion response" };
    }

    activityLog.success(
      "proxyapi",
      "Post-process response (full text)",
      content,
      processId,
    );
    activityLog.endProcess(
      processId,
      "done",
      "Post-process transcription",
      content,
    );
    return { ok: true, text: content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    activityLog.endProcess(processId, "failed", "Post-process transcription", message);
    return { ok: false, error: message };
  } finally {
    await checkProxyApiBalanceAfterResponse(apiKey, "post-process");
  }
}
