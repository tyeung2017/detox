const fs = require('fs-extra');
const plockfile = require('proper-lockfile');
const retry = require('../utils/retry');
const environment = require('../utils/environment');

class DeviceRegistryLock {
  constructor({
    lockFilePath = environment.getDeviceLockFilePath(),
    lockRetryOptions = DeviceRegistryLock.DEFAULT_LOCK_RETRY_OPTIONS
  } = {}) {
    this._busyDevices = null;
    this._lockFilePath = lockFilePath;
    this._lockRetryOptions = lockRetryOptions;
  }

  get busyDevices() {
    if (!this._busyDevices) {
      throw new Error('Cannot access busy devices list while not being inside the lock.');
    }

    return this._busyDevices;
  }

  async lock() {
    await this._createEmptyLockFileIfItDoesNotExist();
    await retry(this._lockRetryOptions, () => plockfile.lock(this._lockFilePath));
    await this._readBusyDevicesFromLockFile();
  }

  async unlock() {
    await this._writeBusyDevicesToLockFile();
    this._busyDevices = null;
    await plockfile.unlockSync(this._lockFilePath);
  }

  async _createEmptyLockFileIfItDoesNotExist() {
    const exists = await fs.exists(this._lockFilePath);

    if (!exists) {
      await fs.ensureFile(this._lockFilePath);
      await fs.writeFile(this._lockFilePath, '[]');
    }
  }

  async _readBusyDevicesFromLockFile() {
    const lockFileContent = await fs.readFile(this._lockFilePath, 'utf-8');
    const busyDeviceIds = JSON.parse(lockFileContent);

    this._busyDevices = new Set(busyDeviceIds);
  }

  async _writeBusyDevicesToLockFile() {
    const busyDeviceIds = [...this.busyDevices.values()];
    await fs.writeFile(this._lockFilePath, JSON.stringify(busyDeviceIds));
  }
}

DeviceRegistryLock.DEFAULT_LOCK_RETRY_OPTIONS = { retries: 10000, interval: 5 };

module.exports = DeviceRegistryLock;