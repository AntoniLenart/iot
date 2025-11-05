import logging
import RPi.GPIO as GPIO
import cardRead
import mqttClient
import time
import dotenv

import json

logger = logging.getLogger(__name__)

logging.basicConfig(level=logging.DEBUG)

DEFAULT_RESPONSE_TIMEOUT_NS = 5 * 1000000000
RELAY_PIN = 12

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup(RELAY_PIN, GPIO.OUT)

def createJSONRequest(type, data):
    request = {"type" : "rfid",
               "data" : data}
    
    json_request = json.dumps(request)

    return json_request

def decodeJSONDecision(data):
    parsed_data = json.loads(data)
    if parsed_data["status"] == "allow":
        return True
    elif parsed_data["status"] == "deny":
        return False
    else:
        logger.error(f"Received invalid status value. Received value: {parsed_data["status"]}")
        return False


if __name__ == "__main__":

    mqtt_user = ''
    mqtt_password = ''

    secrets = dotenv.dotenv_values(".env")

    rfid = cardRead.RFIDModule()
    mqtt = mqttClient.MQTTClient()

    if secrets:
        if 'MQTT_USER' in secrets and 'MQTT_PASSWORD' in secrets:
            mqtt.setup(user=secrets['MQTT_USER'], password=secrets['MQTT_PASSWORD'])
        else:
            logger.error(".env file exists but doesn't contain all neccessary entries")
            raise mqttClient.MQTTError("Incorrect .env file contents")
    else:
        logger.warn(".env file doesn't exist, initializing MQTT client with default values")
        
    mqtt.connect()
    
    while True:
        r_uid = rfid.readCard()

        if r_uid:
            json_request = createJSONRequest("rfid", r_uid)
            logger.debug(f"Json request: {json_request}")
            if mqtt.sendRequest(json_request):
                timeoutStart = time.time_ns()
                while time.time_ns() - timeoutStart <= DEFAULT_RESPONSE_TIMEOUT_NS:
                    msg, timestamp = mqtt.getDecision()

                    logger.debug(f"Current message: {msg}")
                    logger.debug(f"Current timestamp: {timestamp}")

                    print("...")

                    if not msg or not timestamp:
                        time.sleep(0.2)
                        continue 


                    if timestamp >= timeoutStart and decodeJSONDecision(msg):
                        print("allowed")
                        GPIO.output(RELAY_PIN, GPIO.HIGH)
                        time.sleep(5)
                        GPIO.output(RELAY_PIN, GPIO.LOW)
                        break
                    elif timestamp >= timeoutStart and not decodeJSONDecision(msg):
                        print("denied")
                        break
                    
                    time.sleep(0.5)

        time.sleep(1)


