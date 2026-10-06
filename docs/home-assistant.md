# Home Assistant

PowerPilot integrates with Home Assistant through MQTT Discovery and the generic PowerPilot MQTT state contract.

For each enabled Norwegian price area, PowerPilot can publish retained discovery configuration for one Home Assistant device with three sensors:

- **Spot price** — state from `powerpilot/<area>/price_ore_kwh`, unit `øre/kWh`
- **Price signal** — state from `powerpilot/<area>/signal`
- **Compute policy** — state from `powerpilot/<area>/policy`

Example discovery topics for NO2:

- `homeassistant/sensor/powerpilot_no2/price/config`
- `homeassistant/sensor/powerpilot_no2/signal/config`
- `homeassistant/sensor/powerpilot_no2/policy/config`

Discovery messages and state messages are retained. Home Assistant can therefore reconstruct the PowerPilot device and its current state after reconnecting.

PowerPilot policy values are advisory. Home Assistant automations remain responsible for safety constraints and for controlling actual switches, render nodes, CI runners, miners or other loads.

No Home Assistant credentials or API access are required by the discovery model; both systems communicate through the configured MQTT broker.
