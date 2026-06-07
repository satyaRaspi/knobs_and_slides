"""
Future Bluetooth adapter placeholder.

The simulator currently sends the same payload shape that a BLE adapter should publish later:
{
    "device_id": "KNOB_001",
    "relative_position": 124.455
}

When moving to real hardware, this file can use bleak to subscribe to a BLE characteristic
and forward parsed events into the same mapping pipeline used by /api/simulate-input.
"""

class BluetoothAdapter:
    def __init__(self):
        self.enabled = False

    async def start(self):
        raise NotImplementedError("Real Bluetooth support is reserved for a future release.")
