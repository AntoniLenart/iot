import paho.mqtt.client as mqtt
import time
import logging

logger = logging.getLogger(__name__)

DEFAULT_MQTT_HOST = "192.168.0.102"
DEFAULT_MQTT_PORT = 1883
DEFAULT_MQTT_REQUEST_TOPIC = "access/door/main/request"
DEFAULT_MQTT_DECISION_TOPIC = "access/door/main/decision"
DEFAULT_MQTT_QOS = 1
DEFAULT_MQTT_PUBLISH_TIMEOUT = 2
DEFAULT_MQTT_USER = "test"
DEFAULT_MQTT_PASSWORD = "test"

class MQTTError(Exception):
    pass

class MQTTClient:

    config = {
        'host': None,
        'port': None,
        'user': None,
        'password': None,
        'request_topic': None,
        'decision_topic': None,
        'qos': None,
        'publish_timeout': None,

    }

    def __init__(self, host: str = DEFAULT_MQTT_HOST, 
                 port: int = DEFAULT_MQTT_PORT,
                 user: str = DEFAULT_MQTT_USER,
                 password: str = DEFAULT_MQTT_PASSWORD,
                 request_topic: str = DEFAULT_MQTT_REQUEST_TOPIC,
                 decision_topic: str = DEFAULT_MQTT_DECISION_TOPIC,
                 qos: int = DEFAULT_MQTT_QOS,
                 publish_timeout: int = DEFAULT_MQTT_PUBLISH_TIMEOUT):
        self.config['host'] = host
        self.config['port'] = port
        self.config['user'] = user
        self.config['password'] = password
        self.config['request_topic'] = request_topic
        self.config['decision_topic'] = decision_topic
        self.config['qos'] = qos
        self.config['publish_timeout'] = publish_timeout
        
        self.mqttc = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    def setup(self, **kwargs):
    
        for key, value in kwargs.items():
            if key in self.config.keys():
                self.config[key] = value
                NON_SENSITIVE_KEYS = ("host", "port", "request_topic", "decision_topic", "qos", "publish_timeout")
                if key in ("user", "password"):
                    logger.debug(f"MQTT client set config value of key {key} to value [REDACTED]")
                elif key in NON_SENSITIVE_KEYS:
                    logger.debug(f"MQTT client set config value of key {key} to value {value}")
                else:
                    logger.debug(f"MQTT client set config value of key {key} to value [REDACTED]")
        self.mqttc = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)


    def connect(self):
        self.mqttc.on_connect = self._on_connect

        self.mqttc.username_pw_set(self.config['user'], self.config['password'])

        self.mqttc.connect(self.config['host'], self.config['port'])
        
        self.mqttc.on_message = self._on_message
        
        self.mqttc.subscribe(self.config['decision_topic'], self.config['qos'])

        self.mqttc.loop_start()

        self.msg_payload = False
        self.msg_timestamp = False

        logger.debug("Initialized MQTT client")



    def _on_connect(self, client: mqtt.Client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            logger.error(f"Failed to connect: {reason_code}")
            raise MQTTError("Failed to connect to host")
        else:
            logger.debug("Starting network loop")
            #self.mqttc.loop_start()


    def _on_message(self, client: mqtt.Client, userdata: any, msg: mqtt.MQTTMessage):
        logger.debug(f"Received message {msg.payload} from topic {msg.topic}")
        self.msg_payload = msg.payload.decode('ascii').rstrip("\n")
        self.msg_timestamp = time.time_ns()


    def _publish(self, message: str, topic: str, qos: int, timeout: int):
        
        try:
            msg_info  = self.mqttc.publish(topic, message, qos=1)
            msg_info.wait_for_publish(timeout)
        except:
            logger.error(f"Failed to publish to topic {topic}")
            return False

        return True
        

    def sendRequest(self, data):
        
        if self._publish(data, self.config['request_topic'], self.config['qos'], self.config['publish_timeout']):    
           return True
        
        return False
    
    def getDecision(self):

        return (self.msg_payload, self.msg_timestamp)

