import os, json, time, re
import paho.mqtt.client as mqtt

HOST = os.getenv("MQTT_HOST","127.0.0.1")
PORT = int(os.getenv("MQTT_PORT","1883"))
USER = os.getenv("MQTT_USER","backend")
PASS = os.getenv("MQTT_PASS","")

SUB_TOPIC = "access/door/+/request"
TOPIC_RE  = re.compile(r"^access/door/(?P<door>[^/]+)/request$")

def on_connect(c,u,flags,rc):
    if rc==0:
        c.subscribe(SUB_TOPIC, qos=1)
        print("[backend] connected, subscribed:", SUB_TOPIC, flush=True)
    else:
        print("[backend] connect failed rc=", rc, flush=True)

def on_message(c,u,msg):
    m = TOPIC_RE.match(msg.topic)
    if not m:
        print("[backend] skip invalid topic:", msg.topic, flush=True)
        return

    door = m.group("door")
    dec_topic = f"access/door/{door}/decision"

    data = {}
    try:
        data = json.loads(msg.payload.decode("utf-8"))

        typ = data.get("type")
        if typ not in ("rfid","finger","qr"):
            raise AssertionError("unknown_type")

        for key in ("req_id","payload","ts"):
            if key not in data:
                                raise AssertionError(f"missing_{key}")

        now = int(time.time())
        msg_ts = int(data["ts"])
        if msg_ts > now + 2 or now - msg_ts > 15:
            raise AssertionError("stale_or_skewed")

    except Exception as e:
        decision = {
            "req_id": data.get("req_id",""),
            "access":"deny",
            "by": data.get("type","?"),
            "ts": int(time.time())
        }
        c.publish(dec_topic, json.dumps(decision), qos=1)
        print("[backend] invalid payload:", e, "topic:", msg.topic, "raw:", msg.payload[:200], flush=True)
        return

    # TODO: faktyczna weryfikacja uprawnień (DB)
    decision = {
        "req_id": data["req_id"],
        "access":"allow",
        "by": typ,
        "ts": int(time.time())
    }
    c.publish(dec_topic, json.dumps(decision), qos=1)
    print("[backend] decision allow ->", dec_topic, decision["req_id"], flush=True)

def main():
    c = mqtt.Client(client_id="backend-1", clean_session=True)
    c.username_pw_set(USER, PASS)
    c.on_connect = on_connect
    c.on_message = on_message
    c.reconnect_delay_set(1, 30)
    c.connect(HOST, PORT, 60)
    c.loop_forever()

if __name__=="__main__":
    main()