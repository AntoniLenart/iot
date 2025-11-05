from pn532pi import Pn532, pn532
from pn532pi import Pn532I2c
import binascii
import logging

logger = logging.getLogger(__name__)

# Default I2C bus for Raspberry Pi
DEFAULT_I2C_BUS = 1
DEFAULT_ENCODING = "hex" # "base64" | "hex"

class RFIDError(Exception):
    pass

class RFIDModule:
    
    def __init__(self, I2C_BUS: int = DEFAULT_I2C_BUS):
        PN532_I2C = Pn532I2c(1)
        self.nfc = Pn532(PN532_I2C)

        self.nfc.begin()
        
        versiondata = self.nfc.getFirmwareVersion()
        if not versiondata:
            logger.warn("Didn't find a PN53x board")
            raise RFIDError(f"No PN53x board detected")

        logger.debug("Found chip PN5 {:#x} Firmware version {:d}.{:d}".format((versiondata >> 24) & 0xFF, 
            (versiondata >> 16) & 0xFF, 
            (versiondata >> 8) & 0xFF))
        
        self.nfc.SAMConfig()

    def _format_hex(self, data):
        return binascii.hexlify(data).decode('ascii')
    
    def _format_base64(self, data):
        return binascii.b2a_base64(data).decode('ascii').rstrip('\n')

    def readCard(self, format: str = DEFAULT_ENCODING):
        
        formatting = {"hex" : self._format_hex,
                      "base64" : self._format_base64}

        logger.info("Waiting for an ISO14443A card...")

        success, uid = self.nfc.readPassiveTargetID(pn532.PN532_MIFARE_ISO14443A_106KBPS)

        if (success):
            logger.info("Found an ISO14443A card")
            logger.debug("UID Length: {:d}".format(len(uid)))
            logger.debug("UID Value: {}".format(formatting[format](uid)))

            return str(formatting[format](uid))
        else:
            logger.debug("Couldn't find a compatible card")
            return False
