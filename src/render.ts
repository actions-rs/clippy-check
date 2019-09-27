export function plural(value: number, suffix: string = 's'): string {
    return value == 1 ? '' : suffix;
}
