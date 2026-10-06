# Smart Scheduler MQTT

M3 exposes schedule decisions as retained MQTT state. PowerPilot publishes intent; consumers remain responsible for starting, stopping or otherwise controlling workloads.

For area `NO2` and job `render-42`:

- `powerpilot/no2/schedule/render-42` — complete `powerpilot.schedule.v1` JSON event
- `powerpilot/no2/schedule/render-42/decision` — `scheduled`, `run-now` or `unschedulable`
- `powerpilot/no2/schedule/render-42/starts_at` — planned ISO-8601 start, when available
- `powerpilot/no2/schedule/render-42/estimated_spot_cost_nok` — estimated spot/base energy cost, when power is known

All publications are retained so a newly connected consumer can immediately discover the latest decision.

Job IDs are URL-encoded before they are used as MQTT topic segments.

## Consumer behaviour

A consumer such as AmiRender should treat `run-now` as a scheduling hint, not as permission for PowerPilot to control the process directly. The consumer remains responsible for local safety, capacity, job validity and execution.

`estimated_spot_cost_nok` is not a full electricity bill. It currently represents the scheduled energy estimate multiplied by the price data used by the scheduler; grid tariffs, taxes and other additions are outside this M3 contract.
