const _ = require('lodash');
const SimulatorDeviceRegistry = require('./SimulatorDeviceRegistry');

describe('SimulatorDeviceRegistry', () => {
  let fakeAppleSimUtils;
  let registry;

  beforeEach(() => {
    fakeAppleSimUtils = {
      create: jest.fn(),
      getDevicesWithProperties: jest.fn(),
    };

    registry = new SimulatorDeviceRegistry(fakeAppleSimUtils);
  });

  describe('createDeviceWithProperties', () => {
    it('should call apple sim utils: .create()', async () => {
      const params = {};

      fakeAppleSimUtils.create.mockReturnValue("UDID");
      expect(await registry.createDeviceWithProperties(params)).toBe("UDID");
      expect(fakeAppleSimUtils.create).toHaveBeenCalledWith(params);
    });

    it('should call apple sim utils: .getDevicesWithProperties()', async () => {
      const params = {};

      fakeAppleSimUtils.getDevicesWithProperties.mockReturnValue(['test']);
      expect(await registry.getDevicesWithProperties(params)).toEqual(['test']);
      expect(fakeAppleSimUtils.getDevicesWithProperties).toHaveBeenCalledWith(params);
    });
  });

  describe('getRuntimeVersion', () => {
    beforeEach(() => {
      registry = new SimulatorDeviceRegistry(null);
    });

    function withVersion(version) {
      return { os: { version }};
    }

    it('should return 0 from undefined', () => {
      expect(registry.getRuntimeVersion(withVersion())).toBe(0);
    });

    it('should return 5-6 digit number from strings', () => {
      const ascending =
        ['0', '9', '9.1.1', '11', '11.3', '11.4.1', '11.4.10', '11.10.1', '11.10.10'].map(withVersion);

      const shuffled = _.shuffle(ascending);
      const sorted = _.sortBy(shuffled, registry.getRuntimeVersion);

      expect(sorted).toEqual(ascending);
    });
  });
});
