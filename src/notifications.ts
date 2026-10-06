import { classifyPrice, type HourlyPrice, type Thresholds } from "./domain";

const KEY = "powerpilot.notified";

export type NotificationCandidate = {
  id: string;
  title: string;
  body: string;
};

export function notificationCandidate(
  price: HourlyPrice,
  thresholds: Thresholds,
): NotificationCandidate | null {
  const signal = classifyPrice(price.orePerKwh, thresholds);
  if (signal === "normal") return null;

  const id = `${price.area}:${price.startsAt}:${signal}`;
  const label =
    signal === "negative" ? "Negative electricity price" :
    signal === "favourable" ? "Favourable electricity price" :
    "Expensive electricity price";

  return {
    id,
    title: `PowerPilot · ${label}`,
    body: `${price.area}: ${price.orePerKwh.toFixed(1)} øre/kWh`,
  };
}

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export async function notifyPrice(
  price: HourlyPrice,
  thresholds: Thresholds,
): Promise<boolean> {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const candidate = notificationCandidate(price, thresholds);
  if (!candidate) return false;

  const notified = seen();
  if (notified.has(candidate.id)) return false;

  const registration = await navigator.serviceWorker?.ready;
  if (registration) {
    await registration.showNotification(candidate.title, { body: candidate.body, tag: candidate.id });
  } else {
    new Notification(candidate.title, { body: candidate.body, tag: candidate.id });
  }

  notified.add(candidate.id);
  localStorage.setItem(KEY, JSON.stringify([...notified].slice(-200)));
  return true;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}
