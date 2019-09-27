/**
 * Parse action input into a some proper thing.
 */

import {input} from '@actions-rs/core';

import stringArgv from 'string-argv';

// Parsed action input
export interface Input {
    token: string,
    toolchain?: string,
    args: string[],
    useCross: boolean,
}

export function get(): Input {
    const args = stringArgv(input.getInput('args'));
    let toolchain = input.getInput('toolchain');
    if (toolchain.startsWith('+')) {
        toolchain = toolchain.slice(1);
    }
    const useCross = input.getInputBool('use-cross');

    return {
        token: input.getInput('token', {required: true}),
        args: args,
        useCross: useCross,
        toolchain: toolchain || undefined
    }
}
