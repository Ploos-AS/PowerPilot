# PowerPilot

PowerPilot is a progressive web app for electricity-price signals and flexible workloads.

## M0

M0 is an advisory-only baseline. It provides:

- Norwegian price areas NO1–NO5, with NO2 as the default
- four signals: negative, favourable, normal, and expensive
- a deterministic 48-hour mock price provider
- configurable favourable/expensive thresholds stored locally
- an installable PWA shell with a service worker
- unit tests for price classification

No workload is switched automatically in M0.

## Development

Requires Node.js 22.

```sh
npm install
npm test
npm run build
npm run dev
```

## Roadmap

M1 adds live electricity prices, notifications, and cheapest contiguous windows. M2 adds MQTT, webhooks, and Home Assistant integration. M3 adds workload scheduling for compute, rendering, and mining. M4 adds tariff-aware effective-cost modelling and automation policies.

## License

MIT
