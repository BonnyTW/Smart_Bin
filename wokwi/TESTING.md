# Wokwi Simulation — Detailed Testing Guide

Step-by-step instructions for loading new firmware and testing **both servos separately**.

---

## Before you start

| Requirement | Why |
|-------------|-----|
| **Backend running** on port 8000 | `uvicorn main:app --host 0.0.0.0 --port 8000` from `backend/` |
| **Wokwi extension** in VS Code/Cursor, or Wokwi in browser | To run the simulation |
| **PlatformIO CLI** (`pio`) installed | To compile `src/main.cpp` → `firmware.bin` |

Your project uses **PlatformIO**, not a single `.ino` file in the root:

- Source code: `wokwi/src/main.cpp`
- Wokwi loads: `wokwi/.pio/build/esp32/firmware.bin` (see `wokwi.toml`)

Editing `main.cpp` does **nothing** in the simulator until you **build** and **restart** the sim.

---

## Part 1 — Load new firmware (build + restart)

### Why two steps?

1. **`pio run`** — Compiles C++ into `firmware.bin` (the program the ESP32 runs).
2. **Stop → Play** — Wokwi loads that `.bin` file into the virtual ESP32 when simulation starts.

If you only press Play without building, you still run the **old** program.

### Option A — VS Code / Cursor (recommended)

1. Open the folder `d:\Smart_Bin\wokwi` (or the whole `Smart_Bin` repo).
2. Open `src/main.cpp` and confirm your servo logic is there.
3. **Build:**
   - Command Palette (`Ctrl+Shift+P`) → **PlatformIO: Build**
   - Or open the PlatformIO sidebar → **Build** (✓ icon) under `env:esp32`
   - Or terminal:
     ```powershell
     cd d:\Smart_Bin\wokwi
     .\build.ps1
     ```
     Or: `python -m platformio run`  
     (`pio run` only works if PlatformIO CLI is on your PATH.)
4. Wait until you see **`SUCCESS`** and `firmware.bin` is updated.
5. **Open Wokwi:**
   - Command Palette → **Wokwi: Start Simulator**
   - Or click the Wokwi icon in the editor gutter on `diagram.json`
6. **Restart simulation:**
   - Click the **green Play** button to start.
   - If it was already running: click **Stop** (square), then **Play** again.

### Option B — Wokwi in browser

1. Run `pio run` in `wokwi/` on your PC first.
2. Upload/sync project to Wokwi if you use their web importer.
3. Stop simulation → Start simulation.

### How to know the new firmware loaded

Open the **Serial Monitor** (Wokwi panel, baud **115200**). On boot you should see:

```text
=== SmartBin ===
Lid servo  -> Approach ultrasonic (GPIO19/21)
Sort servo -> Moisture pot only (GPIO35)
```

If you see those two lines, the **new** build is running.

---

## Part 2 — Find the right parts on the diagram

```
Top row (sensors):
  [Fill level]     [Approach → Lid]     [DHT22]
       │                  │
       │                  └── controls LID servo only
       └── fill % only (LEDs, dashboard)

Left side (servos):
  [Lid (ultrasonic)]   ← opens/closes with Approach sensor
  [Sort (moisture)]    ← moves with Moisture pot only

Bottom row:
  [IR Gas]   [Moisture → Sort]
```

**Common mistake:** Changing the **Fill level** ultrasonic and expecting the lid to move. Fill only changes **fill %** and LED color, not the lid.

---

## Part 3 — Test the LID servo (Approach ultrasonic)

### What the code does

| Distance (Approach sensor) | Lid |
|--------------------------|-----|
| **≤ 28 cm** | Opens → **90°** |
| **≥ 38 cm** | Closes → **0°** |
| Between 28–38 cm | Stays in current state (hysteresis — stops jitter) |
| No echo / invalid | Closes |

Simulates: hand or trash brought near the bin → lid opens; when they leave → lid closes.

### Steps in Wokwi

