/**
 * UTM パラメータ取得・保持ユーティリティ
 *
 * LP 到達時に URL の UTM パラメータを取得し sessionStorage に保持する。
 * Stripe Checkout メタデータやイベント記録時に参照する。
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "opf_utm";
const SESSION_ID_KEY = "opf_session_id";

const PATH_CAMPAIGNS: Record<string, UtmParams> = {
  "/start": {
    utm_source: "x",
    utm_medium: "paid_social",
    utm_campaign: "oneflash_9500_202607",
    utm_content: "ad01",
  },
};

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  twclid?: string;
}

/** LP 到達時に呼ぶ: URL から UTM パラメータを取得し sessionStorage に保存 */
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const pathCampaign = PATH_CAMPAIGNS[window.location.pathname];
  const utm: UtmParams = { ...(pathCampaign ?? {}) };
  let hasUtm = Boolean(pathCampaign);

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
      hasUtm = true;
    }
  }

  // Google Ads の gclid パラメータをキャプチャ
  const gclid = params.get("gclid");
  if (gclid) {
    utm.gclid = gclid;
    // gclid があれば utm_source/medium を自動設定（未設定の場合のみ）
    if (!utm.utm_source) utm.utm_source = "google";
    if (!utm.utm_medium) utm.utm_medium = "cpc";
    hasUtm = true;
  }

  // X Ads の Click ID。X 公式の計測では twclid を下流計測に使う。
  const twclid = params.get("twclid");
  if (twclid) {
    utm.twclid = twclid;
    if (!utm.utm_source) utm.utm_source = "x";
    if (!utm.utm_medium) utm.utm_medium = "paid_social";
    hasUtm = true;
  }

  // UTM もクリックIDもない場合、referrer から流入元を推定
  if (!hasUtm) {
    const referrer = document.referrer;
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (referrer && !existing) {
      const hostname = getReferrerHostname(referrer);
      if (hostname.includes("google.")) {
        // Google 検索からの流入（オーガニック）
        utm.utm_source = "google";
        utm.utm_medium = "organic";
        hasUtm = true;
      } else if (
        hostname === "x.com" ||
        hostname.endsWith(".x.com") ||
        hostname === "twitter.com" ||
        hostname.endsWith(".twitter.com") ||
        hostname === "t.co"
      ) {
        utm.utm_source = "x";
        utm.utm_medium = "social";
        hasUtm = true;
      }
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
  extra?: { pageUrl?: string; step?: string }
): Promise<void> {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTrackPayload(eventType, extra)),
    });
  } catch {
    // トラッキング失敗はサイレントに無視
  }
}

/** ページ遷移直前でも落ちにくい sendBeacon 版 */
export function trackEventBeacon(
  eventType: string,
  extra?: { pageUrl?: string; step?: string }
): void {
  try {
    const payload = buildTrackPayload(eventType, extra);
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    if (!navigator.sendBeacon("/api/track", blob)) {
      void trackEvent(eventType, extra);
    }
  } catch {
    // トラッキング失敗はサイレントに無視
  }
}

/** X Pixel のイベントIDが設定されている場合だけ送信する */
export function trackXPixelEvent(
  eventId: string | undefined,
  params?: Record<string, unknown>
): void {
  if (!eventId || typeof window === "undefined") return;
  const twq = (window as unknown as { twq?: (...args: unknown[]) => void }).twq;
  if (typeof twq !== "function") return;

  const utm = getUtmParams();
  twq("event", eventId, {
    ...params,
    ...(utm.twclid ? { twclid: utm.twclid } : {}),
  });
}

function buildTrackPayload(
  eventType: string,
  extra?: { pageUrl?: string; step?: string }
): Record<string, unknown> {
  const utm = getUtmParams();
  return {
    eventType,
    sessionId: getSessionId(),
    pageUrl: extra?.pageUrl ?? window.location.href,
    referrer: document.referrer || undefined,
    step: extra?.step,
    ...utm,
  };
}

function getReferrerHostname(referrer: string): string {
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return referrer.toLowerCase();
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
