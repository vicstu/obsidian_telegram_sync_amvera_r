import { requestUrl } from "obsidian";

import { activityLog } from "./activity-log";

export type TelegramBotAccessResult =
  | { ok: true; botUsername?: string }
  | { ok: false; reason: "no_access" };

/**
 * Calls Telegram Bot API getMe with the given token (direct to api.telegram.org).
 */
export async function checkTelegramBotAccess(
  token: string,
): Promise<TelegramBotAccessResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, reason: "no_access" };
  }

  const url = `https://api.telegram.org/bot${trimmed}/getMe`;
  activityLog.info("telegram", "Checking bot access via getMe");

  try {
    const response = await requestUrl({
      url,
      method: "GET",
    });

    const body = response.json as {
      ok?: boolean;
      result?: { username?: string; first_name?: string };
    };

    if (response.status === 200 && body.ok === true) {
      activityLog.success(
        "telegram",
        "Bot access OK",
        body.result?.username ? `@${body.result.username}` : undefined,
      );
      return { ok: true, botUsername: body.result?.username };
    }

    activityLog.warn(
      "telegram",
      "Bot access denied",
      `HTTP ${response.status}`,
    );
    return { ok: false, reason: "no_access" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    activityLog.error("telegram", "Bot access check failed", message);
    return { ok: false, reason: "no_access" };
  }
}
