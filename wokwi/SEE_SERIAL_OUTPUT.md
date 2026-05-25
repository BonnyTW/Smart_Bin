# How to see serial output (Cursor + Wokwi)

Your **PowerShell terminal stays empty** — that is normal. ESP32 logs do not go there.

---

## Fix applied in your project

`diagram.json` now has:

```json
"serialMonitor": { "display": "always" }
```

After you **Stop → Play** the simulator, Wokwi should **open a serial area automatically**.

---

## Step-by-step in Cursor

### 1. Open the correct folder

**File → Open Folder** → `D:\Smart_Bin\wokwi`

### 2. Build

```powershell
python -m platformio run
```

### 3. Start simulator

1. Open `diagram.json`
2. **F1** → **Wokwi: Start Simulator**

### 4. Where to look (picture in words)

```text
┌─────────────────────────────────────────────┐
│  Editor: diagram.json / circuit view        │
├─────────────────────────────────────────────┤
│  WOKWI SIMULATOR (circuit + ESP32)          │  ← big area with chips/wires
│                                             │
├─────────────────────────────────────────────┤
│  Serial Monitor (black box, scrolling text) │  ← SHOULD appear here now
│  === SmartBin BOOT OK ===                   │
└─────────────────────────────────────────────┘
```

The serial box is **under the circuit**, inside the **same Wokwi panel** — not under Terminal → PowerShell.

### 5. Keep the simulator visible

Wokwi docs: if the simulator tab is **hidden** or you only look at PowerShell, output may not show and the sim can **pause**.

- Click the **Wokwi** editor tab so it is visible
- Do not only stare at the **Terminal** tab

---

## Plan B — TCP serial (if you still see no box)

`wokwi.toml` enables port **4000**.

1. Start **Wokwi: Start Simulator**
2. Install extension: **Serial Monitor** (Microsoft, id: `ms-vscode.vscode-serial-monitor`)
3. Open Serial Monitor → **New TCP Monitor**
4. Host: `localhost` Port: `4000` Baud: `115200`
5. You should see `=== SmartBin BOOT OK ===`

---

## Plan C — Browser (easiest, always has serial)

1. Go to https://wokwi.com/projects/new/esp32
2. Menu **→ Download diagram** / or paste your `diagram.json` content via **F1 → Import**
3. Upload firmware: not trivial in browser — easier to **copy `src/main.cpp` into the online editor** and use Wokwi’s build, OR:
4. Open https://wokwi.com and **Sign in → Import from GitHub** if your project is on GitHub

For a quick test without VS Code:

- Copy code from `main.cpp` into https://wokwi.com new ESP32 sketch
- Press **Run**
- Serial is **always** the black strip at the **bottom of the browser window**

---

## Plan D — You don’t need serial for the demo

Prove the sim works without serial:

| Action | Expected |
|--------|----------|
| Start sim | Circuit animates |
| **Approach → Lid** distance 15 cm | **Lid servo** opens |
| **Moisture → Sort** pot high | **Sort servo** moves |
| Backend on :8000 | Dashboard numbers update |

If servos/dashboard work, firmware runs — serial is only for debug text.

---

## Checklist

- [ ] Opened folder `wokwi` (not only `Smart_Bin`)
- [ ] Wokwi extension installed
- [ ] `python -m platformio run` → SUCCESS
- [ ] **Wokwi: Start Simulator** (not only opening diagram.json)
- [ ] Looking at **Wokwi panel under the circuit**, not PowerShell
- [ ] **Stop** then **Play** after diagram.json change
