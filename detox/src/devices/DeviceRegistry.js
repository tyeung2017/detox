const { omit } = require('lodash');
const { ensureSuffix } = require('../utils/string');
const log = require('../utils/logger').child({ __filename });
const DeviceRegistryLock = require('./DeviceRegistryLock');

class DeviceRegistry {
  constructor({
    createDeviceWithProperties,
    getDevicesWithProperties,
  }) {
    this._createDeviceWithProperties = createDeviceWithProperties;
    this._getDevicesWithProperties = getDevicesWithProperties;
    this._deviceRegistryLock = new DeviceRegistryLock();
  }

  async acquireDevice(deviceName) {
    await this._deviceRegistryLock.lock();

    const exactMatch = await this._findExactDevice({ name: deviceName });
    const similarMatch = exactMatch.available ? exactMatch : await this._findSimilarDevice(exactMatch.any);
    const device = similarMatch.available || await this._createSimilarDevice(exactMatch.any);

    this._deviceRegistryLock.busyDevices.add(device.id);
    await this._deviceRegistryLock.unlock();

    return device.id;
  }

  async freeDevice(deviceId) {
    await this._deviceRegistryLock.lock();
    this._deviceRegistryLock.busyDevices.remove(deviceId);
    await this._deviceRegistryLock.unlock();
  }

  async _findExactDevice(searchQuery) {
    const match = await this._findDeviceByQuery(searchQuery);

    if (match.available) {
      const { name, id } = match.available;
      log.trace({ event: 'EXACT_DEVICE_ACQUIRED' }, `device with name="${name}" and id="${id}" is acquired.`);
    }

    return match;
  }

  async _findSimilarDevice(deviceProperties) {
    const nonSpecificPropertiesOfDevice = omit(deviceProperties, ['id', 'name']);
    const match = await this._findDeviceByQuery(nonSpecificPropertiesOfDevice);

    if (match.available) {
      const { id } = match.available;
      const { name } = deviceProperties;
      log.trace({ event: 'SIMILAR_DEVICE_ACQUIRED' }, `similar device to "${name}" with id="${id}" is acquired.`);
    }

    return match;
  }

  async _createSimilarDevice(deviceProperties) {
    const deviceName = deviceProperties.name;
    const newDeviceProperties = {
      ...omit(deviceProperties, ['id']),
      name: ensureSuffix(deviceName, '-Detox')
    };

    log.debug({ event: 'CREATING_SIMILAR_DEVICE' },
      `creating device similar to ${deviceName} with properties:`, newDeviceProperties);

    const newUDID = await this._createDeviceWithProperties(newDeviceProperties);

    return {
      ...newDeviceProperties,
      id: newUDID
    };
  }

  async _findDeviceByQuery(searchQuery) {
    const foundDevices = await this._getDevicesWithProperties(searchQuery);

    return {
      available: foundDevices.find(this._isDeviceAvailable, this),
      any: foundDevices[0]
    };
  }

  _isDeviceAvailable(deviceId) {
    const busy = this._deviceRegistryLock.busyDevices.has(deviceId);

    return !busy;
  }
}

module.exports = DeviceRegistry;
