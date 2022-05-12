import { input } from "@actions-rs/core";
import stringArgv from "string-argv";

// Parsed action input
export interface Input {
    toolchain?: string;
    args: string[];
    useCross: boolean;
}

export function get(): Input {
    let toolchain = input.getInput("toolchain");

    if (toolchain.startsWith("+")) {
        toolchain = toolchain.slice(1);
    }

    return {
        args: stringArgv(input.getInput("args")),
        useCross: input.getInputBool("use-cross"),
        toolchain: toolchain || undefined,
    };
}
