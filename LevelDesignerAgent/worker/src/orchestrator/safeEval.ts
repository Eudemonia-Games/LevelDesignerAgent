
export function safeEval(expression: string, context: any): boolean {
    // Simple expression evaluator. 
    // Supports: 
    // - property access: context.foo.bar
    // - comparisons: ==, !=, >, <, >=, <=
    // - logic: &&, || (limited support)
    // - literal values: numbers, strings (quoted), booleans
    // Does NOT support arbitrary code execution (eval/new Function).

    // For Phase 8, we can implement a basic parser or use a small library.
    // Let's implement a very simple regex-based parser for "key op value"
    // e.g. "context.score > 0.5"

    try {
        const trimmed = expression.trim();

        // 1. Resolve simplified "variable operator value"
        // Regex to capture: (variable.path) (operator) (value)
        // Values can be strings "foo", numbers 123, booleans true/false.
        const match = trimmed.match(/^([a-zA-Z0-9_.]+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);

        if (!match) {
            // Check for simple boolean variable
            const val = resolveValue(trimmed, context);
            return !!val;
        }

        const [, path, op, rawValue] = match;
        const left = resolveValue(path, context);
        const right = parsePrimitive(rawValue);

        switch (op) {
            case '==': return left == right;
            case '!=': return left != right;
            case '>': return Number(left) > Number(right);
            case '<': return Number(left) < Number(right);
            case '>=': return Number(left) >= Number(right);
            case '<=': return Number(left) <= Number(right);
            default: return false;
        }

    } catch (e) {
        console.warn(`safeEval failed for "${expression}":`, e);
        return false;
    }
}

function resolveValue(path: string, context: any): any {
    if (path === 'true') return true;
    if (path === 'false') return false;

    // Remove 'context.' prefix if present, as our root context IS the context object (or run object?)
    // Actually, usually we pass { context: run.context, ... }
    // Let's assume path is relative to the passed root object.

    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
}

function parsePrimitive(val: string): any {
    val = val.trim();
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    if (val === 'undefined') return undefined;

    // Number
    if (!isNaN(Number(val))) return Number(val);

    // String (strip quotes)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        return val.slice(1, -1);
    }

    return val;
}
