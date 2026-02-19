/**
 * UTM パラメータ取得・保持ユーティリティ
 *
 * LP 到達時に URL の UTM パラメータを取得し sessionStorage に保持する。
 * Stripe Checkout メタデータやイベント記録時に参照する。
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "opf_utm";
const SESSION_ID_KEY = "opf_session_id";

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

/** LP 到達時に呼ぶ: URL から UTM パラメータを取得し sessionStorage に保存 */
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  let hasUtm = false;

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
      hasUtm = true;
    }
  }

  // UTM パラメータがあれば上書き保存（なければ既存を維持）
  if (hasUtm) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  }

  // セッション ID がなければ生成
  if (!sessionStorage.getItem(SESSION_ID_KEY)) {
    sessionStorage.setItem(SESSION_ID_KEY, generateSessionId());
  }
}

/** 保存済みの UTM パラメータを取得 */
export function getUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as UtmParams) : {};
  } catch {
    return {};
  }
}

/** セッション ID を取得 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/** イベント送信ヘルパー（/api/track に POST） */
export async function trackEvent(
  eventType: string,
  extra?: { pageUrl?: string }
): Promise<void> {
  try {
    const utm = getUtmParams();
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        sessionId: getSessionId(),
        pageUrl: extra?.pageUrl ?? window.location.href,
        referrer: document.referrer || undefined,
        ...utm,
      }),
    });
  } catch {
    // トラッキング失敗はサイレントに無視
  }
}

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `s_${Date.now()}_${result}`;
}
