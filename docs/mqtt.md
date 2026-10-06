# MQTT integration

PowerPilot uses MQTT as a generic outbound state interface. MQTT consumers remain responsible for deciding whether and how to act on a PowerPilot policy hint.

## Topics

For price area `NO2`:

- `powerpilot/no2/automation` — complete `powerpilot.automation.v1` JSON event
- `powerpilot/no2/signal` — `negative`, `favourable`, `normal`, or `expensive`
- `powerpilot/no2/policy` — compute policy hint
- `powerpilot/no2/price_ore_kwh` — spot/base price in øre/kWh

All state publications are retained so a newly connected consumer immediately receives the current state.

## Policy hints

- `ALLOW_LOW_PRIORITY_COMPUTE`: negative or favourable price
- `NORMAL`: normal price
- `CURTAIL_LOW_PRIORITY_COMPUTE`: expensive price

These are hints, not commands. A consumer such as AmiRender, a CI runner controller, Home Assistant or a mining controller should combine the hint with its own safety, priority and workload rules.

## Home Assistant

The scalar topics can be consumed directly by MQTT sensors. The full automation topic is available for consumers that need event metadata such as schema version, source, area and interval timestamp.

Home Assistant MQTT discovery is planned as an M2 adapter built on top of the same topic contract.
