
// Some of this configuration and setup is based on the dataCollection code. We might not need all of these.....
#include <string.h>
#include <stdlib.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h> 
#include <RTClib.h>

const int buttonPin = 9;

const int chipSelect = 4;
const int ledPin = 13; 

void setup() {

  /******** Button Setup ********************/ 
  // Set up pin mode for external modules
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, HIGH);
  Serial.begin(115200);  
}

void loop() {
    digitalWrite(ledPin, HIGH);
    delay(200);
    digitalWrite(ledPin, LOW);
    delay(600);
    digitalWrite(ledPin, HIGH);
    delay(200);
    digitalWrite(ledPin, LOW);
    delay(600);
    digitalWrite(ledPin, HIGH);
    delay(600);
    digitalWrite(ledPin, LOW);
    delay(400);
}
