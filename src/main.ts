import fs from 'fs';
import path from 'path';
import os from 'os';
import * as context from './context';
import * as dagger from './dagger';
import * as stateHelper from './state-helper';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
  try {
		Object.keys(process.env).forEach(function (key) {
			if (key.startsWith('ACTIONS_')) {
				core.info(`${key}=${process.env[key]}`);
				core.exportVariable(key, process.env[key]);
			}
		});

    const inputs: context.Inputs = await context.getInputs();
    const daggerBin = await dagger.install(inputs.version);

    if (inputs.installOnly) {
      const daggerDir = path.dirname(daggerBin);
      core.addPath(daggerDir);
      core.debug(`Added ${daggerDir} to PATH`);
      return;
    } else if (!inputs.args && !inputs.cmds.length) {
      throw new Error(`you need to provide either 'args' or 'cmds'`);
    }

    if (inputs.workdir && inputs.workdir !== '.') {
      core.info(`Using ${inputs.workdir} as working directory`);
      process.chdir(inputs.workdir);
    }

    stateHelper.setCleanup(inputs.cleanup);

    if (inputs.args) {
      inputs.cmds.unshift(inputs.args);
    }

    for (const cmd of inputs.cmds) {
      await core.group(cmd, async () => {
        await exec.exec(`${daggerBin} ${cmd}`, undefined, {
          env: Object.assign({}, process.env, {
            DAGGER_LOG_FORMAT: 'plain'
          }) as {
            [key: string]: string;
          }
        });
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function cleanup(): Promise<void> {
  if (!stateHelper.cleanup) {
    return;
  }
  core.info(`Removing ${path.join(os.homedir(), '.config', 'dagger')}`);
  fs.rmdirSync(path.join(os.homedir(), '.config', 'dagger'), {recursive: true});
}

if (!stateHelper.IsPost) {
  run();
} else {
  cleanup();
}
