import * as Handlebars from 'handlebars';

export function resolvePrompt(template: string, context: any): string {
    if (!template) return '';
    try {
        // "noEscape: true" is usually good for prompts to avoid HTML entity encoding
        const render = Handlebars.compile(template, { noEscape: true });
        return render(context);
    } catch (e: any) {
        throw new Error(`Template resolution failed: ${e.message}`);
    }
}
