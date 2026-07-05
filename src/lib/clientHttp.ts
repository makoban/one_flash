/**
 * クライアント側 fetch レスポンス読み取りヘルパー
 *
 * iOS Safari (WebKit) では、長時間リクエストの途中で画面ロックや
 * アプリ切替が起きるとレスポンスボディが空/途切れた状態になり、
 * response.json() が "The string did not match the expected pattern."
 * という英語の SyntaxError を投げる。これをユーザーに見せないため、
 * JSON の読み取りは必ずこのヘルパー経由で行う。
 */

/** JSON を読み取り、失敗したら null を返す（リトライ判断用） */
export async function readJsonOrNull<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** JSON を読み取り、失敗したら指定の日本語メッセージで throw する */
export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

/** エラーレスポンスの JSON を読み取る（失敗しても throw しない） */
export async function readErrorResponse(
  response: Response
): Promise<{ error?: string; retryable?: boolean }> {
  try {
    return (await response.json()) as { error?: string; retryable?: boolean };
  } catch {
    return {};
  }
}

/**
 * エラーをユーザー向けの文言に変換する。
 * ブラウザ由来の英語エラー（JSONパース失敗・ネットワーク断など）は
 * fallbackMessage に置き換え、それ以外（サーバーからの日本語メッセージ等）は
 * そのまま表示する。
 */
export function toUserFacingErrorMessage(error: unknown, fallbackMessage: string): string {
  const message = error instanceof Error ? error.message : "";
  if (
    !message ||
    /the string did not match the expected pattern|unexpected end of json input|unexpected token .*json|json parse error|failed to execute 'json'|body stream|failed to fetch|load failed|networkerror|network connection was lost|request timed out|abort/i.test(
      message
    )
  ) {
    return fallbackMessage;
  }
  return message;
}
