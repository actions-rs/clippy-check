import * as exec from "@actions/exec";
import { Cargo, Cross } from "@actions-rs/core";
import { OutputParser as OutputParser } from "./outputParser";
import { Reporter } from "./reporter";
import { AnnotationWithMessageAndLevel, Context, Stats } from "./schema";
import * as input from "./input";
import * as core from "@actions/core";

type Program = Cross | Cargo;
type ClippyResult = {
    stats: Stats;
    annotations: AnnotationWithMessageAndLevel[];
    exitCode: number;
};

async function buildContext(program: Program): Promise<Context> {
    let context: Context = {
        cargo: "",
        clippy: "",
        rustc: "",
    };

    await Promise.all([
        await exec.exec("rustc", ["-V"], {
            silent: true,
            listeners: {
                stdout: (buffer: Buffer) =>
                    (context.rustc = buffer.toString().trim()),
            },
        }),
        await program.call(["-V"], {
            silent: true,
            listeners: {
                stdout: (buffer: Buffer) =>
                    (context.cargo = buffer.toString().trim()),
            },
        }),
        await program.call(["clippy", "-V"], {
            silent: true,
            listeners: {
                stdout: (buffer: Buffer) =>
                    (context.clippy = buffer.toString().trim()),
            },
        }),
    ]);

    return context;
}

async function runClippy(
    actionInput: input.Input,
    program: Program
): Promise<ClippyResult> {
    let args: string[] = [];

    // Toolchain selection MUST go first in any condition
    if (actionInput.toolchain) {
        args.push(`+${actionInput.toolchain}`);
    }

    args.push("clippy");

    // `--message-format=json` should just right after the `cargo clippy`
    // because usually people are adding the `-- -D warnings` at the end
    // of arguments and it will mess up the output.
    args.push("--message-format=json");

    args = args.concat(actionInput.args);

    let outputParser = new OutputParser();

    let exitCode: number = 0;

    try {
        core.startGroup("Executing cargo clippy (JSON output)");
        exitCode = await program.call(args, {
            ignoreReturnCode: true,
            failOnStdErr: false,
            listeners: {
                stdline: (line: string) => {
                    outputParser.tryParseClippyLine(line);
                },
            },
        });
    } finally {
        core.endGroup();
    }

    return {
        stats: outputParser.stats,
        annotations: outputParser.annotations,
        exitCode: exitCode,
    };
}

export async function run(actionInput: input.Input): Promise<void> {
    let program: Cargo | Cross;
    if (actionInput.useCross) {
        program = await Cross.getOrInstall();
    } else {
        program = await Cargo.get();
    }

    let context = await buildContext(program);

    let { stats, annotations, exitCode } = await runClippy(
        actionInput,
        program
    );

    await new Reporter().report(stats, annotations, context);

    if (exitCode !== 0) {
        throw new Error(`Clippy had exited with the ${exitCode} exit code`);
    }
}

async function main(): Promise<void> {
    try {
        const actionInput = input.get();

        await run(actionInput);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            // use the magic of string templates
            core.setFailed(`${error}`);
        }
    }
}

main();
