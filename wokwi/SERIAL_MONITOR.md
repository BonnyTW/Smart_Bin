# Wokwi Serial Monitor — empty? Read this

You are **not** looking for the PowerShell terminal. Serial output appears in the **Wokwi simulator UI**, not in the terminal where you ran `python -m platformio run`.

---

## Method 1 — Wokwi extension in Cursor (most common)

### Step 1: Open the wokwi folder

**Important:** Wokwi works best when the project root is the `wokwi` folder.

1. **File → Open Folder**
2. Choose: `D:\Smart_Bin\wokwi` (not the whole Smart_Bin folder)
3. Open `diagram.json`

### Step 2: Install extension

1. Extensions (`Ctrl+Shift+X`)
2. Search **Wokwi Simulator**
3. Install **Wokwi.wokwi-vscode**

### Step 3: Start simulation

1. Open `diagram.json`
2. Press **F1** → type **`Wokwi: Start Simulator`** → Enter  
   OR click the **green Play** button on the diagram editor toolbar

### Step 4: Find Serial Monitor (3 places to check)

**A) Bottom of the simulator panel**  
After Play, a panel opens (often full width at bottom). At the **bottom edge** of that panel there is a dark strip — that is Serial Monitor. Text scrolls there.

**B) Click the ESP32 chip in the diagram**  
While simulation is running, **click the ESP32 board** in the circuit. Some versions open a chip view with a **Serial** tab.

**C) Wokwi tab bar**  
Look for tabs named **Simulator** | **Serial** | **Logic Analyzer** above the circuit. Click **Serial**.

### Step 5: Baud rate

Should be **115200** (set in `platformio.ini`). If there is a dropdown, pick 115200.

### Step 6: Rebuild + restart

```powershell
cd D:\Smart_Bin\wokwi
python -m platformio run
```

Then in Wokwi: **Stop** (square) → **Play** (triangle).

You should see:

```text
=== SmartBin BOOT OK ===
If you see this, Serial Monitor is working.
```

---

## Method 2 — You opened the wrong “terminal”

| Window | Used for |
|--------|----------|
| **Terminal → PowerShell** | `python -m platformio run` (build only) |
| **Wokwi simulator panel** | Serial output from ESP32 |

Building does **not** show sensor logs in PowerShell.

---

## Method 3 — Wokwi in the browser (if extension is confusing)

1. Go to https://wokwi.com
2. **File → Import** or create ESP32 project
3. Copy your `diagram.json` and upload firmware, OR use Wokwi’s “Import from folder” if available
4. Press **Run**
5. **Serial Monitor** is always the **black box at the bottom of the page**

---

## Checklist if still empty

- [ ] Simulation is **running** (Play is active, not paused)
- [ ] Built firmware: `python -m platformio run` → SUCCESS
- [ ] Stopped and started sim **after** build
- [ ] Opened folder `D:\Smart_Bin\wokwi` (recommended)
- [ ] Green **OK** LED on diagram lights up when fill is low (proves code runs even without serial)

---

## Still empty?

1. **Command Palette** → **Wokwi: Stop Simulator**
2. **Command Palette** → **Wokwi: Start Simulator**
3. Wait 5 seconds after WiFi connects (boot messages print **before** WiFi, so you should see text within 1 second)

If the **green LED** on the diagram turns on but serial is empty, the sim runs but the Serial panel is hidden — resize the Wokwi panel upward or look for a **Serial** tab.
