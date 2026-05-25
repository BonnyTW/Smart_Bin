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
const int PRESENCE_DIST_CM = 30;

#define TRIG1_PIN   5
#define ECHO1_PIN   18
#define TRIG2_PIN   19
#define ECHO2_PIN   21
#define DHT_PIN     4
#define GAS_PIN     34
#define MOISTURE_PIN 35
#define SERVO_LID   13
#define SERVO_SORT  12
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

float readUltrasonic(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long dur = pulseIn(echoPin, HIGH, 50000);
  if (dur == 0) return 999;
  return dur * 0.034 / 2.0;
}

void httpTask(void* param) {
  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClient client;
      HTTPClient http;
      http.setConnectTimeout(2000);
      http.setTimeout(3000);
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
    vTaskDelay(3000 / portTICK_PERIOD_MS);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("=== SmartBin ===");

  pinMode(TRIG1_PIN, OUTPUT);
  pinMode(ECHO1_PIN, INPUT);
  pinMode(TRIG2_PIN, OUTPUT);
  pinMode(ECHO2_PIN, INPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_Y_PIN, OUTPUT);
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);

  ledcSetup(BUZZER_CH, 2000, 8);
  ledcAttachPin(BUZZER_PIN, BUZZER_CH);

  lidServo.attach(SERVO_LID);
  sortServo.attach(SERVO_SORT);
  lidServo.write(0);
  sortServo.write(90);
  dht.begin();

  WiFi.begin(ssid, password);
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) delay(300);

  xTaskCreatePinnedToCore(httpTask, "HTTP", 8192, NULL, 1, NULL, 0);
}

void loop() {
  float dist = readUltrasonic(TRIG1_PIN, ECHO1_PIN);
  if (dist > max_depth_cm) dist = max_depth_cm;
  if (dist < 0) dist = 0;
  fillPct = ((max_depth_cm - dist) / (float)max_depth_cm) * 100.0;

  float presenceDist = readUltrasonic(TRIG2_PIN, ECHO2_PIN);
  bool userNearby = (presenceDist < PRESENCE_DIST_CM && presenceDist > 0);

  if (userNearby && !lidOpen) {
    lidServo.write(90);
    lidOpen = true;
  } else if (!userNearby && lidOpen) {
    lidServo.write(0);
    lidOpen = false;
  }

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h)) humidity = h;
  if (!isnan(t)) temperature = t;

  gasPpm = map(analogRead(GAS_PIN), 0, 4095, 0, 1000);
  moisturePct = map(analogRead(MOISTURE_PIN), 0, 4095, 0, 100);

  digitalWrite(LED_G_PIN, LOW);
  digitalWrite(LED_Y_PIN, LOW);
  digitalWrite(LED_R_PIN, LOW);
  ledcWriteTone(BUZZER_CH, 0);

  if (fillPct >= threshold_pct) {
    digitalWrite(LED_R_PIN, HIGH);
    if (userNearby) ledcWriteTone(BUZZER_CH, 2000);
  } else if (fillPct >= 50) {
    digitalWrite(LED_Y_PIN, HIGH);
  } else {
    digitalWrite(LED_G_PIN, HIGH);
  }

  if (!backendConnected) {
    fanOn = (gasPpm >= GAS_THRESHOLD || temperature >= 30.0);
  }
  digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);

  sortServo.write(moisturePct > 50 ? 45 : 135);

  Serial.printf("Fill:%.0f%% Gas:%.0f Fan:%s\n", fillPct, gasPpm, fanOn ? "ON" : "OFF");

  delay(150);
}
