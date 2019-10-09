import * as core from '@actions/core';
import * as github from '@actions/github';
import * as octokit from "@octokit/rest";

const pkg = require('../package.json');
import {plural} from './render';

const USER_AGENT = `${pkg.name}/${pkg.version} (${pkg.bugs.url})`;

interface CargoMessage {
    reason: string,
    message: {
        code: string,
        level: string,
        message: string,
        rendered: string,
        spans: DiagnosticSpan[],
    },
}

interface DiagnosticSpan {
    file_name: string,
    is_primary: boolean,
    line_start: number,
    line_end: number,
    column_start: number,
    column_end: number,
}

interface CheckOptions {
    token: string,
    owner: string,
    repo: string,
    name: string,
    head_sha: string,
    started_at: string, // ISO8601
    context: {
        rustc: string,
        cargo: string,
        clippy: string,
    }
}

interface Stats {
    ice: number,
    error: number,
    warning: number,
    note: number,
    help: number,
}

export class CheckRunner {
    private annotations: Array<octokit.ChecksCreateParamsOutputAnnotations>;
    private stats: Stats;

    constructor() {
        this.annotations = [];
        this.stats = {
            ice: 0,
            error: 0,
            warning: 0,
            note: 0,
            help: 0,
        }
    }

    public tryPush(line: string): void {
        let contents: CargoMessage;
        try {
            contents = JSON.parse(line);
        } catch (error) {
            core.debug('Not a JSON, ignoring it')
            return;
        }

        if (contents.reason != 'compiler-message') {
            core.debug(`Unexpected reason field, ignoring it: ${contents.reason}`)
            return;
        }

        if (contents.message.code === null) {
            core.debug('Message code is missing, ignoring it');
            return;
        }

        switch (contents.message.level) {
            case 'help':
                this.stats.help += 1;
                break;
            case 'note':
                this.stats.note += 1;
                break;
            case 'warning':
                this.stats.warning += 1;
                break;
            case 'error':
                this.stats.error += 1;
                break;
            case 'error: internal compiler error':
                this.stats.ice += 1;
                break;
            default:
                break;
        }

        this.annotations.push(CheckRunner.makeAnnotation(contents));
    }

    public async executeCheck(options: CheckOptions): Promise<void> {
        core.info(`Clippy results: \
${this.stats.ice} ICE, ${this.stats.error} errors, \
${this.stats.warning} warnings, ${this.stats.note} notes, \
${this.stats.help} help`);

        // TODO: Retries
        // TODO: Throttling
        const client = new github.GitHub(options.token, {
            userAgent: USER_AGENT,
        });
        let checkRunId: number;
        try {
            checkRunId = await this.createCheck(client, options);
        } catch (error) {

            // `GITHUB_HEAD_REF` is set only for forked repos,
            // so we could check if it is a fork and not a base repo.
            if (process.env.GITHUB_HEAD_REF) {
                core.error(`Unable to create clippy annotations! Reason: ${error}`);
                core.warning("It seems that this Action is executed from the forked repository.");
                core.warning(`GitHub Actions are not allowed to create Check annotations, \
when executed for a forked repos. \
See https://github.com/actions-rs/clippy-check/issues/2 for details.`);
                core.info('Posting clippy checks here instead.');

                this.dumpToStdout();

                // So, if there were any errors, we are considering this output
                // as failed, throwing an error will set a non-zero exit code later
                if (this.getConclusion() == 'failure') {
                    throw new Error('Exiting due to clippy errors');
                } else {
                    // Otherwise if there were no errors (and we do not care about warnings),
                    // exiting successfully.
                    return;
                }
            } else {
                throw error;
            }
        }

        try {
            if (this.isSuccessCheck()) {
                await this.successCheck(client, checkRunId, options);
            } else {
                await this.runUpdateCheck(client, checkRunId, options);
            }
        } catch (error) {
            await this.cancelCheck(client, checkRunId, options);
            throw error;
        }
    }

    private async createCheck(client: github.GitHub, options: CheckOptions): Promise<number> {
        const response = await client.checks.create({
            owner: options.owner,
            repo: options.repo,
            name: options.name,
            head_sha: options.head_sha,
            status: 'in_progress',
        });
        // TODO: Check for errors

        return response.data.id;
    }

    private async runUpdateCheck(client: github.GitHub, checkRunId: number, options: CheckOptions): Promise<void> {
        // Checks API allows only up to 50 annotations per request,
        // should group them into buckets
        let annotations = this.getBucket();
        while (annotations.length > 0) {
            // Request data is mostly the same for create/update calls
            let req: any = {
                owner: options.owner,
                repo: options.repo,
                name: options.name,
                check_run_id: checkRunId,
                output: {
                    title: options.name,
                    summary: this.getSummary(),
                    text: this.getText(options.context),
                    annotations: annotations,
                }
            };

            if (this.annotations.length > 0) {
                // There will be more annotations later
                core.debug('This is not the last iteration, marking check as "in_progress"');
                req.status = 'in_progress';
            } else {
                // Okay, that was a last one bucket
                const conclusion = this.getConclusion();
                core.debug(`This is a last iteration, marking check as "completed", conclusion: ${conclusion}`);
                req.status = 'completed';
                req.conclusion = conclusion;
                req.completed_at = new Date().toISOString();
            }

            // TODO: Check for errors
            await client.checks.update(req);

            annotations = this.getBucket();
        }

        return;
    }

