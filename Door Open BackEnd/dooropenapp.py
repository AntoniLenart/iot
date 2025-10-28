import os
import json
import time
import re
import paho.mqtt.client as mqtt
import requests

HOST = os.getenv("MQTT_HOST", "127.0.0.1")
PORT = int(os.getenv("MQTT_PORT", "1883"))
USER = os.getenv("MQTT_USER", "backend")
PASS = os.getenv("MQTT_PASS", "")

REMOTE_HTTP_URL = os.getenv("REMOTE_HTTP_URL", "http://127.0.0.1:4000/access-check")

SUB_TOPIC = "access/door/+/request"
TOPIC_RE  = re.compile(r"^access/door/(?P<door>[^/]+)/request$")

def normalize_incoming_payload(raw_bytes):
    obj = json.loads(raw_bytes.decode("utf-8"))

    if isinstance(obj, list):
        if len(obj) == 0:
            raise ValueError("empty list payload")
        obj = obj[0]

    if not isinstance(obj, dict):
        raise ValueError("payload is not object")

    if "type" not in obj or "data" not in obj:
        raise ValueError("missing type or data")

    normalized_type = obj["type"]
    if normalized_type == "finger_print":
        normalized_type = "finger_print"
    elif normalized_type == "qr_code":
        normalized_type = "qr_code"
    elif normalized_type == "rfid":
        normalized_type = "rfid"
    else:
        raise ValueError("unknown type")

    return {
        "type": normalized_type,
        "data": str(obj["data"])
    }

def call_remote_service(door_id, cred_type, cred_data):

    payload = {
        "type": cred_type,
        "data": cred_data,
        "door_id": door_id
    }

    try:
        r = requests.post(REMOTE_HTTP_URL, json=payload, timeout=5.0)
        r.raise_for_status()
        resp = r.json()
    except Exception as e:
        print("[backend] HTTP error to remote:", e, "payload:", payload, flush=True)
        return ("deny", None)

    status = resp.get("status")
    if status not in ("allow","deny"):
        status = None

    return (status, resp)

def publish_decision(mqtt_client, door_id, status):
    dec_topic = f"access/door/{door_id}/decision"
    body = { "status": status }
    mqtt_client.publish(dec_topic, json.dumps(body), qos=1)
    print("[backend] published decision:", dec_topic, body, flush=True)

def on_connect(c, u, flags, rc):
    if rc == 0:
        c.subscribe(SUB_TOPIC, qos=1)
        print("[backend] connected, subscribed:", SUB_TOPIC, flush=True)
    else:
        print("[backend] connect failed rc=", rc, flush=True)

def on_message(c, u, msg):
    m = TOPIC_RE.match(msg.topic)
    if not m:
        print("[backend] skip invalid topic:", msg.topic, flush=True)
        return

    door_id = m.group("door")
    print("[backend] got request from door:", door_id, flush=True)

    try:
        parsed = normalize_incoming_payload(msg.payload)
        cred_type = parsed["type"]
        cred_data = parsed["data"]
    except Exception as e:
        print("[backend] invalid incoming payload:", e, "raw:", msg.payload[:200], flush=True)
        if door_id != "add":
            publish_decision(c, door_id, "deny")
        return

    status, remote_resp = call_remote_service(door_id, cred_type, cred_data)

    if door_id != "add":
        if status not in ("allow","deny"):
            status = "deny"
        publish_decision(c, door_id, status)
    else:
        print("[backend] enroll flow forwarded to remote. No MQTT response.", remote_resp, flush=True)

def main():
    c = mqtt.Client(client_id="backend-1", clean_session=True)
    c.username_pw_set(USER, PASS)
    c.on_connect = on_connect
    c.on_message = on_message
    c.reconnect_delay_set(1, 30)
    c.connect(HOST, PORT, 60)
    c.loop_forever()

if __name__ == "__main__":
    main()
