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
    # High-level commands (8-byte)
    # ------------------------

    def enroll_step(self, step_num: int, user_id: int, privilege: int = 1) -> int:
        """
        Enroll step: step_num = 1,2,3 => CMD 0x01 | 0x02 | 0x03
        user_id: 1..0xFFF
        privilege: 1..3
        Returns Q3 (ACK code)
        """
        if step_num not in (1, 2, 3):
            raise ValueError("step_num must be 1,2,3")

        cmd_map = {1: 0x01, 2: 0x02, 3: 0x03}
        cmd = cmd_map[step_num]
        uid_hi = (user_id >> 8) & 0xFF
        uid_lo = user_id & 0xFF
        packet = self._build_simple_command(cmd, uid_hi, uid_lo, privilege & 0xFF)
        self._send(packet)
        _, params, _ = self._receive_response()
        return params[2]

    def delete_user(self, user_id: int) -> int:
        """CMD 0x04 delete specified user. Returns Q3 (ACK code)."""
        uid_hi = (user_id >> 8) & 0xFF
        uid_lo = user_id & 0xFF
        packet = self._build_simple_command(0x04, uid_hi, uid_lo, 0x00)
        self._send(packet)
        _, params, _ = self._receive_response()
        return params[2]

    def delete_all(self) -> int:
        """CMD 0x05 delete all users. Returns Q3."""
        packet = self._build_simple_command(0x05)
        self._send(packet)
        _, params, _ = self._receive_response()
        return params[2]

    def compare_1_to_1(self, user_id: int) -> int:
        """CMD 0x0B Compare 1:1 with specified ID. Returns Q3 (ACK)."""
        uid_hi = (user_id >> 8) & 0xFF
        uid_lo = user_id & 0xFF
        packet = self._build_simple_command(0x0B, uid_hi, uid_lo, 0x00)
        self._send(packet)
        _, params, _ = self._receive_response()
        return params[2]

    def compare_1_to_n(self) -> Tuple[int, Optional[int], Optional[int]]:
        """
        CMD 0x0C Compare 1:N. On success response includes UserID high, low, privilege in Q1/Q2/Q3 positions.
        Returns (ack_code, user_id or None, privilege or None)
        """
        packet = self._build_simple_command(0x0C)
        self._send(packet)
        cmd, params, _ = self._receive_response()
        # params: [user_hi, user_lo, privilege or ACK_*]
        # In some cases params[2] might be ACK_NOUSER / ACK_TIMEOUT
        if params[2] == ACK_NOUSER or params[2] == ACK_TIMEOUT:
            return params[2], None, None
        user_id = (params[0] << 8) | params[1]
        privilege = params[2]
        return ACK_SUCCESS, user_id, privilege

    # ------------------------
    # Data commands (image / eigenvalues)
    # ------------------------
    def upload_image(self) -> bytes:
        """
        CMD 0x24 Acquire and upload images (response > 8 bytes).
        Manual: image fixed size of 9176 bytes.
        Returns raw image payload bytes (length should be 9176).
        """
        packet = self._build_simple_command(0x24)
        self._send(packet)
        cmd, params, data = self._receive_response(expect_data=True)
        if data is None:
            raise FingerprintError("No image data received")
        # Manual: data length fixed 9176
        return data

    def upload_eigenvalues(self) -> bytes:
        """
        CMD 0x23 Upload acquired images and extracted eigenvalue.
        Manual: eigenvalues data length Len-3 is fixed 193 bytes.
        We'll return raw eigenvalue payload (193 bytes expected).
        """
        packet = self._build_simple_command(0x23)
        self._send(packet)
        cmd, params, data = self._receive_response(expect_data=True)
        if data is None:
            raise FingerprintError("No eigenvalue data received")
        return data  # likely starts with 0 0 0 then 193 bytes per manual; handle caller-side.

    def download_eigen_compare(self, eigenbytes: bytes) -> int:
        """
        CMD 0x44 Download eigenvalues and acquire fingerprint comparison.
        This is a data command: header + data (len includes eigenvalue length).
        Manual: eigenvalue data length Len-3 fixed 193 bytes.
        Response will be 8-byte ACK in params.
        """
        # Build data command with CMD 0x44 and eigenbytes
        packet = self._build_data_command(0x44, eigenbytes)
        self._send(packet)
        _, params, _ = self._receive_response()
        return params[2]

    def upload_user_eigen(self, user_id: int) -> bytes:
        """
        CMD 0x31 Upload the DSP module database specified user eigenvalue (response > 8 bytes).
        Returns the user eigenvalue payload (includes user id, privilege and eigenvalue).
        """
        uid_hi = (user_id >> 8) & 0xFF
        uid_lo = user_id & 0xFF
        packet = self._build_simple_command(0x31, uid_hi, uid_lo, 0x00)
        self._send(packet)
        _, params, data = self._receive_response(expect_data=True)
        if data is None:
            raise FingerprintError("No eigenvalue data received")
        return data

    # ------------------------
    # Utility: image unpacking
    # ------------------------
    @staticmethod
    def unpack_image(raw: bytes, width: int = 124, height: int = 148) -> bytes:
        """
        The module transmits an image compressed to 124*148 bytes/2 packing: each transmitted byte contains
        two pixels' high-4-bit values:
          - lower nibble = previous pixel's high4bits
          - upper nibble = last pixel's high4bits
        To reconstruct each pixel's 8-bit gray value: nibble << 4

        Input raw length expected = width*height/2 = 124*148/2 = 9176 (per manual).
        Returns a bytes object of length width*height where each value is 0-255.
        """
        expected_len = (width * height) // 2
        if len(raw) != expected_len:
            raise ValueError(f"Unexpected raw image length {len(raw)}, expected {expected_len}")
        out = bytearray()
        for b in raw:
            low_n = b & 0x0F
            high_n = (b >> 4) & 0x0F
            pix1 = (low_n << 4) & 0xF0
            pix2 = (high_n << 4) & 0xF0
            out.append(pix1)
            out.append(pix2)
        return bytes(out)

    # ------------------------
    # High-level convenience flows
    # ------------------------
    def enroll_user(self, user_id: int, privilege: int = 1, wait_msg: Optional[callable] = None) -> int:
        """
        Full 3-step enroll flow:
          1) send CMD 0x01 then ask to place finger
          2) send CMD 0x02 then ask to place finger again
          3) send CMD 0x03 then ask to place finger third time
        wait_msg: optional callable to give user prompts, called with a string
        Returns final Q3 code
        """
        # Step 1
        if wait_msg:
            wait_msg("Place finger for 1st scan.")
        q1 = self.enroll_step(1, user_id, privilege)
        if q1 != ACK_SUCCESS:
            return q1
        if wait_msg:
            wait_msg("Remove finger, then place finger for 2nd scan.")
        q2 = self.enroll_step(2, user_id, privilege)
        if q2 != ACK_SUCCESS:
            return q2
        if wait_msg:
            wait_msg("Remove finger, then place finger for 3rd scan.")
        q3 = self.enroll_step(3, user_id, privilege)
        return q3

