# SmartBin — Power Supply & Alert System Setup

## Power supply (Wokwi + hardware)

- **Battery** (`bat`) → simulated buck → **ESP32 5V**, ultrasonic sensors, servos
- **Capacitors** `cBuck` (470µF), `cEsp` (10µF), `cServo` (100µF) between 5V and GND
- **Boost branch**: `bat+` → **DC fan** → NPN driver `qFan` ← GPIO15, with **flyback diode** `dFlyback`

## Admin & alerts

1. Start backend: `docker compose up` or `uvicorn` in `backend/`
2. Start frontend: `npm run dev` in `frontend/`
3. Open http://localhost:5173 → **Setup Admin** (once only) → **Login**
4. After one admin exists, `/register` redirects to login automatically
4. Configure SMTP in `.env` (see `.env.example`) for email alerts
5. Run Wokwi simulation; ESP32 posts to `host.wokwi.internal:8000`

## Alerts (automatic)

- **Danger** when ESP32 reports fill ≥ threshold or gas ≥ 300 ppm.
- **Resolved** automatically when sensors return to safe — no manual button.
- See `EMAIL_SETUP.md` for SMTP configuration steps.

## Battery / fan (Wokwi)

See `wokwi/POWER_SUPPLY.md` for how battery, buck, boost, and fan wiring work in the simulation.
