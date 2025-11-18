#!/usr/bin/env python3
"""
fingerprint_module.py

Driver for UART Fingerprint Reader module.
Works on Raspberry Pi Zero (using /dev/serial0, /dev/ttyAMA0, or /dev/ttyS0 depending on setup).
"""

import serial
import time
import struct
from typing import Optional, Tuple, List
import base64
import json
from pathlib import Path

import RPi.GPIO as GPIO

# Default serial port for Raspberry Pi
DEFAULT_PORT = "/dev/serial0"
DEFAULT_BAUD = 19200
DEFAULT_TIMEOUT = 15.0  # seconds for serial read

# ACK response codes from manual
ACK_SUCCESS = 0x00
ACK_FAIL = 0x01
ACK_FULL = 0x04
ACK_NOUSER = 0x05
ACK_FIN_EXIST = 0x07
ACK_TIMEOUT = 0x08
ACK_USER_EXIST = 0x06

# GPIO
RST_PIN = 18


class FingerprintError(Exception):
    pass


class FingerprintModule:
    """Low-level driver for the UART fingerprint module."""

    def __init__(self, port: str = DEFAULT_PORT, baud: int = DEFAULT_BAUD, timeout: float = DEFAULT_TIMEOUT):
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self.ser = serial.Serial(port=self.port, baudrate=self.baud, timeout=self.timeout)
        # Ensure serial is open
        if not self.ser.is_open:
            self.ser.open()

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()

    # ------------------------
    # Packet helpers
    # ------------------------
    @staticmethod
    def _checksum(bytes_seq: bytes) -> int:
        """
        Checksum defined in manual: XOR of bytes 2..6 (1-indexed) for 8-byte command
        or more generally XOR of bytes from second byte up to the 6th byte of header
        For data-header: manual states CHK = XOR of 2nd to 6th byte of header.
        For data packet: CHK = XOR of second byte to Len+1 byte.
        """
        # Generic XOR over given bytes
        chk = 0x00
        for b in bytes_seq:
            chk ^= b
        return chk & 0xFF

    def _build_simple_command(self, cmd: int, p1: int = 0, p2: int = 0, p3: int = 0) -> bytes:
        """Build an 8-byte simple command: 0xF5 CMD P1 P2 P3 0 CHK 0xF5"""
        header = bytes([0xF5, cmd & 0xFF, p1 & 0xFF, p2 & 0xFF, p3 & 0xFF, 0x00])
        chk = self._checksum(header[1:6])  # XOR of bytes 2..6 (1-indexed) => header[1:6]
        packet = header + bytes([chk, 0xF5])
        return packet

    def _build_data_command(self, cmd: int, data: bytes) -> bytes:
        """
        Build a data command with header + data packet:
        Header: 0xF5 CMD Hi(Len) Low(Len) 0 0 CHK 0xF5
        Then immediately send Data packet: 0xF5 <data bytes> CHK 0xF5
        """
        length = len(data)
        hi = (length >> 8) & 0xFF
        lo = length & 0xFF
        header = bytes([0xF5, cmd & 0xFF, hi, lo, 0x00, 0x00])
        chk_header = self._checksum(header[1:6])
        header_packet = header + bytes([chk_header, 0xF5])

        # Data packet
        data_prefix = bytes([0xF5]) + data
        chk_data = self._checksum(data_prefix[1:])  # XOR of data_prefix[1:] (i.e., data bytes)
        data_packet = data_prefix + bytes([chk_data, 0xF5])

        return header_packet + data_packet

    def _read_exact(self, n: int) -> bytes:
        """Read exactly n bytes (or raise)"""
        buf = b""
        start = time.time()
        while len(buf) < n:
            chunk = self.ser.read(n - len(buf))
            if not chunk:
                # timeout
                if (time.time() - start) >= self.timeout:
                    raise FingerprintError(f"Timeout reading {n} bytes from serial (got {len(buf)}).")
                continue
            buf += chunk
        return buf

    # ------------------------
    # Low-level send / receive
    # ------------------------
    def _send(self, packet: bytes):
        """Write the packet to serial and flush."""
        self.ser.write(packet)
        self.ser.flush()

    def _receive_response(self, expect_data: bool = False) -> Tuple[int, List[int], Optional[bytes]]:
        """
        Read response header (8 bytes). Return (cmd, params_list, data_bytes or None)

        Header format (response):
         0xF5 CMD Hi(Len) Low(Len) Q3 0 CHK 0xF5   (8 bytes)
        If Hi(Len)|Low(Len) > 0 -> there will be a data packet after header: 0xF5 <data> CHK 0xF5
        Data packet length = Len + 3 (prefix 0xF5, data len bytes, CHK, 0xF5) but we'll parse as:
          read 1 byte (should be 0xF5), then read Len bytes of data, then read CHK and trailing 0xF5
        Returns:
          cmd (int), [Q1,Q2,Q3?] list (length variable), data (bytes) or None
        """
        if self.ser.in_waiting < 198:
            return None, None, None

        header = self._read_exact(8)
        if header[0] != 0xF5 or header[-1] != 0xF5:
            raise FingerprintError(f"Invalid response header framing: {header.hex()}")

        cmd = header[1]
        hi = header[2]
        lo = header[3]
        q3 = header[4]
        # header checksum verify
        chk_calc = self._checksum(header[1:6])
        if chk_calc != header[6]:
            raise FingerprintError(f"Header checksum mismatch: calc {chk_calc:02x} != recv {header[6]:02x}")

        length = (hi << 8) | lo
        data = None
        if length > 0:
            # Now receive data packet: expect 0xF5, then length bytes, then CHK, then 0xF5
            first = self._read_exact(1)
            if first[0] != 0xF5:
                raise FingerprintError("Data packet does not start with 0xF5")
            payload = self._read_exact(length)
            tail = self._read_exact(2)  # CHK, 0xF5
            chk_calc = self._checksum(payload)  # manual: CHK is XOR of second byte to Len+1 in data packet.
            # In our payload-only approach, we XOR payload bytes (which correspond to data bytes)
            if chk_calc != tail[0]:
                raise FingerprintError("Data packet checksum mismatch")
            if tail[1] != 0xF5:
                raise FingerprintError("Data packet end byte not 0xF5")
            data = payload
        # Return command, params (give back Q3 and others if useful), and data
        params = [header[2], header[3], header[4]]  # hi, lo, Q3 (useful mapping depends on cmd)
        return cmd, params, data

    # ------------------------
    # Data commands (image / eigenvalues)
    # ------------------------

    def new_scan(self):
        self.hardware_reset()
        packet = self._build_simple_command(0x23)
        self._send(packet)
    
    def stop_scan(self):
        """Force module to exit scanning by entering sleep mode."""
        packet = self._build_simple_command(0x2C)
        self._send(packet)
        print("Stop (sleep) command sent.")

    def hardware_reset(self):
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(RST_PIN, GPIO.OUT)
        GPIO.output(RST_PIN, GPIO.LOW)
        time.sleep(0.05)  # 50 ms low pulse
        GPIO.output(RST_PIN, GPIO.HIGH)
        time.sleep(0.2)   # wait for module to boot
        GPIO.cleanup()
        print("Fingerprint module reset (woken from sleep).")

    def get_eigenvalues(self, wait=0) -> bytes:
        """
        CMD 0x23 Upload acquired images and extracted eigenvalue.
        Manual: eigenvalues data length Len-3 is fixed 193 bytes.
        We'll return raw eigenvalue payload (193 bytes expected).
        """
        time.sleep(wait)
        cmd, params, data = self._receive_response(expect_data=True)
        if data is None:
           return None
        return data  # likely starts with 0 0 0 then 193 bytes per manual; handle caller-side.

    # ------------------------
    # Utility: Conversion tools (JSON, bin)
    # ------------------------

    def eigen_to_json(self, eigen_bytes: bytes, filename: str = None) -> dict:
        """
        Convert raw eigenvalue bytes (193 bytes) into a JSON-serializable dict.

        Args:
            eigen_bytes (bytes): Raw eigenvalue data read from module (.bin format)
            filename (str, optional): If provided, save JSON to this file name

        Returns:
            dict: JSON-ready dictionary representation of the eigenvalue
        """
        data = {
            "type": "fingerprint",
            "data": base64.b64encode(eigen_bytes).decode("ascii"),
        }

        if filename:
            with open(filename, "w") as f:
                json.dump(data, f, indent=2)
            print(f"Eigenvalue saved to JSON file: {filename}")

        return data
    
    def eigen_from_json(self, json_data, bin_filename: str = None) -> bytes:
        """
        Convert a JSON representation of an eigenvalue back into raw bytes.

        Args:
            json_data (str | dict): JSON string or loaded dict containing eigenvalue
            bin_filename (str, optional): If provided, save bytes to .bin file

        Returns:
            bytes: Raw eigenvalue bytes suitable for upload to module
        """
        # Load JSON string if needed
        if isinstance(json_data, str):
            if Path(json_data).is_file():
                with open(json_data, "r") as f:
                    obj = json.load(f)
            else:
                obj = json.loads(json_data)
        else:
            obj = json_data

        if obj.get("format") != "fingerprint":
            raise ValueError("Invalid or missing format tag in JSON data")

        eigen_bytes = base64.b64decode(obj["data"])

        if bin_filename:
            with open(bin_filename, "wb") as f:
                f.write(eigen_bytes)
            print(f"Eigenvalue written to binary file: {bin_filename}")

        return eigen_bytes
    
    
if __name__ == "__main__":
    fp = FingerprintModule(port=DEFAULT_PORT, baud=DEFAULT_BAUD, timeout=0)

    print("Get eigenvalues of your fingerprint")
    print("Capturing eigenvalues...")

    fp.new_scan()
    try:
        while True:
            data = fp.get_eigenvalues()
            if data is not None:
                print(f"Eigenvalues length: {len(data)} bytes")
                print(data)
                print(f"JSON: \n {fp.eigen_to_json(data)}")
                break
            else:
                print("Waiting for data from scanner...")
                time.sleep(1)     
    except KeyboardInterrupt:
        fp.stop_scan()

