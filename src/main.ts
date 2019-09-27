import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

import {Cargo, Cross} from '@actions-rs/core';
import * as input from './input';
import {CheckRunner} from './check';

export async function run(actionInput: input.Input): Promise<void> {
    const startedAt = new Date().toISOString();

    let program;
    if (actionInput.useCross) {
        program = await Cross.getOrInstall();
    } else {
        program = await Cargo.get();
    }

    // TODO: Simplify this block
    let rustcVersion = '';
    let cargoVersion = '';
    let clippyVersion = '';
    await exec.exec('rustc', ['-V'], {
        silent: true,
        listeners: {
            stdout: (buffer) => rustcVersion = buffer.toString().trim(),
        }
    })
    await program.call(['-V'], {
        silent: true,
        listeners: {
            stdout: (buffer) => cargoVersion = buffer.toString().trim(),
        }
    });
    await program.call(['clippy', '-V'], {
        silent: true,
        listeners: {
            stdout: (buffer) => clippyVersion = buffer.toString().trim(),
        }
    });

    let args: string[] = ['clippy'];
    if (actionInput.toolchain) {
        args.push(`+${actionInput.toolchain}`);
    }
    args = args.concat(actionInput.args);
    args.push('--message-format=json');

    let runner = new CheckRunner();
    await program.call(args, {
        silent: true,
        ignoreReturnCode: true,
        failOnStdErr: false,
        listeners: {
            stdline: (line) => {
                runner.tryPush(line);
            }
        }
    });

    await runner.executeCheck({
        token: actionInput.token,
        name: 'clippy',
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head_sha: github.context.sha,
        started_at: startedAt,
        context: {
            rustc: rustcVersion,
            cargo: cargoVersion,
            clippy: clippyVersion,
        }
    });
}

async function main(): Promise<void> {
    const actionInput = input.get();

    try {
        await run(actionInput);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
