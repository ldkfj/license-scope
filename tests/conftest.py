"""Pytest configuration and shared fixtures for GenLayer LicenseScope tests."""

import os
import sys
import tempfile
from pathlib import Path

# Add contracts directory to sys.path
contracts_dir = str(Path(__file__).parent.parent / "contracts")
if contracts_dir not in sys.path:
    sys.path.insert(0, contracts_dir)

# Set up WASI mock in sys.modules
try:
    import gltest.direct.wasi_mock as wasi_mock
    sys.modules["_genlayer_wasi"] = wasi_mock
except Exception:
    pass

# Inject dummy message into fd 0 so genlayer can be imported cleanly
try:
    from genlayer.py import calldata
    from genlayer.py.types import Address

    dummy_addr = Address("0x1111111111111111111111111111111111111111")
    dummy_msg = {
        "contract_address": dummy_addr,
        "sender_address": dummy_addr,
        "origin_address": dummy_addr,
        "value": 0,
        "chain_id": 6174,
    }
    encoded = calldata.encode(dummy_msg)
    tf = tempfile.NamedTemporaryFile(delete=False)
    tf.write(encoded)
    tf.flush()
    tf.close()
    fd = os.open(tf.name, os.O_RDONLY)
    os.dup2(fd, 0)
    os.close(fd)
except Exception:
    pass
