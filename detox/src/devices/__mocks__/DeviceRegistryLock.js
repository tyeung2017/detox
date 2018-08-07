class DeviceRegistryLock {
  constructor() {
    this._busyDevices = null;
    this._fileContents = [];
  }

  get busyDevices() {
    if (!this._busyDevices) {
      throw new Error('Cannot access busy devices list while not being inside the lock.');
    }

    return this._busyDevices;
  }

  async lock() {
    this._busyDevices = new Set(this._fileContents);
  }

  async unlock() {
    this._fileContents = [...this._busyDevices.values()];
    this._busyDevices = null;
  }
}

module.exports = DeviceRegistryLock;