1. Simulation must be **running** (Play).
2. **Click** the ultrasonic labeled **"Approach → Lid"** (second HC-SR04, near the top).
3. A properties panel opens. Find **Distance** (cm).
4. **Open lid test:**
   - Set distance to **15** or **20** cm.
   - Watch the **Lid (ultrasonic)** servo — arm should move to open position (~90°).
   - Serial line should show: `Lid:OPEN` and `Approach:15cm` (or similar).
5. **Close lid test:**
   - Set distance to **50** or **80** cm.
   - Lid should return to closed (~0°).
   - Serial: `Lid:CLOSED` and `Approach:50cm`.
6. **Moisture isolation test:**
   - Leave Approach at **50 cm** (lid closed).
   - Only rotate **Moisture → Sort** pot.
   - **Lid must not move** — only the Sort servo should.

### If the lid does not move

| Check | Action |
|-------|--------|
| Wrong sensor | Use **Approach → Lid**, not Fill level |
| Distance too high | Use **under 28 cm** to open |
| Old firmware | Run `pio run`, then Stop → Play |
| Serial shows `Approach:999cm` | No echo — click sensor, set a valid distance (5–200 cm) |

---

## Part 4 — Test the SORT servo (Moisture potentiometer)

### What the code does

| Moisture % (from pot) | Sort servo angle | Meaning |
|----------------------|------------------|---------|
| **≤ 35%** | **150°** | Dry waste route |
| **≥ 55%** | **30°** | Wet waste route |
| 35–55% | No change | Keeps last position (avoids flicker) |

**Only** the moisture pot controls this servo. Ultrasonic approach does **not** affect sort.

### Steps in Wokwi

1. Click the potentiometer labeled **"Moisture → Sort"**.
2. **Dry test:**
   - Turn knob to **minimum** (0% / fully counter-clockwise in sim).
   - Sort servo should move to **150°** (one side — “dry” chute).
   - Serial: `Moist:0%` or low value, `Sort:150`.
3. **Wet test:**
   - Turn knob to **maximum** (100%).
   - Sort servo should move to **30°** (opposite side — “wet” chute).
   - Serial: `Moist:100%`, `Sort:30`.
4. **Lid isolation test:**
   - Change only moisture; keep Approach distance **high** (50 cm).
   - Lid stays **CLOSED**; only Sort moves.

---

## Part 5 — Serial Monitor (read the log)

### Open it

- Wokwi simulator panel → **Serial Monitor**
- Baud rate: **115200** (matches `platformio.ini`)

### Example line explained

```text
Fill:45% Approach:18cm Lid:OPEN Moist:62% Sort:30
```

| Field | Meaning |
|-------|---------|
| `Fill:45%` | Fill ultrasonic — waste level in bin |
| `Approach:18cm` | Approach ultrasonic — something is close → lid should open |
| `Lid:OPEN` | Lid servo state |
| `Moist:62%` | Moisture pot — wet side |
| `Sort:30` | Sort servo angle (30 = wet route) |

Another example (lid closed, dry sort):

```text
Fill:72% Approach:55cm Lid:CLOSED Moist:20% Sort:150
```

### Update rate

A new line about every **50 ms** (main loop) + HTTP every **250 ms** to backend.

---

## Part 6 — Full demo script (presentation)

1. Start backend + frontend.
2. `cd wokwi` → `pio run` → Wokwi **Play**.
3. Show Serial boot messages (lid vs sort labels).
4. **Lid:** Approach 20 cm → open; 60 cm → close.
5. **Sort:** Moisture low → 150°; high → 30°.
6. Show dashboard updating fill/gas from same simulation.
7. Say: *"Two independent actuators — proximity opens the lid, moisture routes sorting."*

---

## Quick reference

| Control | Affects |
|---------|---------|
| Fill level ultrasonic | Fill %, LEDs, API only |
| Approach → Lid ultrasonic | **Lid servo only** |
| Moisture → Sort pot | **Sort servo only** |
| IR Gas pot | Gas ppm, fan, alerts |
| DHT22 | Temp/humidity (auto in sim) |
