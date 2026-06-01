// Native push notification utilities + Web Push subscription
import { supabase } from "@/integrations/supabase/client";

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    swRegistration =
      (await navigator.serviceWorker.getRegistration("/")) ??
      (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
    swRegistration.update().catch(() => {});
    await navigator.serviceWorker.ready;
    swRegistration = (await navigator.serviceWorker.getRegistration("/")) ?? swRegistration;
    return swRegistration;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;

  try {
    // Some older browsers use callback-based requestPermission
    const result = await new Promise<NotificationPermission>((resolve) => {
      const promise = Notification.requestPermission(resolve);
      if (promise) promise.then(resolve);
    });
    return result === "granted";
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe this browser to Web Push and persist to DB.
 * Safe to call multiple times — it's idempotent.
 */
export async function subscribeToPush(userId: string | null): Promise<boolean> {
  try {
    const reg = await registerServiceWorker();
    if (!reg || !reg.pushManager) {
      console.error("Service Worker or Push Manager not available");
      return false;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return false;

    // Fetch the VAPID public key from edge function
    const { data: keyData, error: keyErr } = await supabase.functions.invoke("send-push", {
      body: { action: "get_public_key" },
    });
    if (keyErr || !keyData?.publicKey) {
      console.error("Failed to fetch VAPID key:", keyErr);
      return false;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const keyBytes = urlBase64ToUint8Array(keyData.publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error("Subscription JSON missing required fields:", json);
      return false;
    }

    const { error: upsertErr } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId ?? null,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: "endpoint" }
    );

    if (upsertErr) {
      console.error("Failed to persist push subscription to DB:", upsertErr);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function showNativeNotification(title: string, body: string, icon?: string) {
  try {
    if ("vibrate" in navigator) navigator.vibrate?.([100, 50, 100]);
  } catch {
    void 0;
  }
  playNotificationSound();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const opts: NotificationOptions = {
    body,
    icon: icon || "/favicon.png",
    badge: "/favicon.png",
    tag: `dmh-${Date.now()}`,
    requireInteraction: false,
  };

  if (swRegistration && "showNotification" in swRegistration) {
    swRegistration.showNotification(title, opts).catch(() => fallbackNotification(title, opts));
  } else {
    fallbackNotification(title, opts);
  }
}

function fallbackNotification(title: string, opts: NotificationOptions) {
  try {
    const n = new Notification(title, opts);
    setTimeout(() => n.close(), 6000);
  } catch {
    void 0;
  }
}

const NOTIFICATION_SOUND_B64 = (() => {
  const sampleRate = 22050;
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.max(0, 1 - t / duration);
    const sample = env * (0.5 * Math.sin(2 * Math.PI * 880 * t) + 0.3 * Math.sin(2 * Math.PI * 1320 * t));
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return "data:audio/wav;base64," + base64;
})();

export function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_B64);
    audio.volume = 1.0;
    audio.play().catch(() => undefined);
  } catch {
    void 0;
  }
}
