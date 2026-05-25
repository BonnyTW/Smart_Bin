#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* serverName = "http://host.wokwi.internal:8000/readings";
const char* bin_id = "d11f62e2-e7bf-46ed-8c1a-351b027ed640";

const int max_depth_cm = 100;
const int threshold_pct = 80;
const int GAS_THRESHOLD = 300;

// Fill level — ultrasonic #1 only (never drives servos)
#define TRIG_FILL_PIN   5
#define ECHO_FILL_PIN   18

// Approach / lid — ultrasonic #2 only (opens lid when trash or hand is close)
#define TRIG_APPROACH_PIN  19
#define ECHO_APPROACH_PIN  21
const int LID_OPEN_CM = 28;   // closer than this → open lid
const int LID_CLOSE_CM = 38;  // farther than this → close lid (hysteresis)

#define DHT_PIN     4
#define GAS_PIN     34
#define MOISTURE_PIN 35

// Lid servo — GPIO13, driven ONLY by approach ultrasonic
#define SERVO_LID_PIN   13
const int LID_ANGLE_CLOSED = 0;
const int LID_ANGLE_OPEN = 90;

// Sort servo — GPIO12, driven ONLY by moisture sensor
#define SERVO_SORT_PIN  12
const int SORT_ANGLE_DRY = 150;      // low moisture → dry waste chute
const int SORT_ANGLE_WET = 30;       // high moisture → wet waste chute
const float MOISTURE_WET_PCT = 55.0f;
const float MOISTURE_DRY_PCT = 35.0f;

#define LED_G_PIN   25
#define LED_Y_PIN   26
#define LED_R_PIN   27
#define FAN_PIN     15
#define BUZZER_PIN  14
#define BUZZER_CH   4

DHT dht(DHT_PIN, DHT22);
Servo lidServo;
Servo sortServo;

volatile float fillPct = 0, temperature = 0, humidity = 0;
volatile float gasPpm = 0, moisturePct = 0;
volatile bool lidOpen = false;
volatile bool fanOn = false;
volatile bool backendConnected = false;

// Last sort position (moisture only) — independent from lid
int sortAngle = SORT_ANGLE_DRY;

float readUltrasonic(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long dur = pulseIn(echoPin, HIGH, 50000);
  if (dur == 0) return -1.0f;  // no echo
  return dur * 0.034f / 2.0f;
}

/** Lid: approach ultrasonic only — open when something is close, close when it leaves. */
void updateLidFromApproach(float approachDistCm) {
  bool inRange = (approachDistCm > 0 && approachDistCm < 400);

  if (!inRange) {
    if (lidOpen) {
      lidServo.write(LID_ANGLE_CLOSED);
      lidOpen = false;
    }
    return;
  }

  if (!lidOpen && approachDistCm <= LID_OPEN_CM) {
    lidServo.write(LID_ANGLE_OPEN);
    lidOpen = true;
  } else if (lidOpen && approachDistCm >= LID_CLOSE_CM) {
    lidServo.write(LID_ANGLE_CLOSED);
    lidOpen = false;
  }
}

/** Sort: moisture sensor only — different angles for wet vs dry waste. */
void updateSortFromMoisture(float moisture) {
  if (moisture >= MOISTURE_WET_PCT) {
    if (sortAngle != SORT_ANGLE_WET) {
      sortAngle = SORT_ANGLE_WET;
      sortServo.write(SORT_ANGLE_WET);
    }
  } else if (moisture <= MOISTURE_DRY_PCT) {
    if (sortAngle != SORT_ANGLE_DRY) {
      sortAngle = SORT_ANGLE_DRY;
      sortServo.write(SORT_ANGLE_DRY);
    }
  }
  // Between 35–55%: keep last route (no lid movement, no coupling)
}

