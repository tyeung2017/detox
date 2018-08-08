const _ = require('lodash');
const simctlList = require('./xcrunSimctlList.mock.json');

describe('AppleSimUtils', () => {
  let AppleSimUtils;
  let uut;
  let exec;
  let retry;
  let environment;
  let tempfile;

  const simUdid = `9C9ABE4D-70C7-49DC-A396-3CB1D0E82846`;
  const bundleId = 'bundle.id';

  beforeEach(() => {
    jest.mock('../../utils/logger');
    jest.mock('../../utils/exec');
    exec = require('../../utils/exec');
    jest.mock('../../utils/retry');
    retry = require('../../utils/retry');
    jest.mock('../../utils/environment');
    environment = require('../../utils/environment');
    environment.getHomeDir.mockReturnValue('/Users/detox');
    jest.mock('tempfile');
    tempfile = require('tempfile');

    AppleSimUtils = require('./AppleSimUtils');
    uut = new AppleSimUtils();
  });

  it(`appleSimUtils setPermissions`, async () => {
    uut.setPermissions(bundleId, simUdid, {
      permissions:
      { calendar: "YES" }
    });
    expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
  });

  describe('getXcodeVersion', () => {
    it('returns xcode major version', async () => {
      exec.execWithRetriesAndLogs.mockReturnValueOnce(Promise.resolve({ stdout: 'Xcode 123.456\nBuild version 123abc123\n' }));
      const result = await uut.getXcodeVersion();
      expect(result).toEqual(123);
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('handles all sorts of results', async () => {
      exec.execWithRetriesAndLogs.mockReturnValueOnce(Promise.resolve({ stdout: 'Xcode 999' }));
      const result = await uut.getXcodeVersion();
      expect(result).toEqual(999);
    });

    it('throws when cant read version', async () => {
      try {
        await uut.getXcodeVersion();
        fail(`should throw`);
      } catch (e) {
        expect(e).toEqual(new Error(`Can't read Xcode version, got: 'undefined'`));
      }
    });

    it('throws when invalid version', async () => {
      exec.execWithRetriesAndLogs.mockReturnValueOnce(Promise.resolve({ stdout: 'Xcode bla' }));
      try {
        await uut.getXcodeVersion();
        fail(`should throw`);
      } catch (e) {
        expect(e).toEqual(new Error(`Can't read Xcode version, got: 'Xcode bla'`));
      }
    });
  });

  describe('boot', () => {

    it('waits for device by udid to be Shutdown, boots magically, then waits for state to be Booted', async () => {
      uut.getDevicesWithProperties = jest.fn(() => Promise.resolve([{ state: 'unknown' }]));
      uut.getXcodeVersion = jest.fn(() => Promise.resolve(1));
      expect(exec.execWithRetriesAndLogs).not.toHaveBeenCalled();
      await uut.boot('some-udid');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('skips if device state was already Booted', async () => {
      uut.getDevicesWithProperties = jest.fn(() => Promise.resolve([{ state: 'Booted' }]));
      uut.getXcodeVersion = jest.fn(() => Promise.resolve(1));
      await uut.boot('udid');
      expect(uut.getDevicesWithProperties).toHaveBeenCalledTimes(1);
      expect(uut.getDevicesWithProperties).toHaveBeenCalledWith({ udid: 'udid' });
      expect(exec.execWithRetriesAndLogs).not.toHaveBeenCalled();
    });

    it('skips if device state was already Booting', async () => {
      uut.getDevicesWithProperties = jest.fn(() => Promise.resolve([{ state: 'Booting' }]));
      uut.getXcodeVersion = jest.fn(() => Promise.resolve(1));
      await uut.boot('udid');
      expect(uut.getDevicesWithProperties).toHaveBeenCalledTimes(1);
      expect(exec.execWithRetriesAndLogs).not.toHaveBeenCalled();
    });

    it('boots with xcrun simctl boot when xcode version >= 9', async () => {
      uut.getDevicesWithProperties = jest.fn(() => Promise.resolve([{ state: 'unknown' }]));
      uut.getXcodeVersion = jest.fn(() => Promise.resolve(9));
      await uut.boot('udid');
      expect(uut.getXcodeVersion).toHaveBeenCalledTimes(1);
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();

    });
  });

  describe('create', () => {

    it('calls xcrun to get a list of runtimes/devicetypes/devices', async () => {
      exec.execWithRetriesAndLogs.mockReturnValue(Promise.resolve({
        stdout: "d01ba89f-f186-456d-8533-2448f0f47d2d"
      }));

      const created = await uut.createDeviceWithProperties({
        name: 'iPhone X',
        deviceType: {
          identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-X',
        },
        os: {
          identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-11-3',
        },
      });

      expect(created).toBe("d01ba89f-f186-456d-8533-2448f0f47d2d");
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('throw if did not get something similar to guid', async () => {
      exec.execWithRetriesAndLogs.mockReturnValue(Promise.resolve({
        stdout: "d01ba89f-f186-456d-8533-2448f0f47d2d"
      }));

      const created = await uut.createDeviceWithProperties({
        name: 'iPhone X',
        deviceType: {
          identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-X',
        },
        os: {
          identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-11-3',
        },
      });

      expect(created).toBe("d01ba89f-f186-456d-8533-2448f0f47d2d");
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    xit('creates using the newest runtime version', async () => {
      exec.execWithRetriesAndLogs.mockReturnValueOnce(Promise.resolve({stdout: JSON.stringify(simctlList)}));

      const created = await uut.create('iPhone 7 Plus');

      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
      expect(created).toEqual(true);
    });
  });


  describe('install', () => {
    it('calls xcrun', async () => {
      await uut.install('udid', 'somePath');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('uninstall', () => {
    it('calls xcrun', async () => {
      await uut.uninstall('udid', 'theBundleId');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('does not throw', async () => {
      exec.execWithRetriesAndLogs.mockImplementation(() => Promise.reject('some reason'));
      await uut.uninstall('udid', 'theBundleId');
    });
  });

  describe('launch', () => {
    it('launches magically', async () => {
      await uut.launch('udid', 'theBundleId');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('concats args', async () => {
      await uut.launch('udid', 'theBundleId', { 'foo': 'bar', 'bob': 'yourUncle' });
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('asks environment for frameworkPath', async () => {
      environment.getFrameworkPath.mockReturnValueOnce(Promise.resolve('thePathToFrameworks'));
      await uut.launch('udid', 'theBundleId');
      expect(environment.getFrameworkPath).toHaveBeenCalledTimes(1);
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('should fail when cant locate framework path', async () => {
      environment.getFrameworkPath.mockReturnValueOnce(Promise.reject('cant find anything'));
      try {
        await uut.launch('udid', 'theBundleId');
        fail(`should throw`);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('returns the parsed id', async () => {
      exec.execWithRetriesAndLogs.mockReturnValueOnce(Promise.resolve({ stdout: 'appId: 12345 \n' }));
      const result = await uut.launch('udid', 'theBundleId');
      expect(result).toEqual(12345);
    });
  });

  describe('sendToHome', () => {
    it('calls xcrun', async () => {
      await uut.sendToHome('theUdid');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('getLogsPaths', () => {
    it('returns correct paths', () => {
      expect(uut.getLogsPaths('123')).toMatchSnapshot();
    });
  });

  describe('terminate', () => {
    it('calls xcrun simctl', async () => {
      await uut.terminate('theUdid', 'thebundleId');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('shutdown', () => {
    it('calls xcrun simctl', async () => {
      await uut.shutdown('theUdid');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('openUrl', () => {
    it('calls xcrun simctl', async () => {
      await uut.openUrl('theUdid', 'someUrl');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('setLocation', () => {
    it('throws when no fbsimctl installed', async () => {
      try {
        await uut.setLocation('theUdid', 123.456, 789.123);
        fail(`should throw`);
      } catch (e) {
        expect(e.message).toMatch(/.*Install fbsimctl using.*/);
        expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
      }
    });

    it('calls fbsimctl set_location', async () => {
      exec.execWithRetriesAndLogs.mockReturnValueOnce(Promise.resolve({ stdout: `true` }));
      await uut.setLocation('theUdid', 123.456, 789.123);
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('resetContentAndSettings', () => {
    it('shutdown, simctl erase, then boot', async () => {
      await uut.resetContentAndSettings('theUdid');
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });
  });

  describe('takeScreenshot', () => {
    it('executes simctl screenshot command', async () => {
      const udid = 'FBD9308E-33CC-4E43-92AD-FA7E1C06851A';
      const dest = '/tmp/' + 'screenshot.png';

      await uut.takeScreenshot(udid, dest);
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
    });

    it('executes simctl screenshot command silently (if dest is /dev/null)', async () => {
      const udid = 'FBD9308E-33CC-4E43-92AD-FA7E1C06851A';
      const dest = '/dev/null';

      await uut.takeScreenshot(udid, dest);
      expect(exec.execWithRetriesAndLogs.mock.calls).toMatchSnapshot();
      expect(exec.execWithRetriesAndLogs.mock.calls[0][1].silent).toBe(true);
    });
  });

  describe('recordVideo', () => {
    it('spawns simctl process with recordVideo command', async () => {
      const childProcessPromise = Object.assign(Promise.resolve(), { childProcess: {} });
      const udid = '30A234FD-2372-4757-A76B-E375C8C43A54';
      const dest = '/tmp/' + 'video.mp4'
      exec.spawnAndLog.mockReturnValueOnce(childProcessPromise);

      const result = uut.recordVideo(udid, dest);

      expect(exec.spawnAndLog.mock.calls).toMatchSnapshot();
      expect(result).toEqual(childProcessPromise);
    });
  });
});

