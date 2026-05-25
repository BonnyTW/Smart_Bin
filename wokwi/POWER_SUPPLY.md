# How the battery and power work (Wokwi)

## Simple flow

```
[Battery +] ──red wire──► Buck converter (labeled) ──► 5V rail ──► ESP32, ultrasonics, servos
[Battery −] ──black wire──► Common GND ──► all modules

[Battery +] ──orange wire──► Boost rail (labeled) ──► DC Fan (+)
Fan (−) ──► Transistor (switch) ──► GND when GPIO15 = ON
Flyback diode across fan (protects from motor spikes)
Blue LED "Fan ON" = same signal as GPIO15 (visible when fan runs)
```

## What each part does in simulation

| Part | Role |
|------|------|
| **4× AA battery** | Primary energy (simulates rechargeable pack ~6V) |
| **Red wire bat+ → esp:5V** | Buck output: stable **5V** for logic and sensors |
| **470µF / 10µF / 100µF caps** | Smooth voltage; reduce ESP resets when servos move |
| **Orange wire bat+ → fan** | Boost path: higher-voltage branch for the fan |
| **NPN + 1kΩ** | ESP32 GPIO15 cannot drive the motor directly; transistor switches current |
| **Flyback diode** | Stops voltage spikes when the fan turns off |
| **Blue Fan ON LED** | Shows fan state in the diagram (lights with GPIO15) |

## Why two rails?

- **5V buck**: ESP32 and HC-SR04 need steady 5V.
- **12V boost (fan branch)**: Fan needs more voltage for airflow; kept separate so motor current does not brown out the ESP32.

In Wokwi, `esp:5V` and `bat:+` are tied so the simulation always has power when the battery is connected.

## Test the fan in Wokwi

1. Start simulation.
2. Rotate **IR Gas** potentiometer toward maximum (gas ≥ 300 ppm).
3. **Blue “Fan ON” LED** should light; **DC motor** should spin.
4. Serial monitor shows `Fan:ON`.
