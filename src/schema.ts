import { AnnotationProperties } from "@actions/core";

export enum AnnotationLevel {
    Error, Warning, Notice
};

export interface AnnotationWithMessageAndLevel {
    level: AnnotationLevel,
    message: string,
    properties: AnnotationProperties,
}

export interface CargoMessage {
    reason: string,
    message: {
        code: string,
        level: string,
        message: string,
        rendered: string,
        spans: DiagnosticSpan[],
    },
}

export interface DiagnosticSpan {
    file_name: string,
    is_primary: boolean,
    line_start: number,
    line_end: number,
    column_start: number,
    column_end: number,
}

export interface Stats {
    ice: number,
    error: number,
    warning: number,
    note: number,
    help: number,
}
