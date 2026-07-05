/**
 * 画面ロック防止（Screen Wake Lock API）ユーティリティ
 *
 * AI生成などの長い処理中にスマホの画面が消灯すると、iOS Safari では
 * 通信や JavaScript が中断されて処理が失敗しやすくなる。
 * 対応ブラウザ（iOS Safari 16.4+ / Chrome 等）では処理中だけ画面を
 * 点灯し続ける。非対応ブラウザでは何もしない（完全に無害）。
 *
 * 使い方:
 *   const releaseWakeLock = acquireScreenWakeLock();
 *   try { ...長い処理... } finally { releaseWakeLock(); }
 */

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

type WakeLockNavigator = {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

/** 画面ロック防止を開始し、解除用の関数を返す */
export function acquireScreenWakeLock(): () => void {
  if (typeof navigator === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }
  const wakeLock = (navigator as unknown as WakeLockNavigator).wakeLock;
  if (typeof wakeLock?.request !== "function") {
    return () => undefined;
  }

  let sentinel: WakeLockSentinelLike | null = null;
  let active = true;

  const request = async (): Promise<void> => {
    try {
      const acquired = await wakeLock.request("screen");
      if (active) {
        sentinel = acquired;
      } else {
        void acquired.release().catch(() => undefined);
      }
    } catch {
      // 低電力モード等で拒否されることがある。失敗しても機能に影響はない。
      sentinel = null;
    }
  };

  // タブがバックグラウンドに回ると自動解放されるため、復帰時に再取得する
  const handleVisibilityChange = (): void => {
    if (active && document.visibilityState === "visible") {
      void request();
    }
  };

  void request();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    active = false;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}
