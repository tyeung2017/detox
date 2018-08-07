const _ = require('lodash');
const util = require('util');
const exec = require('../../utils/exec');
const log = require('../../utils/logger').child({ __filename });
const DetoxRuntimeError = require('../../errors/DetoxRuntimeError');
const environment = require('../../utils/environment');
const { composeArgs } = require('../../utils/argparse');

class AppleSimUtils {
  async setPermissions(udid, bundleId, permissionsObj) {
    const statusLogs = {
      trying: `Trying to set permissions...`,
      successful: 'Permissions are set'
    };
    let permissions = [];
    _.forEach(permissionsObj, function (shouldAllow, permission) {
      permissions.push(permission + '=' + shouldAllow);
    });
    await this._execAppleSimUtils({
      args: `--simulator ${udid} --bundle ${bundleId} --setPermissions ${_.join(permissions, ',')}`
    }, statusLogs, 1);
  }

  async getDevicesWithProperties(deviceProperties) {
    const query = _.omitBy(
      typeof deviceProperties === 'string'
        ? this._parseStringQuery(deviceProperties)
        : {
          byId: _.get(deviceProperties, 'id'),
          byName: _.get(deviceProperties, 'name'),
          byType: _.get(deviceProperties, ['deviceType', 'name']),
          byOS: _.get(deviceProperties, ['os', 'version']),
        },
      _.isUndefined
    );

    log.debug({ event: 'SEARCH_DEVICES' }, `Searching for device matching query: ${util.inspect(query)}...`);

    const responseFromAppleSimUtils = await this._execAppleSimUtils({
      args: `--list ${composeArgs(query)}`,
    }, undefined, 1);

    const foundDevices = this._parseResponseFromAppleSimUtils(responseFromAppleSimUtils);
    if (_.isEmpty(foundDevices)) {
      throw new DetoxRuntimeError({
        message: `Can't find a simulator to match query: ${util.inspect(query)}.\nRun 'xcrun simctl list' to list your supported devices.`,
        hint: `It is advised to only state a device type, and not to state iOS version, e.g. "iPhone 7"`,
        debugInfo: `Debug info. Ran: applesimutils ${args}\nOutput:\n${responseFromAppleSimUtils}`,
      });
    }

    return _(foundDevices).sortBy(this._getDeviceVersion).reverse().value();
  }

  _getDeviceVersion(properties) {
    return +_.get(properties, ['os', 'version'], '0.0');
  }

  _parseStringQuery(query) {
    const [byType, byOS] = query.split(',').map(s => s.trim());

    return {
      byType,
      byOS,
    };
  }

  /***
   * Boots the simulator if it is not booted already.
   *
   * @param {String} udid - device id
   * @returns {Promise<boolean>} true, if device has been booted up from the shutdown state
   */
  async boot(udid) {
    const isBooted = await this.isBooted(udid);

    if (!isBooted) {
      await this._bootDeviceByXcodeVersion(udid);
      return true;
    }

    return false;
  }

  async isBooted(udid) {
    const [device] = await this.getDevicesWithProperties({ id: udid });
    return device.state === 'Booted' || device.state === 'Booting';
  }

  async _deviceTypeAndNewestRuntimeFor(name) {
    const result = await this._execSimctl({ cmd: `list -j` });
    const stdout = _.get(result, 'stdout');
    const output = JSON.parse(stdout);
    const deviceType = _.filter(output.devicetypes, { 'name': name})[0];
    const newestRuntime = _.maxBy(output.runtimes, r => Number(r.version));
    return { deviceType, newestRuntime };
  }

  async createDeviceWithProperties({ name, deviceType, runtime }) {
    const deviceInfo = await this._deviceTypeAndNewestRuntimeFor(name);

    if (deviceInfo.newestRuntime) {
      const result = await this._execSimctl({cmd: `create "${name}" "${deviceType.identifier}" "${runtime.identifier}"`});
      const udid = _.get(result, 'stdout').trim();

      return udid;
    } else {
      throw new Error(`Unable to create device. No runtime found for ${name}`);
    }
  }

  async install(udid, absPath) {
    const statusLogs = {
      trying: `Installing ${absPath}...`,
      successful: `${absPath} installed`
    };
    await this._execSimctl({ cmd: `install ${udid} "${absPath}"`, statusLogs });
  }

  async uninstall(udid, bundleId) {
    const statusLogs = {
      trying: `Uninstalling ${bundleId}...`,
      successful: `${bundleId} uninstalled`
    };
    try {
      await this._execSimctl({ cmd: `uninstall ${udid} ${bundleId}`, statusLogs });
    } catch (e) {
      // that's fine
    }
  }

  async launch(udid, bundleId, launchArgs) {
    const frameworkPath = await environment.getFrameworkPath();
    const logsInfo = new LogsInfo(udid);
    const args = this._joinLaunchArgs(launchArgs);

    const result = await this._launchMagically(frameworkPath, logsInfo, udid, bundleId, args);
    return this._parseLaunchId(result);
  }

  async sendToHome(udid) {
    await this._execSimctl({ cmd: `launch ${udid} com.apple.springboard`, retries: 10 });
  }

  getLogsPaths(udid) {
    const logsInfo = new LogsInfo(udid);
    return {
      stdout: logsInfo.absStdout,
      stderr: logsInfo.absStderr
    }
  }

  async terminate(udid, bundleId) {
    const statusLogs = {
      trying: `Terminating ${bundleId}...`,
      successful: `${bundleId} terminated`
    };
    await this._execSimctl({ cmd: `terminate ${udid} ${bundleId}`, statusLogs });
  }

