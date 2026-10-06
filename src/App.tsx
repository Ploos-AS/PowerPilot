import { useEffect, useState } from "react";
import { classifyPrice, DEFAULT_THRESHOLDS, type PriceArea, type Thresholds } from "./domain";
import { usePrices } from "./usePrices";
import { cheapestWindows } from "./priceWindows";
import { notifyPrice, requestNotificationPermission } from "./notifications";
import { DEFAULT_AUTOMATION_SETTINGS, loadAutomationSettings, saveAutomationSettings, type AutomationSettings } from "./automationSettings";
import { createAutomationEvent } from "./automation";
import { dispatchAutomation } from "./automationDispatcher";
import { aggregateSavings } from "./savingsHistory";
import { SavingsHistoryRepository } from "./savingsStorage";
import "./style.css";

type SavingsPeriod = "today" | "week" | "month" | "all";

function savingsRange(period: SavingsPeriod, now = new Date()): [string | undefined, string | undefined] {
  if (period === "all") return [undefined, undefined];
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === "week") {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
  } else if (period === "month") {
    from.setDate(1);
  }
  return [from.toISOString(), undefined];
}

const AREAS: PriceArea[] = ["NO1", "NO2", "NO3", "NO4", "NO5"];

function load(): Thresholds {
  try {
    const saved = localStorage.getItem("powerpilot.thresholds");
    return saved ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(saved) } : DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export default function App() {
  const [area, setArea] = useState<PriceArea>("NO2");
  const [thresholds, setThresholds] = useState<Thresholds>(load);
  const [notificationStatus, setNotificationStatus] = useState<string>("Notifications off");
  const [automation, setAutomation] = useState<AutomationSettings>(loadAutomationSettings);
  const [savingsPeriod, setSavingsPeriod] = useState<SavingsPeriod>("month");
  const [savingsRecords] = useState(() => {
    try { return new SavingsHistoryRepository(localStorage).load(); } catch { return []; }
  });
  const loadState = usePrices(area);
  const prices = loadState.prices;
  const now = Date.now();
  const current = prices.reduce((best, price) => {
    const distance = Math.abs(new Date(price.startsAt).getTime() - now);
    const bestDistance = Math.abs(new Date(best.startsAt).getTime() - now);
    return distance < bestDistance ? price : best;
  }, prices[0]);

  const update = (next: Thresholds) => {
    setThresholds(next);
    localStorage.setItem("powerpilot.thresholds", JSON.stringify(next));
  };

  const signal = classifyPrice(current.orePerKwh, thresholds);
  const windows = cheapestWindows(prices);
  const [savingsFrom, savingsTo] = savingsRange(savingsPeriod);
  const savings = aggregateSavings(savingsRecords, savingsFrom, savingsTo);

  useEffect(() => {
    if (loadState.source !== "live") return;
    void notifyPrice(current, thresholds);
    const event = createAutomationEvent(current, thresholds, loadState.source);
    void dispatchAutomation(event, automation);
  }, [current.startsAt, current.orePerKwh, loadState.source, thresholds, automation]);

  const updateAutomation = (next: AutomationSettings) => {
    setAutomation(next);
    saveAutomationSettings(next);
  };

  const enableNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationStatus(permission === "granted" ? "Notifications enabled" : permission === "unsupported" ? "Notifications unsupported" : "Notifications not enabled");
  };

  return <main>
    <header>
      <div>
        <p className="eyebrow">Ploos AS</p>
        <h1>PowerPilot</h1>
        <p>Price signals for flexible electrical workloads.</p>
      </div>
      <select aria-label="Price area" value={area} onChange={e => setArea(e.target.value as PriceArea)}>
        {AREAS.map(a => <option key={a}>{a}</option>)}
      </select>
    </header>

    <section className={"hero " + signal}>
      <span>Current signal</span>
      <strong>{signal.toUpperCase()}</strong>
      <b>{current.orePerKwh.toFixed(1)} øre/kWh</b>
      <small>{loadState.message}</small>
    </section>

    <p className={"source " + loadState.status}>
      Source: {loadState.source === "live" ? "Hva koster strømmen" : "PowerPilot mock"}.
      Live values are spot/base energy prices, not total household cost.
    </p>

    <section className="notifications">
      <button type="button" onClick={enableNotifications}>Enable price notifications</button>
      <span>{notificationStatus}</span>
      <small>Opt-in alerts for negative, favourable and expensive live prices.</small>
    </section>

    <section className="settings">
      <h2>Automation outputs</h2>
      <label><input type="checkbox" checked={automation.enabled}
        onChange={e => updateAutomation({ ...automation, enabled: e.target.checked })}/> Enable outbound automation</label>
      <label><input type="checkbox" checked={automation.webhookEnabled}
        onChange={e => updateAutomation({ ...automation, webhookEnabled: e.target.checked })}/> Webhook</label>
      <label>Webhook URL <input type="url" value={automation.webhookUrl}
        onChange={e => updateAutomation({ ...automation, webhookUrl: e.target.value })}/></label>
      <label><input type="checkbox" checked={automation.mqttEnabled}
        onChange={e => updateAutomation({ ...automation, mqttEnabled: e.target.checked })}/> MQTT over WebSocket</label>
      <label>MQTT WebSocket URL <input type="url" value={automation.mqttWebSocketUrl}
        onChange={e => updateAutomation({ ...automation, mqttWebSocketUrl: e.target.value })}/></label>
      <label><input type="checkbox" checked={automation.homeAssistantDiscovery}
        onChange={e => updateAutomation({ ...automation, homeAssistantDiscovery: e.target.checked })}/> Home Assistant MQTT Discovery</label>
      <small>Transport settings are stored locally. Do not put passwords or tokens in these fields.</small>
    </section>

    <section className="settings">
      <label>Favourable below <input type="number" value={thresholds.favourableBelow}
        onChange={e => update({ ...thresholds, favourableBelow: Number(e.target.value) })}/> øre/kWh</label>
      <label>Expensive above <input type="number" value={thresholds.expensiveAbove}
        onChange={e => update({ ...thresholds, expensiveAbove: Number(e.target.value) })}/> øre/kWh</label>
    </section>

    <section>
      <h2>Cheapest continuous windows</h2>
      <div className="windows">{windows.map(window => {
        const start = new Date(window.startsAt);
        const end = new Date(window.endsAt);
        return <article key={window.hours}>
          <strong>{window.hours}h</strong>
          <span>{start.toLocaleDateString(undefined, { weekday: "short" })} {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}–{end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          <b>{window.averageOrePerKwh.toFixed(1)} øre/kWh avg.</b>
        </article>;
      })}</div>
    </section>

    <section>
      <h2>Available day-ahead hours</h2>
      <div className="hours">{prices.map(p => {
        const d = new Date(p.startsAt);
        const s = classifyPrice(p.orePerKwh, thresholds);
        return <article className={s} key={p.startsAt}>
          <time>{d.toLocaleDateString(undefined, { weekday: "short" })} {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
          <strong>{p.orePerKwh.toFixed(1)}</strong><span>øre/kWh</span>
        </article>;
      })}</div>
    </section>
  </main>;
}
