import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

import { Cargo, Cross } from '@actions-rs/core';
import * as input from './input';
import { OutputParser as OutputParser } from './outputParser';
import { Reporter } from './reporter';
import { info } from 'console';

export async function run(actionInput: input.Input): Promise<void> {
    const startedAt = new Date().toISOString();

    let program: Cargo | Cross;
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

    let args: string[] = [];
    // Toolchain selection MUST go first in any condition
    if (actionInput.toolchain) {
        args.push(`+${actionInput.toolchain}`);
    }
    args.push('clippy');
    // `--message-format=json` should just right after the `cargo clippy`
    // because usually people are adding the `-- -D warnings` at the end
    // of arguments and it will mess up the output.
    args.push('--message-format=json');

    args = args.concat(actionInput.args);

    let outputParser = new OutputParser();

    let clippyExitCode: number = 0;

    try {
        core.startGroup('Executing cargo clippy (JSON output)');
        clippyExitCode = await program.call(args, {
            ignoreReturnCode: true,
            failOnStdErr: false,
            listeners: {
                stdline: (line: string) => {
                    outputParser.tryParseClippyLine(line);
                }
            }
        });
    } finally {
        core.endGroup();
    }

    let sha = github.context.sha;
    if (github.context.payload.pull_request?.head?.sha) {
        sha = github.context.payload.pull_request.head.sha;
    }

    info(`${startedAt}, ${rustcVersion}, ${cargoVersion}, ${clippyVersion}, ${sha}`);

    await (new Reporter()).report(outputParser.stats, outputParser.annotations);

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
