import * as Handlebars from 'handlebars';

// Register helpers globally
Handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context, null, 2);
});

// Simple JSONPath-ish resolver (supports dot notation and array indexing: foo[0].bar)
export function resolveBindings(bindings: Record<string, string>, context: any): any {
    const result: any = {};
    for (const [key, path] of Object.entries(bindings)) {
        if (typeof path === 'string' && path.startsWith('$')) {
            // Strip leading '$' or '$.'
            const cleanPath = path.replace(/^\$\.?/, '');
            if (!cleanPath) {
                result[key] = context; // Root
                continue;
            }

            const parts = cleanPath.split('.').map(p => {
                // Handle array index like artifacts[0]
                if (p.includes('[') && p.endsWith(']')) {
                    const [prop, indexStr] = p.split('[');
                    const index = parseInt(indexStr.replace(']', ''), 10);
                    return { prop, index };
                }
                return { prop: p as string };
            });

            let current: any = context;
            for (const part of parts) {
                if (current === undefined || current === null) break;
                if (part.index !== undefined) {
                    current = current?.[part.prop]?.[part.index];
                } else {
                    current = current?.[part.prop];
                }
            }
            result[key] = current;
        } else {
            // Static value
            result[key] = path;
        }
    }
    return result;
}

export function resolvePrompt(template: string, context: any): string {
    if (!template) return '';
    try {
        const render = Handlebars.compile(template, { noEscape: true });
        return render(context);
    } catch (e: any) {
        throw new Error(`Template resolution failed: ${e.message}`);
    }
}