    private async successCheck(client: github.GitHub, checkRunId: number, options: CheckOptions): Promise<void> {
        let req: any = {
            owner: options.owner,
            repo: options.repo,
            name: options.name,
            check_run_id: checkRunId,
            status: 'completed',
            conclusion: this.getConclusion(),
            completed_at: new Date().toISOString(),
            output: {
                title: options.name,
                summary: this.getSummary(),
                text: this.getText(options.context),
            }
        };

        // TODO: Check for errors
        await client.checks.update(req);

        return;
    }

    /// Cancel whole check if some unhandled exception happened.
    private async cancelCheck(client: github.GitHub, checkRunId: number, options: CheckOptions): Promise<void> {
        let req: any = {
            owner: options.owner,
            repo: options.repo,
            name: options.name,
            check_run_id: checkRunId,
            status: 'completed',
            conclusion: 'cancelled',
            completed_at: new Date().toISOString(),
            output: {
                title: options.name,
                summary: 'Unhandled error',
                text: 'Check was cancelled due to unhandled error. Check the Action logs for details.',
            }
        };

        // TODO: Check for errors
        await client.checks.update(req);

        return;
    }

    private dumpToStdout() {
        for (const annotation of this.annotations) {
            core.info(annotation.message);
        }
    }

    private getBucket(): Array<octokit.ChecksCreateParamsOutputAnnotations> {
        // TODO: Use slice or smth?
        let annotations: Array<octokit.ChecksCreateParamsOutputAnnotations> = [];
        while (annotations.length < 50) {
            const annotation = this.annotations.pop();
            if (annotation) {
                annotations.push(annotation);
            } else {
                break;
            }
        }

        core.debug(`Prepared next annotations bucket, ${annotations.length} size`);

        return annotations;
    }

    private getSummary(): string {
        let blocks: string[] = [];

        if (this.stats.ice > 0) {
            blocks.push(`${this.stats.ice} internal compiler error${plural(this.stats.ice)}`);
        }
        if (this.stats.error > 0) {
            blocks.push(`${this.stats.error} error${plural(this.stats.error)}`);
        }
        if (this.stats.warning > 0) {
            blocks.push(`${this.stats.warning} warning${plural(this.stats.warning)}`);
        }
        if (this.stats.note > 0) {
            blocks.push(`${this.stats.note} note${plural(this.stats.note)}`);
        }
        if (this.stats.help > 0) {
            blocks.push(`${this.stats.help} help message${plural(this.stats.help)}`);
        }

        return blocks.join(', ');
    }

    private getText(context: CheckOptions["context"]): string {
        return `## Results

| Message level           | Amount                |
| ----------------------- | --------------------- |
| Internal compiler error | ${this.stats.ice}     |
| Error                   | ${this.stats.error}   |
| Warning                 | ${this.stats.warning} |
| Note                    | ${this.stats.note}    |
| Help                    | ${this.stats.help}    |

## Versions

* ${context.rustc}
* ${context.cargo}
* ${context.clippy}
`;
    }

    private getConclusion(): string {
        if (this.stats.ice > 0 || this.stats.error > 0) {
            return 'failure';
        } else {
            return 'success';
        }
    }

    private isSuccessCheck(): boolean {
        return this.stats.ice == 0 && this.stats.error == 0 && this.stats.warning == 0 &&
            this.stats.note == 0 && this.stats.help == 0;
    }

    /// Convert parsed JSON line into the GH annotation object
    ///
    /// https://developer.github.com/v3/checks/runs/#annotations-object
    static makeAnnotation(contents: CargoMessage): octokit.ChecksCreateParamsOutputAnnotations {
        const primarySpan: undefined | DiagnosticSpan = contents.message.spans.find((span) => span.is_primary == true);
        // TODO: Handle it properly
        if (null == primarySpan) {
            throw new Error('Unable to find primary span for message');
        }

        let annotation_level: octokit.ChecksCreateParamsOutputAnnotations["annotation_level"];
        // notice, warning, or failure.
        switch (contents.message.level) {
            case 'help':
            case 'note':
                annotation_level = 'notice';
                break;
            case 'warning':
                annotation_level = 'warning';
                break;
            default:
                annotation_level = 'failure';
                break;
        }

        let annotation: octokit.ChecksCreateParamsOutputAnnotations = {
            path: primarySpan.file_name,
            start_line: primarySpan.line_start,
            end_line: primarySpan.line_end,
            annotation_level: annotation_level,
            title: contents.message.message,
            message: contents.message.rendered,
        };

        // Omit these parameters if `start_line` and `end_line` have different values.
        if (primarySpan.line_start == primarySpan.line_end) {
            annotation.start_column = primarySpan.column_start;
            annotation.end_column = primarySpan.column_end;
        }

        return annotation;
    }

}
