#include <string.h>
#include <stdlib.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h> 
#include <Adafruit_LSM303_U.h>
#include <Adafruit_L3GD20_U.h>
#include <Adafruit_Sensor.h>

#include "Adafruit_BLE.h"
#include "Adafruit_BluefruitLE_SPI.h"
#include "Adafruit_BluefruitLE_UART.h"
#include "BluefruitConfig.h"

// ELL model function
// %%HEADER%%

enum { NONE = 0, NEXT_SLIDE = 1, PREV_SLIDE = 2};

// Constants
const bool useBle = true;
const float frequency = 30; // Unit: Hz
const String boardNum = "COM2"; // Serial number
const int buttonPin = 9;
const int rate = (int)(1000.0/frequency);

const int ledPin1 = 13;
const int ledPin2 = 6;

// Sensor configuration variables
Adafruit_LSM303_Accel_Unified accel = Adafruit_LSM303_Accel_Unified(54321);
Adafruit_LSM303_Mag_Unified mag = Adafruit_LSM303_Mag_Unified(12345);
Adafruit_L3GD20_Unified gyro = Adafruit_L3GD20_Unified(20);

float acc_x, acc_y, acc_z;
float gyro_x, gyro_y, gyro_z;

// global variables for timing
uint32_t nextSampleTimeInMs = 0;
uint32_t ledOffTimeInMs = 0;
enum {OFF, SOLID, BLINK} ledMode = OFF;
bool ledIsOn = false;

#define FACTORYRESET_ENABLE      0

// Create the bluefruit object, either software serial...uncomment these lines
// hardware SPI, using SCK/MOSI/MISO hardware SPI pins and then user selected CS/IRQ/RST
Adafruit_BluefruitLE_SPI ble(BLUEFRUIT_SPI_CS, BLUEFRUIT_SPI_IRQ, BLUEFRUIT_SPI_RST);

// This function waits until the next valid sample time. If the function is called before the next sample time
// it spins until the sample time arrives. If the function is called after the next sample time, it waits until the next valid sample time. 
uint32_t wait()
{
  while(true) {
    uint32_t t = millis();
    if(t >= nextSampleTimeInMs) {
      nextSampleTimeInMs = t + rate;
      return t;
    }
  }
}

void ledOn()
{
    digitalWrite(ledPin1, HIGH);
    digitalWrite(ledPin2, LOW);  
    ledIsOn = true;
}

void ledOff()
{
    digitalWrite(ledPin1, LOW);
    digitalWrite(ledPin2, HIGH);  
    ledIsOn = false;
}

void updateLed(uint32_t currentTime)
{
    if(currentTime > ledOffTimeInMs) {
      ledMode = OFF;
    }

    switch(ledMode) {
      case OFF:
          ledOff();
        break;
      case SOLID:
        ledOn();
        break;
      case BLINK:
        ledIsOn = !ledIsOn;
        if(ledIsOn) 
          ledOn();
        else 
          ledOff();
    }
}

void printError(const __FlashStringHelper* err) {
  Serial.println(err);
  while (1);
}

void blePrint(const char* str)
{
    if(useBle && ble.isConnected())
    {
      ble.print("AT+BLEUARTTX=");
      ble.print(str);
      ble.println();
      ble.flush();
    } 
}

int filterPrediction(double prediction)
{
  const int minTimeBeforeRepeat = 1000; // ms
  static uint32_t lastEventTime = 0;
  
  uint32_t t = millis();
  if(prediction != 0.0 && (t-lastEventTime > minTimeBeforeRepeat)) { 
    lastEventTime = t;
    return static_cast<int>(prediction);
  }

  return NONE;
}

void startBle() {
  // Initialise the BLE module
  Serial.print(F("Initialising the Bluefruit LE module: "));

  if ( !ble.begin(VERBOSE_MODE) )
  {
    printError(F("Couldn't find Bluefruit"));
  }
  Serial.println( F("OK!") );

  if (FACTORYRESET_ENABLE)
  {
    // Perform a factory reset to make sure everything is in a known state 
    Serial.println(F("Performing a factory reset: "));
    if ( ! ble.factoryReset() ){
      printError(F("Couldn't factory reset"));
    }
  }

  // Disable command echo from Bluefruit 
  ble.echo(false);

  // Print Bluefruit information 
  Serial.println("Requesting Bluefruit info:");
  ble.info();

  // Wait for a connection before starting the test 
  Serial.println("Waiting for a BLE connection to continue ...");

  ble.verbose(false);  // debug info is a little annoying after this point!

  // Wait for connection to finish
  while (! ble.isConnected()) {
      delay(1000);
  }

  // Wait for the connection to complete
  delay(1000);

  Serial.println(F("BLE connected"));
}

void setup() {  
  Serial.begin(115200);
  pinMode(ledPin1, OUTPUT);
  digitalWrite(ledPin1, HIGH);
  pinMode(ledPin2, OUTPUT);
  digitalWrite(ledPin2, HIGH);
  
  // Confirm that all of the sensors started
  gyro.enableAutoRange(true);
  accel.begin();  // Accelerometer setup 
  gyro.begin();   // Gyroscope setup

  if(useBle)
    startBle();
}

void loop() {
    auto currentTime = wait();
    updateLed(currentTime);

    // Accelerometer & gyro Reading 
    // Get a new sensor event
    sensors_event_t accelEvent; 
    if(accel.getEvent(&accelEvent)) {
      acc_x = accelEvent.acceleration.x;
      acc_y = accelEvent.acceleration.y;
      acc_z = accelEvent.acceleration.z;
    }
    
    // Get a new sensor event
    sensors_event_t gyroEvent;  
    if(gyro.getEvent(&gyroEvent)) {
      gyro_x = gyroEvent.gyro.x;
      gyro_y = gyroEvent.gyro.y;
      gyro_z = gyroEvent.gyro.z;
    }
    
    double sensorArray[] = { acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z };
    double output[2];
    predict(sensorArray, output);
    int prediction = filterPrediction(output[0]); // predicted class (0 == 'none')
    if(prediction == NONE)
      return;
  
    ledOn();
    ledOffTimeInMs = currentTime + 1000;
    switch(prediction) {
      case NEXT_SLIDE:
        ledMode = SOLID;
        blePrint("next\\r\\n");
        break;
      case PREV_SLIDE:
        ledMode = BLINK;
        blePrint("back\\r\\n");
        break;
    }
}