  async shutdown(udid) {
    const statusLogs = {
      trying: `Shutting down ${udid}...`,
      successful: `${udid} shut down`
    };
    await this._execSimctl({ cmd: `shutdown ${udid}`, statusLogs });
  }

  async openUrl(udid, url) {
    await this._execSimctl({ cmd: `openurl ${udid} ${url}` });
  }

  async setLocation(udid, lat, lon) {
    const result = await exec.execWithRetriesAndLogs(`which fbsimctl`, undefined, undefined, 1);
    if (_.get(result, 'stdout')) {
      await exec.execWithRetriesAndLogs(`fbsimctl ${udid} set_location ${lat} ${lon}`, undefined, undefined, 1);
    } else {
      throw new Error(`setLocation currently supported only through fbsimctl.
      Install fbsimctl using:
      "brew tap facebook/fb && export CODE_SIGNING_REQUIRED=NO && brew install fbsimctl"`);
    }
  }

  async resetContentAndSettings(udid) {
    await this._execSimctl({ cmd: `erase ${udid}` });
  }

  async getXcodeVersion() {
    const raw = await exec.execWithRetriesAndLogs(`xcodebuild -version`, undefined, undefined, 1);
    const stdout = _.get(raw, 'stdout', 'undefined');
    const match = /^Xcode (\S+)\.*\S*\s*/.exec(stdout);
    const majorVersion = parseInt(_.get(match, '[1]'));
    if (!_.isInteger(majorVersion) || majorVersion < 1) {
      throw new Error(`Can't read Xcode version, got: '${stdout}'`);
    }
    return majorVersion;
  }

  async takeScreenshot(udid, destination) {
    await this._execSimctl({
      cmd: `io ${udid} screenshot "${destination}"`,
      silent: destination === '/dev/null',
    });
  }

  recordVideo(udid, destination) {
    return exec.spawnAndLog('/usr/bin/xcrun', ['simctl', 'io', udid, 'recordVideo', destination]);
  }

  async _execAppleSimUtils(options, statusLogs, retries, interval) {
    const bin = `applesimutils`;
    return await exec.execWithRetriesAndLogs(bin, options, statusLogs, retries, interval);
  }

  async _execSimctl({ cmd, statusLogs = {}, retries = 1, silent = false }) {
    return await exec.execWithRetriesAndLogs(`/usr/bin/xcrun simctl ${cmd}`, { silent }, statusLogs, retries);
  }

  _parseResponseFromAppleSimUtils(response) {
    let out = _.get(response, 'stdout');
    if (_.isEmpty(out)) {
      out = _.get(response, 'stderr');
    }
    if (_.isEmpty(out)) {
      return undefined;
    }

    let parsed;
    try {
      parsed = JSON.parse(out);

    } catch (ex) {
      throw new Error(`Could not parse response from applesimutils, please update applesimutils and try again.
      'brew uninstall applesimutils && brew tap wix/brew && brew install applesimutils'`);
    }
    return parsed;
  }

  async _bootDeviceByXcodeVersion(udid) {
    const xcodeVersion = await this.getXcodeVersion();
    if (xcodeVersion >= 9) {
      const statusLogs = { trying: `Booting device ${udid}` };
      await this._execSimctl({ cmd: `boot ${udid}`, statusLogs, retries: 10 });
    } else {
      await this._bootDeviceMagically(udid);
    }
    await this._execSimctl({ cmd: `bootstatus ${udid}`, retries: 1 });
  }

  async _bootDeviceMagically(udid) {
    const cmd = "/bin/bash -c '`xcode-select -p`/Applications/Simulator.app/Contents/MacOS/Simulator " +
      `--args -CurrentDeviceUDID ${udid} -ConnectHardwareKeyboard 0 ` +
      "-DeviceSetPath $HOME/Library/Developer/CoreSimulator/Devices > /dev/null 2>&1 < /dev/null &'";
    await exec.execWithRetriesAndLogs(cmd, undefined, { trying: `Launching device ${udid}...` }, 1);
  }

  _joinLaunchArgs(launchArgs) {
    return _.map(launchArgs, (v, k) => `${k} ${v}`).join(' ').trim();
  }

  async _launchMagically(frameworkPath, logsInfo, udid, bundleId, args) {
    const statusLogs = {
      trying: `Launching ${bundleId}...`,
      successful: `${bundleId} launched. The stdout and stderr logs were recreated, you can watch them with:\n` +
      `        tail -F ${logsInfo.absJoined}`
    };

    const launchBin = `/bin/cat /dev/null >${logsInfo.absStdout} 2>${logsInfo.absStderr} && ` +
      `SIMCTL_CHILD_DYLD_INSERT_LIBRARIES="${frameworkPath}/Detox" ` +
      `/usr/bin/xcrun simctl launch --stdout=${logsInfo.simStdout} --stderr=${logsInfo.simStderr} ` +
      `${udid} ${bundleId} --args ${args}`;

    return await exec.execWithRetriesAndLogs(launchBin, undefined, statusLogs, 1);
  }

  _parseLaunchId(result) {
    return parseInt(_.get(result, 'stdout', ':').trim().split(':')[1]);
  }
}

class LogsInfo {
  constructor(udid) {
    const logPrefix = '/tmp/detox.last_launch_app_log.';
    this.simStdout = logPrefix + 'out';
    this.simStderr = logPrefix + 'err';

    const HOME = environment.getHomeDir();
    const simDataRoot = `${HOME}/Library/Developer/CoreSimulator/Devices/${udid}/data`;
    this.absStdout = simDataRoot + this.simStdout;
    this.absStderr = simDataRoot + this.simStderr;
    this.absJoined = `${simDataRoot}${logPrefix}{out,err}`
  }
}

module.exports = AppleSimUtils;