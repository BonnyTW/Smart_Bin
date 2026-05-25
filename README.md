# 🗑️ SmartBin — IoT Real-Time Waste Management System

SmartBin is an enterprise-grade, end-to-end Internet of Things (IoT) waste management solution. The system leverages an ESP32 micro-controller (simulated on Wokwi) to perform edge-level sensing and actuation, connected to a robust, high-performance FastAPI Python backend and a beautiful, real-time React + TypeScript dashboard.

---

## 📐 System Architecture

SmartBin employs a highly optimized, event-driven telemetry and alert architecture to ensure zero-latency data reporting and sub-second feedback loops.

```
       ┌────────────────────────────────────────────────────────┐
       │             ESP32 Smart Bin Edge Device                 │
       │  (FreeRTOS Telemetry Task Core 0 | Sensing & Control)   │
       └──────────────┬──────────────────────────▲──────────────┘
                      │                                  │
      HTTP POST (JSON)│                                  │ JSON Response
       Telemetry Data │                                  │ (Fan Status, etc.)
       (Every 250ms)  │                                  │
                      ▼                                  │
       ┌─────────────────────────────────────────────────┴──────┐
       │                 FastAPI REST Backend                   │
       │     (Non-Blocking Async Database Persistence)          │
       └──────────────┬──────────────────────────┬──────────────┘
                      │                          │
           Pub/Sub    │                          │ Database Queries
       Websocket Event│                          │ (asyncpg pool)
       (Broadcaster)  ▼                          ▼
       ┌──────────────────────┐        ┌────────────────────────┐
       │    React Frontend    │        │       PostgreSQL       │
       │  (Real-Time Gauges,  │        │  (Bins, Readings,      │
       │    Charts & Alerts)  │        │   Alerts, Users DB)    │
       └──────────────────────┘        └────────────────────────┘
```

### Key Architectural Advantages
* **Edge-First Control:** Actuators (servo lid, sort chute, and buzzer) operate locally on the ESP32. Even if the network drops, the bin remains fully functional.
* **Dual-Core FreeRTOS Tasking:** Sensor reading and actuator loops run on Core 1 of the ESP32, while network requests (`httpTask`) are offloaded to Core 0 to prevent network latency from choking the physical hardware responsiveness.
* **Non-Blocking Telemetry Ingestion:** The backend uses Python's `asyncio.create_task` to instantly broadcast incoming readings to dashboard clients via WebSockets and respond to the ESP32 in parallel, persisting readings in PostgreSQL in the background.

---

## 🔌 Hardware Setup & Pinout (Wokwi Simulation)

The SmartBin simulated hardware model uses an ESP32 as the central controller with multiple sensors and two separate servo actuators running independently.

### ESP32 Pin Connections

| Module / Sensor | ESP32 Pin | Type | Purpose |
| :--- | :--- | :--- | :--- |
| **Ultrasonic #1 (Fill Level)** | Trig: `GPIO5` <br> Echo: `GPIO18` | Digital | Calculates depth of waste inside the bin to calculate fill percentage. |
| **Ultrasonic #2 (Approach/Lid)** | Trig: `GPIO19` <br> Echo: `GPIO21` | Digital | Detects users approaching the bin to trigger automatic lid opening. |
| **Lid Servo Actuator** | Signal: `GPIO13` | PWM (1) | Opens and closes the physical waste cover. |
| **Sort Servo Actuator** | Signal: `GPIO12` | PWM (2) | Routes sorted waste into the dry or wet compartment. |
| **DHT22 Sensor** | Data: `GPIO4` | Digital | Measures temperature and humidity inside the container. |
| **IR Gas Sensor (Odor)** | Output: `GPIO34` | Analog | Simulates gas accumulation and unpleasant odors inside the bin. |
| **Moisture Sensor** | Output: `GPIO35` | Analog | Detects moisture level of trash at the entry chute to trigger auto-sorting. |
| **Green LED (Status)** | Signal: `GPIO25` | Digital | Indicates low fill level (0% - 49%). |
| **Yellow LED (Status)** | Signal: `GPIO26` | Digital | Indicates medium fill level (50% - 79%). |
| **Red LED (Status)** | Signal: `GPIO27` | Digital | Indicates critical fill level (≥ 80%). |
| **Buzzer (Alarm)** | Signal: `GPIO14` | PWM | Triggers audible alert if a user approaches a critical-status bin. |
| **Exhaust Fan Driver** | Signal: `GPIO15` | Digital | Activates exhaust fan to vent bad odors and excess heat. |

<img width="1000" height="600" alt="image" src="https://github.com/user-attachments/assets/cda83e1e-e4eb-4cda-bad3-36e4e76e2bbc" />

