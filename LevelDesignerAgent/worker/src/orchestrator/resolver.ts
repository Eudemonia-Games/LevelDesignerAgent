import * as Handlebars from 'handlebars';

// Register helpers globally
Handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context, null, 2);
});

// Simple JSONPath resolver (supports dot notation and array indexing)
export function resolveBindings(bindings: Record<string, string>, context: any): any {
    const result: any = {};
    for (const [key, path] of Object.entries(bindings)) {
        if (path.startsWith('$')) {
            // Remove '$' or '$.'
            const cleanPath = path.replace(/^\$|\^\./, '').replace(/^\./, '');
            if (!cleanPath) {
                result[key] = context; // Root
                continue;
            }

            const parts = cleanPath.split('.').map(p => {
                // Handle array index like artifacts[0]
                if (p.includes('[')) {
                    // This is a naive split, assumes simple property[index]
                    const [prop, indexStr] = p.split('[');
                    const index = parseInt(indexStr.replace(']', ''));
                    return { prop, index };
                }
                return { prop: p };
            });

            let current = context;
            for (const part of parts) {
                if (current === undefined || current === null) break;
                if (part.index !== undefined) {
                    current = current[part.prop]?.[part.index];
                } else {
                    current = current[part.prop];
                }
            }
            result[key] = current;
        } else {
            // Static value or unhandled
            result[key] = path;
        }
    }
    return result;
}

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
