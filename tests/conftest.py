"""Pytest configuration and shared fixtures for GenLayer LicenseScope tests."""

import os
import sys
import tempfile
from pathlib import Path

from gltest.direct.sdk_loader import setup_sdk_paths
from gltest.direct.vm import VMContext

CONTRACT_PATH = Path(__file__).parent.parent / "contracts" / "license_scope.py"
SDK_PATHS = setup_sdk_paths(CONTRACT_PATH)

# The pytest plugin may import a runner before the contract-pinned path is known.
# Remove only loaded SDK modules so collection imports one exact runner generation.
for module_name in tuple(sys.modules):
    if module_name == "genlayer" or module_name.startswith("genlayer."):
        del sys.modules[module_name]


def cleanup_preserving_pinned_sdk(self) -> None:
    """Keep one contract-pinned SDK generation while restoring per-test VM state."""
    self._warn_unused_mocks()
    stdin_fd = getattr(self, "_original_stdin_fd", None)
    if stdin_fd is not None:
        try:
            os.dup2(stdin_fd, 0)
            os.close(stdin_fd)
        except OSError:
            pass
        self._original_stdin_fd = None


VMContext._cleanup_after_deactivate = cleanup_preserving_pinned_sdk

# genlayer-test 0.29.2 unlinks an open fd0 backing file on Windows. The SDK
# message singleton is reloaded for each fresh contract module.
if sys.platform == "win32":
    import gltest.direct.loader as direct_loader

    active_message_file = None

    def inject_message_to_fd0(vm):
        global active_message_file

        from genlayer.py import calldata
        from genlayer.py.types import Address

        def current_address(value):
            if isinstance(value, Address):
                return value
            if isinstance(value, bytes):
                return Address(value)
            if hasattr(value, "as_bytes"):
                return Address(value.as_bytes)
            return Address(str(value))

        encoded = calldata.encode(
            {
                "contract_address": current_address(vm._contract_address),
                "sender_address": current_address(vm.sender),
                "origin_address": current_address(vm.origin),
                "stack": [],
                "value": vm._value,
                "datetime": vm._datetime,
                "is_init": False,
                "chain_id": vm._chain_id,
                "entry_kind": 0,
                "entry_data": b"",
                "entry_stage_data": None,
            }
        )

        next_message_file = tempfile.TemporaryFile()  # noqa: SIM115 -- must outlive fd0.
        next_message_file.write(encoded)
        next_message_file.seek(0)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(next_message_file.fileno(), 0)

        previous_message_file = active_message_file
        active_message_file = next_message_file
        if previous_message_file is not None:
            previous_message_file.close()

    direct_loader._inject_message_to_fd0 = inject_message_to_fd0

# Add contracts directory to sys.path
contracts_dir = str(Path(__file__).parent.parent / "contracts")
if contracts_dir not in sys.path:
    sys.path.insert(0, contracts_dir)

# Set up WASI mock in sys.modules
from gltest.direct import wasi_mock

sys.modules["_genlayer_wasi"] = wasi_mock

# Inject dummy message into fd 0 so genlayer can be imported cleanly
from genlayer.py import calldata
from genlayer.py.types import Address

zero_address = Address("0x0000000000000000000000000000000000000000")
dummy_msg = {
    "contract_address": zero_address.as_bytes,
    "sender_address": zero_address.as_bytes,
    "origin_address": zero_address.as_bytes,
    "value": 0,
    "chain_id": 61999,
    "is_init": False,
}
encoded = calldata.encode(dummy_msg)
bootstrap_message_file = tempfile.TemporaryFile()  # noqa: SIM115 -- must outlive fd0.
bootstrap_message_file.write(encoded)
bootstrap_message_file.seek(0)
os.dup2(bootstrap_message_file.fileno(), 0)
