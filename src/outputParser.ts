import { debug } from "@actions/core";

import { AnnotationLevel, AnnotationWithMessageAndLevel, CargoMessage, DiagnosticSpan, Stats } from "./schema";

export class OutputParser {
    private _annotations: AnnotationWithMessageAndLevel[];
    private _stats: Stats;

    constructor() {
        this._annotations = [];
        this._stats = {
            ice: 0,
            error: 0,
            warning: 0,
            note: 0,
            help: 0,
        }
    }

    get stats(): Stats {
        return this._stats;
    }

    get annotations(): AnnotationWithMessageAndLevel[] {
        return this._annotations;
    }

    public tryParseClippyLine(line: string): void {
        let contents: CargoMessage;
        try {
            contents = JSON.parse(line);
        } catch (error) {
            debug('Not a JSON, ignoring it')
            return;
        }

        if (contents.reason != 'compiler-message') {
            debug(`Unexpected reason field, ignoring it: ${contents.reason}`)
            return;
        }

        if (contents.message.code === null) {
            debug('Message code is missing, ignoring it');
            return;
        }

        switch (contents.message.level) {
            case 'help':
                this._stats.help += 1;
                break;
            case 'note':
                this._stats.note += 1;
                break;
            case 'warning':
                this._stats.warning += 1;
                break;
            case 'error':
                this._stats.error += 1;
                break;
            case 'error: internal compiler error':
                this._stats.ice += 1;
                break;
            default:
                break;
        }

        this._annotations.push(OutputParser.makeAnnotation(contents));
    }

    static parseLevel(level: String): AnnotationLevel {

        switch (level) {
            case 'help':
            case 'note':
                return AnnotationLevel.Notice;
            case 'warning':
                return AnnotationLevel.Warning;
            default:
                return AnnotationLevel.Error;
        }
    }


    /// Convert parsed JSON line into the GH annotation object
    ///
    /// https://developer.github.com/v3/checks/runs/#annotations-object
    static makeAnnotation(contents: CargoMessage): AnnotationWithMessageAndLevel {
        const primarySpan: undefined | DiagnosticSpan = contents.message.spans.find((span) => span.is_primary == true);

        // TODO: Handle it properly
        if (null == primarySpan) {
            throw new Error('Unable to find primary span for message');
        }


        let annotation: AnnotationWithMessageAndLevel = {
            level: OutputParser.parseLevel(contents.message.level),
            message: contents.message.rendered,
            properties: {
                file: primarySpan.file_name,
                startLine: primarySpan.line_start,
                endLine: primarySpan.line_end,
                title: contents.message.message,

            }
        };

        // Omit these parameters if `start_line` and `end_line` have different values.
        if (primarySpan.line_start == primarySpan.line_end) {
            annotation.properties.startColumn = primarySpan.column_start;
            annotation.properties.endColumn = primarySpan.column_end;
        }

        return annotation;
    }
}
