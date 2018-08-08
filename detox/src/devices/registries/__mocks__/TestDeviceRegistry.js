const DeviceRegistry = require('../DeviceRegistry');

class TestDeviceRegistry extends DeviceRegistry {
  constructor({
    deviceRegistryLock,
    createDeviceWithProperties,
    getDevicesWithProperties,
    getRuntimeVersion,
  }) {
    super({ deviceRegistryLock });

    this.createDeviceWithProperties = createDeviceWithProperties;
    this.getDevicesWithProperties = getDevicesWithProperties;
    this.getRuntimeVersion = getRuntimeVersion;
  }

  async acquireDevice(deviceName) {
    return super.acquireDevice({ name: deviceName });
  }
}

module.exports = TestDeviceRegistry;