# ------------------------
# CLI
# ------------------------
if __name__ == "__main__":
    import argparse, sys, time
    ap = argparse.ArgumentParser(
        description=(
            "Fingerprint Module CLI Utility\n"
            "--------------------------------\n"
            "Control your UART fingerprint sensor connected to Raspberry Pi.\n\n"
            "Examples:\n"
            "  python3 fingerprint_extended.py enroll 1          Enroll new user with ID=1\n"
            "  python3 fingerprint_extended.py identify           Identify a finger (1:N)\n"
            "  python3 fingerprint_extended.py verify 1           Verify finger against ID=1\n"
            "  python3 fingerprint_extended.py upload_image       Capture raw fingerprint image\n"
            "\n"
            "Tip: Use --help after any command for details, e.g.\n"
            "  python3 fingerprint_extended.py enroll --help"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )

    ap.add_argument("--port", default=DEFAULT_PORT, help="Serial port (default: /dev/serial0)")
    ap.add_argument("--baud", default=DEFAULT_BAUD, type=int, help="Baud rate (default: 19200)")
    ap.add_argument("--timeout", default=10.0, type=float, help="Serial read timeout in seconds")

    sub = ap.add_subparsers(dest="cmd", title="Commands", metavar="<command>")

    # ---------------- Basic ----------------
    basic = [
        ("enroll", "Enroll a user (3 scans required)"),
        ("delete", "Delete a specific user"),
        ("delete_all", "Delete all enrolled users"),
        ("identify", "Identify a finger (1:N match)"),
        ("verify", "Verify finger against a specific user ID")
    ]
    for name, desc in basic:
        sub.add_parser(name, help=desc)

    sub._name_parser_map["enroll"].add_argument("id", type=int, help="User ID (1–N)")
    sub._name_parser_map["enroll"].add_argument("--priv", type=int, default=1, help="Privilege level (default: 1)")
    sub._name_parser_map["delete"].add_argument("id", type=int, help="User ID to delete")
    sub._name_parser_map["verify"].add_argument("id", type=int, help="User ID to verify")

    # ---------------- Image & Eigen ----------------
    sub.add_parser("upload_image", help="Capture and save fingerprint image (124x148 packed)")
    sub.add_parser("upload_eigen", help="Capture and save eigenvalue from current scan")

    up_user = sub.add_parser("upload_user_eigen", help="Download stored eigenvalue of a user")
    up_user.add_argument("id", type=int, help="User ID to download")

    cmp_eigen = sub.add_parser("compare_eigen", help="Compare saved eigenvalue (.bin) with live scan")
    cmp_eigen.add_argument("path", help="Path to eigenvalue file (.bin)")

    save_eigen = sub.add_parser("save_eigen", help="Capture eigenvalue and save to file")
    save_eigen.add_argument("path", help="Path to save eigenvalue file (.bin)")

    # Show help if no command is given
    if len(sys.argv) == 1:
        ap.print_help(sys.stderr)
        sys.exit(0)

    args = ap.parse_args()
    # --- Create module object ---
    fp = FingerprintModule(port=args.port, baud=args.baud, timeout=args.timeout)

    try:
        if args.cmd == "enroll":
            def msg(s): print(s)
            rc = fp.enroll_user(args.id, args.priv, wait_msg=msg)
            print("Enroll final code:", rc)

        elif args.cmd == "delete":
            rc = fp.delete_user(args.id)
            print("Delete result:", rc)

        elif args.cmd == "delete_all":
            rc = fp.delete_all()
            print("Delete all result:", rc)

        elif args.cmd == "identify":
            print("Place finger to identify...")
            ack, uid, priv = fp.compare_1_to_n()
            if ack == ACK_SUCCESS and uid is not None:
                print(f"Identified user {uid} privilege {priv}")
            elif ack == ACK_NOUSER:
                print("No match found")
            else:
                print(f"Identification result code: {ack}")

        elif args.cmd == "verify":
            print(f"Place finger for verification against user {args.id}")
            ack = fp.compare_1_to_1(args.id)
            if ack == ACK_SUCCESS:
                print("Verified successfully")
            else:
                print("Verification failed or no match, ACK:", ack)

        elif args.cmd == "upload_image":
            print("Capturing image... place finger on sensor.")
            data = fp.upload_image()
            print(f"Image captured: {len(data)} bytes")
            with open("finger_image.raw", "wb") as f:
                f.write(data)
            print("Saved raw image to finger_image.raw")

        elif args.cmd == "upload_eigen":
            print("Capturing eigenvalue...")
            data = fp.upload_eigenvalues()
            print(f"Eigenvalue length: {len(data)} bytes")
            with open("eigenvalue.bin", "wb") as f:
                f.write(data)
            print("Saved eigenvalue to eigenvalue.bin")

        elif args.cmd == "upload_user_eigen":
            data = fp.upload_user_eigen(args.id)
            print(f"Uploaded eigenvalue for user {args.id}: {len(data)} bytes")
            with open(f"user_{args.id}_eigen.bin", "wb") as f:
                f.write(data)
            print(f"Saved to user_{args.id}_eigen.bin")

        elif args.cmd == "compare_eigen":
            with open(args.path, "rb") as f:
                eigen = f.read()
            print(f"Loaded eigenvalue ({len(eigen)} bytes). Place finger for comparison.")
            rc = fp.download_eigen_compare(eigen)
            print("Compare result ACK:", rc)

            # Interpret ACK code
            if rc == 0x00:
                print("Fingerprint match SUCCESS")
            elif rc == 0x01:
                print("Fingerprint does not match")
            elif rc == 0x08:
                print("No finger detected in time")
            else:
                print(f"Unknown ACK code: {rc}")

        elif args.cmd == "save_eigen":
            print("Place finger for eigenvalue capture...")
            data = fp.upload_eigenvalues()
            with open(args.path, "wb") as f:
                f.write(data)
            print(f"Eigenvalue saved to {args.path}")
        else:
            ap.print_help()

    finally:
        fp.close()