### ⚡ Dual-Rail Simulated Power Setup
Motor noise and high currents from servo movements can lead to voltage drops, causing ESP32 micro-controllers to brown out or reset. SmartBin implements a dual-rail power circuit in the simulator:
1. **5V Rail (Logic & Sensors):** A simulated buck converter steps down battery voltage to a stable 5V for the ESP32, both Ultrasonic sensors, and the servos. De-coupling capacitors (`470µF cBuck`, `10µF cEsp`, and `100µF cServo`) are placed between the rails to absorb motor surges.
2. **12V Boost Branch (Exhaust Fan):** The DC fan operates on a separate high-voltage rail. An NPN transistor `qFan` driven by `GPIO15` switches the low side of the fan to GND. A **flyback diode** is wired in parallel across the fan terminal to clamp voltage spikes when the inductive motor load is switched off.

---

## 💾 Database Schema

The database is built on PostgreSQL, utilizing spatial-like real-time partitioning and descriptive indexes to guarantee high query speeds under heavy telemetry loads.

```mermaid
erDiagram
    BINS {
        UUID id PK
        TEXT name
        TEXT location
        INT max_depth_cm
        INT threshold_pct
        TIMESTAMPTZ created_at
    }
    READINGS {
        UUID id PK
        UUID bin_id FK
        FLOAT fill_pct
        FLOAT temperature
        FLOAT humidity
        FLOAT gas_ppm
        FLOAT moisture_pct
        TIMESTAMPTZ recorded_at
    }
    ALERTS {
        UUID id PK
        UUID bin_id FK
        TEXT type
        TEXT message
        BOOL resolved
        TIMESTAMPTZ created_at
    }
    USERS {
        UUID id PK
        TEXT email UNIQUE
        TEXT password_hash
        TEXT role
        TIMESTAMPTZ created_at
    }

    BINS ||--o{ READINGS : "has historical"
    BINS ||--o{ ALERTS : "triggers"
```

### Optimized Indexes
* `idx_readings_bin_id_recorded_at` on `readings(bin_id, recorded_at DESC)`: Speeds up historical telemetry rendering and API responses.
* `idx_alerts_bin_id_resolved` on `alerts(bin_id, resolved)`: Ensures real-time tracking of active hazard states.

---

## ⚙️ Edge & Actuator Logic

### 1. Intelligent Lid Actuation (Ultrasonic #2)
The bin automatically opens the lid when a person or object approaches, and closes it once they depart. It incorporates **hysteresis** boundaries to prevent "jittering" or quick oscillating states at boundary points:
* **Trigger Open:** Approach distance `≤ 28 cm` $\rightarrow$ Servo swings to `90°` (Open).
* **Trigger Close:** Approach distance `≥ 38 cm` (or invalid echo) $\rightarrow$ Servo swings back to `0°` (Closed).
* **Isolation Guarantee:** The approach sensor *only* drives the lid servo. It has no coupling with the sorting system.

### 2. Moisture-Based Waste Sorting (Moisture Sensor)
As waste is introduced, the moisture sensor determines which chute the material should travel through:
* **Dry waste route:** Moisture `≤ 35%` $\rightarrow$ Sorting servo moves to `150°`.
* **Wet waste route:** Moisture `≥ 55%` $\rightarrow$ Sorting servo moves to `30°`.
* **Stability Hysteresis:** If the moisture is between `35%` and `55%`, the servo retains its last set position to avoid unnecessary motor wear.
* **Isolation Guarantee:** The sorting servo acts independently and is completely decoupled from whether the main lid is currently open or closed.

### 3. Smart Gas Ventilation (Gas Sensor & Temperature)
To control odor accumulation and avoid thermal hazards:
* **Activation Threshold:** Triggered if Gas `≥ 300 ppm` OR Temperature `≥ 30.0 °C`.
* **Local Offline Fallback:** If the ESP32 loses network connection to the backend, it falls back to edge checks to run the fan locally. If the backend is connected, the backend computes the fan state and sends it in the HTTP POST response.

---

## 🧠 Real-Time Backend Services

### 🚨 Dynamic Alert Engine
The backend alert system operates continuously on incoming telemetry, checking for warning states and synchronizing them automatically.
* **`threshold_exceeded` alert:** Triggered if bin fill level $\ge$ configured threshold (default 80%).
* **`gas_detected` alert:** Triggered if air quality gas ppm $\ge$ 300.
* **Self-Healing Resolution:** Alerts are **automatically resolved** as soon as a new telemetry record arrives indicating the levels have returned to safe ranges. No human manual reset is required.

### 📬 Automated SMTP Email Notifications
When a hazard state is first triggered (e.g. bin gets full or gas level peaks), the system loads a list of all registered administrative users and dispatches warning emails automatically via SMTP.

