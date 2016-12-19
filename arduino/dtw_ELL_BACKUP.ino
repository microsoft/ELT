/*
 * Sample DTW Model on accelerometer and gyroscope with generated recognizer code.
 * 
 * Based on Saleema's 1 class DTW, which is:
 * Based on Donghao's SPRING.ts code which implements the algorithm in
 * [1] Sakurai, Y., Faloutsos, C., & Yamamuro, M. (2007, April). 
 * Stream monitoring under the time warping distance. 
 * In 2007 IEEE 23rd International Conference on Data Engineering (pp. 1046-1055). IEEE.
 * 
 * created 9/16/2016
 * by Donghao Ren
 */

// Some of this configuration and setup is based on the dataCollection code. We might not need all of these.....
#include <string.h>
#include <stdlib.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h> 
#include <Adafruit_LSM303_U.h>
#include <Adafruit_L3GD20_U.h>
#include <Adafruit_Sensor.h>

// ELL model function
// %%HEADER%%

// Constants
const float frequency = 50; // Unit: Hz
const String boardNum = "COM2"; // Serial number
const int buttonPin = 9;

const int chipSelect = 4;
const int rate = (int)(1000.0/frequency);

const int ledPin1 = 13;
const int ledPin2 = 6;

// Sensor configuration variables
Adafruit_LSM303_Accel_Unified accel = Adafruit_LSM303_Accel_Unified(54321);
Adafruit_LSM303_Mag_Unified mag = Adafruit_LSM303_Mag_Unified(12345);
Adafruit_L3GD20_Unified gyro = Adafruit_L3GD20_Unified(20);

float acc_x, acc_y, acc_z;
float gyro_x, gyro_y, gyro_z;
float mag_x, mag_y, mag_z;

// global variables for timing
uint32_t nextSampleTimeInMs = 0;
uint32_t ledOffTimeInMs = 0;

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
}

void ledOff()
{
    digitalWrite(ledPin1, LOW);
    digitalWrite(ledPin2, HIGH);  
}

void setup() {  
  Serial.begin(115200);
  pinMode(ledPin1, OUTPUT);
  digitalWrite(ledPin1, HIGH);
  pinMode(ledPin2, OUTPUT);
  digitalWrite(ledPin2, HIGH);
  
  // Confirm that all of the sensors started
  gyro.enableAutoRange(true);
  mag.enableAutoRange(true);
  accel.begin();  // Accelerometer setup 
  gyro.begin();   // Gyroscope setup
  mag.begin();    // Magnetometer setup
}

void loop() {
    auto currentTime = wait();

    if(currentTime > ledOffTimeInMs) {
      ledOff();
    }

    /****************** Accelerometer & Compass Reading ******************/
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
    
    double sensor_array[] = { acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z };
    double output[2];
    predict(sensor_array, output);
    int prediction = static_cast<int>(output[0]); // predicted class (0.0 == 'none')
    // Serial.println(output[0]);
    if(prediction != 0) {
      ledOn();
      ledOffTimeInMs = currentTime + 500*prediction;
    }
}
