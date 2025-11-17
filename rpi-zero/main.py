import logging
import time

import json

from rfid_module.cardRead import RFIDModule

from fingerprint_module.fingerprintRead import FingerprintModule, DEFAULT_PORT, DEFAULT_BAUD
import time
import base64

from camera_module.qrRead import CameraModule
from picamera2 import Picamera2

import mqtt_module.mqttClient as mqttClient
import dotenv

import RPi.GPIO as GPIO


DEFAULT_RESPONSE_TIMEOUT_NS = 5 * 1000000000
RELAY_PIN = 12

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup(RELAY_PIN, GPIO.OUT)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

def createJSONRequest(type, data):
    if type == "fingerprint":
        data = base64.b64encode(data).decode("ascii")

    request = {"type" : type,
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

    request_topic = "access/door/hr/request"
    decision_topic = "access/door/hr/decision"

    secrets = dotenv.dotenv_values(".env")
    mqtt = mqttClient.MQTTClient(
                request_topic=request_topic,
                decision_topic=decision_topic)
    
    if secrets:
        if 'MQTT_USER' in secrets and 'MQTT_PASSWORD' in secrets:
            mqtt.setup(host=secrets['MQTT_HOST'],
                       port=int(secrets['MQTT_PORT']),
                       qos=int(secrets['MQTT_QOS']),
                       user=secrets['MQTT_USER'], 
                       password=secrets['MQTT_PASSWORD'], 
                       cafile=secrets['MQTT_CAFILE'])
        else:
            logger.error(".env file exists but doesn't contain all neccessary entries")
            raise mqttClient.MQTTError("Incorrect .env file contents")
    else:
        logger.warn(".env file doesn't exist, initializing MQTT client with default values")
        
    mqtt.connect()

    try:
        rfid = RFIDModule()

        fingerprint = FingerprintModule(port=DEFAULT_PORT, baud=DEFAULT_BAUD, timeout=0)
        picam = Picamera2()
        config = picam.create_video_configuration(
            main={"size": (1200, 1800), "format": "RGB888"}, buffer_count=2,
            controls={"FrameRate": 5.0}
        )
        picam.configure(config)
        picam.start()
        scanner = CameraModule(picam)

        # First start of modules
        fingerprint.new_scan()
        scanner.start_background_scan()

    
        while True:
            r_uid = rfid.readCard()
            f_uid = fingerprint.get_eigenvalues()
            s_uid = scanner.qr_event.wait(0.1)

            if r_uid:
                json_request = createJSONRequest("rfid", r_uid)
                logger.debug(f"Json request: {json_request}")
                r_uid = None
                scanner.stop_scan()
                fingerprint.stop_scan()
                
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
                            # print("allowed")
                            # GPIO.output(RELAY_PIN, GPIO.HIGH)
                            time.sleep(5)
                            # GPIO.output(RELAY_PIN, GPIO.LOW)
                            break
                        elif timestamp >= timeoutStart and not decodeJSONDecision(msg):
                            print("denied")
                            break
                        
                        time.sleep(0.5)
                else:
                    print("MQTT ERROR")

                fingerprint.new_scan()
                scanner.start_background_scan()
            elif f_uid:
                json_request = createJSONRequest("fingerprint", f_uid)
                logger.debug(f"Json request: {json_request}")
                f_uid = None
                scanner.stop_scan()
                fingerprint.stop_scan()

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
                            #GPIO.output(RELAY_PIN, GPIO.HIGH)
                            time.sleep(5)
                            #GPIO.output(RELAY_PIN, GPIO.LOW)
                            break
                        elif timestamp >= timeoutStart and not decodeJSONDecision(msg):
                            print("denied")
                            break
                    
                        time.sleep(0.5)
                else:
                    print("MQTT ERROR")

                # Start scanning for new fingerprint eigenvalues
                fingerprint.new_scan()
                scanner.start_background_scan()
            elif s_uid:
                json_request = createJSONRequest("qr", scanner.qr_result)
                logger.debug(f"Json request: {json_request}")
                s_uid = None
                fingerprint.stop_scan()
                scanner.stop_scan()

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
                            #GPIO.output(RELAY_PIN, GPIO.HIGH)
                            time.sleep(5)
                            #GPIO.output(RELAY_PIN, GPIO.LOW)
                            break
                        elif timestamp >= timeoutStart and not decodeJSONDecision(msg):
                            print("denied")
                            break
                    
                        time.sleep(0.5)
                else:
                    print("MQTT ERROR")

                scanner.start_background_scan()
                fingerprint.new_scan()

            time.sleep(1)

    except Exception:
        fingerprint.stop_scan()
        scanner.stop_scan()
        scanner.cleanup()

    finally:
        fingerprint.stop_scan()
        scanner.stop_scan()
        scanner.cleanup()
        print("Everything closed gracefully :)")
