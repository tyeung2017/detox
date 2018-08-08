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

  getRuntimeVersion(deviceProperties) {
    const version = _.get(deviceProperties, ['os', 'version'], '0');
    const [major, minor = '00', patch = '00'] = version.split('.').map(pad2);

    return Number(major + minor + patch);
  }
}

module.exports = SimulatorDeviceRegistry;