void httpTask(void* param) {
  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClient client;
      HTTPClient http;
      http.setConnectTimeout(800);
      http.setTimeout(1500);
      http.begin(client, serverName);
      http.addHeader("Content-Type", "application/json");

      JsonDocument doc;
      doc["bin_id"] = bin_id;
      doc["fill_pct"] = round(fillPct * 10) / 10.0;
      doc["temperature"] = round(temperature * 10) / 10.0;
      doc["humidity"] = round(humidity * 10) / 10.0;
      doc["gas_ppm"] = round(gasPpm);
      doc["moisture_pct"] = round(moisturePct * 10) / 10.0;

      String body;
      serializeJson(doc, body);

      int code = http.POST(body);
      if (code == 200) {
        JsonDocument resDoc;
        if (!deserializeJson(resDoc, http.getString())) {
          fanOn = resDoc["fan_on"] | false;
          backendConnected = true;
        } else {
          backendConnected = false;
        }
      } else {
        backendConnected = false;
      }
      http.end();
    }
    vTaskDelay(250 / portTICK_PERIOD_MS);
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("=== SmartBin BOOT OK ===");
  Serial.println("If you see this, Serial Monitor is working.");
  Serial.println("Lid servo  -> Approach ultrasonic (GPIO19/21)");
  Serial.println("Sort servo -> Moisture pot only (GPIO35)");
  Serial.flush();

  pinMode(TRIG_FILL_PIN, OUTPUT);
  pinMode(ECHO_FILL_PIN, INPUT);
  pinMode(TRIG_APPROACH_PIN, OUTPUT);
  pinMode(ECHO_APPROACH_PIN, INPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_Y_PIN, OUTPUT);
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);

  ledcSetup(BUZZER_CH, 2000, 8);
  ledcAttachPin(BUZZER_PIN, BUZZER_CH);

  lidServo.attach(SERVO_LID_PIN);
  sortServo.attach(SERVO_SORT_PIN);
  lidServo.write(LID_ANGLE_CLOSED);
  sortServo.write(SORT_ANGLE_DRY);
  sortAngle = SORT_ANGLE_DRY;
  dht.begin();

  WiFi.begin(ssid, password);
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) delay(300);

  xTaskCreatePinnedToCore(httpTask, "HTTP", 8192, NULL, 1, NULL, 0);
}

void loop() {
  // --- Ultrasonic #1: fill level only ---
  float fillDist = readUltrasonic(TRIG_FILL_PIN, ECHO_FILL_PIN);
  delay(5);
  if (fillDist < 0) fillDist = max_depth_cm;
  if (fillDist > max_depth_cm) fillDist = max_depth_cm;
  fillPct = ((max_depth_cm - fillDist) / (float)max_depth_cm) * 100.0f;

  // --- Ultrasonic #2: approach / lid only ---
  float approachDist = readUltrasonic(TRIG_APPROACH_PIN, ECHO_APPROACH_PIN);
  delay(5);
  updateLidFromApproach(approachDist);

  bool approachActive = (approachDist > 0 && approachDist < LID_CLOSE_CM);

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h)) humidity = h;
  if (!isnan(t)) temperature = t;

  gasPpm = map(analogRead(GAS_PIN), 0, 4095, 0, 1000);
  moisturePct = map(analogRead(MOISTURE_PIN), 0, 4095, 0, 100);

  // --- Moisture only → sort servo (separate from lid) ---
  updateSortFromMoisture(moisturePct);

  digitalWrite(LED_G_PIN, LOW);
  digitalWrite(LED_Y_PIN, LOW);
  digitalWrite(LED_R_PIN, LOW);
  ledcWriteTone(BUZZER_CH, 0);

  if (fillPct >= threshold_pct) {
    digitalWrite(LED_R_PIN, HIGH);
    if (approachActive) ledcWriteTone(BUZZER_CH, 2000);
  } else if (fillPct >= 50) {
    digitalWrite(LED_Y_PIN, HIGH);
  } else {
    digitalWrite(LED_G_PIN, HIGH);
  }

  if (!backendConnected) {
    fanOn = (gasPpm >= GAS_THRESHOLD || temperature >= 30.0f);
  }
  digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);

  Serial.printf(
    "Fill:%.0f%% Approach:%.0fcm Lid:%s Moist:%.0f%% Sort:%d\n",
    fillPct,
    approachDist < 0 ? 999.0f : approachDist,
    lidOpen ? "OPEN" : "CLOSED",
    moisturePct,
    sortAngle
  );

  delay(50);
}
