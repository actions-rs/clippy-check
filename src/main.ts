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
            stdout: (buffer: Buffer) => rustcVersion = buffer.toString().trim(),
        }
    })
    await program.call(['-V'], {
        silent: true,
        listeners: {
            stdout: (buffer: Buffer) => cargoVersion = buffer.toString().trim(),
        }
    });
    await program.call(['clippy', '-V'], {
        silent: true,
        listeners: {
            stdout: (buffer: Buffer) => clippyVersion = buffer.toString().trim(),
        }
    });

    // `--message-format=json` should just right after the `cargo clippy`
    // because usually people are adding the `-- -D warnings` at the end
    // of arguments and it will mess up the output.
    let args: string[] = ['clippy', '--message-format=json'];
    if (actionInput.toolchain) {
        args.push(`+${actionInput.toolchain}`);
    }
    args = args.concat(actionInput.args);

    let runner = new CheckRunner();
    let clippyExitCode: number = 0;
    try {
        core.startGroup('Executing cargo clippy (JSON output)');
        clippyExitCode = await program.call(args, {
            ignoreReturnCode: true,
            failOnStdErr: false,
            listeners: {
                stdline: (line: string) => {
                    runner.tryPush(line);
                }
            }
        });
    } finally {
        core.endGroup();
    }

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

    if (clippyExitCode !== 0) {
        throw new Error(`Clippy had exited with the ${clippyExitCode} exit code`);
    }
}

async function main(): Promise<void> {
    try {
        const actionInput = input.get();

        await run(actionInput);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
