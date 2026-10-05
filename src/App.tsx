import { useState } from "react";
import { classifyPrice, DEFAULT_THRESHOLDS, type PriceArea, type Thresholds } from "./domain";
import { usePrices } from "./usePrices";
import "./style.css";

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

    <section className="settings">
      <label>Favourable below <input type="number" value={thresholds.favourableBelow}
        onChange={e => update({ ...thresholds, favourableBelow: Number(e.target.value) })}/> øre/kWh</label>
      <label>Expensive above <input type="number" value={thresholds.expensiveAbove}
        onChange={e => update({ ...thresholds, expensiveAbove: Number(e.target.value) })}/> øre/kWh</label>
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