### 🕒 APScheduler Alignment Sync
To guarantee alert consistency even during network interruptions, a background task scheduler runs every 30 seconds to fetch the latest state of all bins and cross-reference them against database records, healing any inconsistencies.

### 🔒 JWT Authentication Gate
* Administrative pages and configuration tasks require a JSON Web Token (JWT) provided on login.
* **Register Gate:** Only **one** admin is allowed to register on a fresh install. Once a single admin account exists, the `/register` path locks and routes all future sign-up requests directly to the login gate, protecting the dashboard.

---

## 💻 React Dashboard Frontend

The frontend is a premium, high-fidelity administration portal built on modern web standards:
* **Dashboard Overview:** Displays live gauges for each bin's fill level, network connectivity states (real-time stream vs. polling fallback indicator), status tags (Normal, Warning, Critical), and telemetry stats (Temp, Humidity, Gas, Moisture).
* **Websocket Sync:** Telemetry shifts instantly on screen using TanStack React Query cache hydration linked directly to the live WebSocket feed.
* **Interactive Historical Analytics:** Interactive Recharts display area charts of fill percentage over time, temperature vs. humidity curves, and gas vs. moisture indexes.
* **Alert Portal:** Displays active hazards in red banner alerts with live toast alerts when new dangers appear.

---

## 🛠️ Step-by-Step Installation & Deployment

### 1. Backend Setup
Navigate to the backend directory and create a configuration file:
```bash
cd backend
cp ../.env.example .env
```
Update `.env` with your PostgreSQL database connection string and secure credentials:
```ini
DATABASE_URL=postgres://user:password@localhost:5432/smartbin
SECRET_KEY=generate_a_random_jwt_key_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=myemail@gmail.com
SMTP_PASSWORD=myapppassword
SMTP_FROM=myemail@gmail.com
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

Initialize the database schema:
```bash
python ../init_db.py
python ../migrate.py
python ../test_bin.py
```

Start the FastAPI application:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 2. Frontend Setup
Navigate to the frontend directory:
```bash
cd ../frontend
npm install
```

Configure your local environment variables in `frontend/.env`:
```ini
VITE_API_URL=http://localhost:8000
```

Start the Vite development web server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 3. Wokwi ESP32 Simulation Setup
Navigate to the Wokwi folder:
```bash
cd ../wokwi
```

Build the firmware using PlatformIO (converts C++ in `src/main.cpp` into a virtual flash bin):
```powershell
.\build.ps1
```
*(Or use `python -m platformio run` if `pio` is not globally on your system path).*

Ensure the simulator settings in `wokwi.toml` point to the correct build output:
```toml
[wokwi]
version = 1
firmware = '.pio/build/esp32/firmware.bin'
elf = '.pio/build/esp32/firmware.elf'
```

Start the simulator:
* Open `wokwi/diagram.json` in VS Code / Cursor.
* Hit the **Play** button on the simulator pane.
* Open the **Serial Monitor** (Baud rate `115200`) to view instant telemetry statements.

---

## 🧪 Interactive Validation Script (How to Test)

Follow this systematic checklist in the simulator to verify all hardware-software operations.

### Test 1: Lid Opening & Hysteresis
1. Start the Wokwi simulation.
2. Click the ultrasonic sensor labeled **"Approach → Lid"** (at the top).
3. Drag the slider to **`15 cm`** (close range).
   * **Verification:** The **Lid servo** swings to **`90°`**. Serial output prints `Lid:OPEN`.
4. Drag the slider to **`32 cm`** (inside the hysteresis gap).
   * **Verification:** The Lid servo **remains open** (safeguards against jitter).
5. Drag the slider to **`45 cm`** (user departed).
   * **Verification:** The Lid servo returns to **`0°`**. Serial output prints `Lid:CLOSED`.

### Test 2: Auto-Sorting Actuation
1. Click the potentiometer labeled **"Moisture → Sort"** (bottom right).
2. Adjust the dial to the minimum value (0%).
   * **Verification:** The **Sort servo** rotates to **`150°`** (Dry route). Serial prints `Moist:0% Sort:150`.
3. Adjust the dial to the maximum value (100%).
   * **Verification:** The **Sort servo** rotates to **`30°`** (Wet route). Serial prints `Moist:100% Sort:30`.

### Test 3: Emergency Gas Venting (Offline Fallback)
1. Turn the **"IR Gas"** potentiometer past **`300 ppm`** (or heat sensor past `30.0 °C`).
   * **Verification:** The exhaust **DC Fan spins** and the **Blue Fan LED lights up**. Serial prints `Fan:ON`.
2. Stop the local FastAPI server.
   * **Verification:** The ESP32 telemetry prints network warnings, but **local fallback logic keeps the fan active** since gas is still high. The edge device operates independently.
