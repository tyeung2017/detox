jest.mock('./DeviceRegistryLock');
const DeviceRegistry = require('./DeviceRegistry');

describe('DeviceRegistry', () => {
  let registry;
  let deviceRegistryLock;
  let createDeviceWithProperties;
  let getDevicesWithProperties;

  beforeEach(() => {
    createDeviceWithProperties = jest.fn();
    getDevicesWithProperties = jest.fn();
    deviceRegistryLock = require('./DeviceRegistryLock');

    registry = new DeviceRegistry({
      createDeviceWithProperties,
      getDevicesWithProperties,
    });
  });

  function generateDeviceList(type, length) {
    const devicesIds = Array.from(Array(length).keys());
    return devicesIds.map(deviceId => `id-${deviceId}-of-type-${type}`);
  }

  describe(`acquireDevice`, () => {

    it('should throw if device with given name is not found', async () => {
      getDevicesWithProperties.mockReturnValue([]);
      await expect(registry.acquireDevice('iPhone X')).rejects.toThrowErrorMatchingSnapshot();
    });

    // it('should return exact match device id  is not found', async () => {
    //   getDevicesWithProperties.mockReturnValue([]);
    //   await expect(registry.acquireDevice('iPhone X')).rejects.toThrowErrorMatchingSnapshot();
    // });
    //
    // it(`should create device if there's no device available`, async () => {
    //   getDevicesWithProperties.mockReturnValue([]);
    //
    //   await registry.acquireDevice('iPhone X');
    //
    //   expect(createDeviceWithProperties).toHaveBeenCalledTimes(1);
    //   expect(createDeviceWithProperties).toHaveBeenCalledWith('iPhone X');
    // });
    //
    // it(`should not create device if there's no device available`, async () => {
    //   getDevicesWithProperties.mockReturnValue(generateDeviceList('iPhone X', 1));
    //
    //   await registry.acquireDevice('iPhone X');
    //
    //   expect(createDeviceWithProperties).toHaveBeenCalledTimes(0);
    // });
    //
    // it(`should create device if all available devices are busy`, async () => {
    //   getDevicesWithProperties.mockReturnValue(generateDeviceList('iPhone X', 1));
    //
    //   await registry.acquireDevice('iPhone X');
    //   await registry.acquireDevice('iPhone X');
    //
    //   expect(createDeviceWithProperties).toHaveBeenCalledTimes(1);
    // });
  });

  describe('free device', () => {
    // it('should free device', async () => {
    //   const deviceList = generateDeviceList('iPhone X', 1);
    //   const deviceId = deviceList[0];
    //   getDevicesWithProperties.mockReturnValue(deviceList);
    //
    //   await registry.acquireDevice('iPhoneX');
    //   expect(await registry.isBusy(deviceId)).toBe(true);
    //
    //   await registry.freeDevice(deviceId);
    //   expect(await registry.isBusy(deviceId)).toBe(false);
    // });
  });
});