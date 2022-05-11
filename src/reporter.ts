import { info, error, notice, warning } from '@actions/core';
import { AnnotationLevel, AnnotationWithMessageAndLevel, Stats } from './schema';

export class Reporter {



    public async report(stats: Stats, annotations: AnnotationWithMessageAndLevel[]): Promise<void> {
        info(`Clippy results: \
${stats.ice} ICE, ${stats.error} errors, \
${stats.warning} warnings, ${stats.note} notes, \
${stats.help} help`);

        for (const annotation of annotations) {
            switch (annotation.level) {
                case AnnotationLevel.Error: {
                    error(annotation.message, annotation.properties);
                    break;
                }
                case AnnotationLevel.Notice: {
                    notice(annotation.message, annotation.properties);
                    break;
                }
                case AnnotationLevel.Warning: {
                    warning(annotation.message, annotation.properties);
                    break;
                }
            }

        }




        //     private getSummary(): string {
        //         let blocks: string[] = [];

        //         if (this.stats.ice > 0) {
        //             blocks.push(`${this.stats.ice} internal compiler error${plural(this.stats.ice)}`);
        //         }
        //         if (this.stats.error > 0) {
        //             blocks.push(`${this.stats.error} error${plural(this.stats.error)}`);
        //         }
        //         if (this.stats.warning > 0) {
        //             blocks.push(`${this.stats.warning} warning${plural(this.stats.warning)}`);
        //         }
        //         if (this.stats.note > 0) {
        //             blocks.push(`${this.stats.note} note${plural(this.stats.note)}`);
        //         }
        //         if (this.stats.help > 0) {
        //             blocks.push(`${this.stats.help} help message${plural(this.stats.help)}`);
        //         }

        //         return blocks.join(', ');
        //     }

        //     private getText(context: CheckOptions["context"]): string {
        //         return `## Results

        // | Message level           | Amount                |
        // | ----------------------- | --------------------- |
        // | Internal compiler error | ${this.stats.ice}     |
        // | Error                   | ${this.stats.error}   |
        // | Warning                 | ${this.stats.warning} |
        // | Note                    | ${this.stats.note}    |
        // | Help                    | ${this.stats.help}    |

        // ## Versions

        // * ${context.rustc}
        // * ${context.cargo}
        // * ${context.clippy}
        // `;
        //     }

        //     private getConclusion(): string {
        //         if (this.stats.ice > 0 || this.stats.error > 0) {
        //             return 'failure';
        //         } else {
        //             return 'success';
        //         }
        //     }

        //     private isSuccessCheck(): boolean {
        //         return this.stats.ice == 0 && this.stats.error == 0 && this.stats.warning == 0 &&
        //             this.stats.note == 0 && this.stats.help == 0;
        //     }

    }
}
