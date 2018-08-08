const _ = require('lodash');
const DeviceRegistry = require('./DeviceRegistry');

const pad2 = s => s.padStart(2, '0');

class SimulatorDeviceRegistry extends DeviceRegistry {
  constructor(appleSimUtils) {
    super({});
    this._applesimutils = appleSimUtils;
  }

  async createDeviceWithProperties(deviceProperties) {
    return this._applesimutils.create(deviceProperties);
  }

  async getDevicesWithProperties(deviceProperties) {
    return this._applesimutils.getDevicesWithProperties(deviceProperties);
  }

  async acquireDevice(devicePropertiesOrName) {
    const deviceProperties = typeof devicePropertiesOrName === 'string'
      ? this._convertToDeviceProperties(devicePropertiesOrName)
      : devicePropertiesOrName;

    return super.acquireDevice(deviceProperties);
  }

  _convertToDeviceProperties(deviceName) {
    const [name, version] = deviceName.split(',').map(s => s.trim());
    const osInfo = version ? { os: { version } } : null;

    return { name, ...osInfo };
  }

  getRuntimeVersion(deviceProperties) {
    const version = _.get(deviceProperties, ['os', 'version'], '0');
    const [major, minor = '00', patch = '00'] = version.split('.').map(pad2);

    return Number(major + minor + patch);
  }
}

module.exports = SimulatorDeviceRegistry;
