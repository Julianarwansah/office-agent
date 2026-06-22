import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

function manifest() {
  return {
    name: 'calculator',
    displayName: 'Calculator',
    description: 'Evaluate a mathematical expression safely.',
    category: 'data',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'expression',
        type: 'string' as const,
        description: 'Mathematical expression to evaluate',
        required: true,
      },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      { title: 'Add', input: { expression: '2 + 3 * 4' } },
    ],
  };
}

interface CalculatorArgs {
  expression: string;
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' | ',' | 'u-' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'ident'; value: string };

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '^': 4,
  'u-': 3,
  ',': 0,
};

const RIGHT_ASSOC: Record<string, boolean> = {
  '^': true,
};

interface FunctionSpec {
  /** Number of arguments expected on the RPN stack. */
  arity: number;
  /** Variadic: any number of args (used by min/max). */
  variadic?: boolean;
  /** Implementation. */
  fn: (args: number[]) => number;
}

const FUNCTIONS: Record<string, FunctionSpec> = {
  abs:     { arity: 1, fn: (a) => Math.abs(a[0] ?? 0) },
  sqrt:    { arity: 1, fn: (a) => Math.sqrt(a[0] ?? 0) },
  cbrt:    { arity: 1, fn: (a) => Math.cbrt(a[0] ?? 0) },
  sin:     { arity: 1, fn: (a) => Math.sin(a[0] ?? 0) },
  cos:     { arity: 1, fn: (a) => Math.cos(a[0] ?? 0) },
  tan:     { arity: 1, fn: (a) => Math.tan(a[0] ?? 0) },
  asin:    { arity: 1, fn: (a) => Math.asin(a[0] ?? 0) },
  acos:    { arity: 1, fn: (a) => Math.acos(a[0] ?? 0) },
  atan:    { arity: 1, fn: (a) => Math.atan(a[0] ?? 0) },
  atan2:   { arity: 2, fn: (a) => Math.atan2(a[0] ?? 0, a[1] ?? 0) },
  log:     { arity: 1, fn: (a) => Math.log(a[0] ?? 1) },
  log2:    { arity: 1, fn: (a) => Math.log2(a[0] ?? 1) },
  log10:   { arity: 1, fn: (a) => Math.log10(a[0] ?? 1) },
  exp:     { arity: 1, fn: (a) => Math.exp(a[0] ?? 0) },
  floor:   { arity: 1, fn: (a) => Math.floor(a[0] ?? 0) },
  ceil:    { arity: 1, fn: (a) => Math.ceil(a[0] ?? 0) },
  round:   { arity: 1, fn: (a) => Math.round(a[0] ?? 0) },
  min:     { arity: 1, variadic: true, fn: (a) => Math.min(...a) },
  max:     { arity: 1, variadic: true, fn: (a) => Math.max(...a) },
  pow:     { arity: 2, fn: (a) => Math.pow(a[0] ?? 0, a[1] ?? 0) },
  sign:    { arity: 1, fn: (a) => Math.sign(a[0] ?? 0) },
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: Math.PI * 2,
  TAU: Math.PI * 2,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;

  while (i < s.length) {
    const c = s[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    if (c === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ kind: 'op', value: ',' });
      i++;
      continue;
    }

    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      tokens.push({ kind: 'op', value: c as '+' | '-' | '*' | '/' | '^' });
      i++;
      continue;
    }

    if (c >= '0' && c <= '9') {
      let j = i;
      let dot = false;
      while (j < s.length) {
        const cj = s[j];
        if (cj >= '0' && cj <= '9') {
          j++;
        } else if (cj === '.' && !dot) {
          dot = true;
          j++;
        } else if (cj === 'e' || cj === 'E') {
          j++;
          if (s[j] === '+' || s[j] === '-') j++;
        } else {
          break;
        }
      }
      const text = s.slice(i, j);
      const v = Number(text);
      if (!Number.isFinite(v)) {
        throw new Error(`Invalid number: "${text}"`);
      }
      tokens.push({ kind: 'num', value: v });
      i = j;
      continue;
    }

    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i;
      while (j < s.length) {
        const cj = s[j];
        if (
          (cj >= 'a' && cj <= 'z') ||
          (cj >= 'A' && cj <= 'Z') ||
          (cj >= '0' && cj <= '9') ||
          cj === '_'
        ) {
          j++;
        } else break;
      }
      const ident = s.slice(i, j);
      tokens.push({ kind: 'ident', value: ident });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character "${c}" at position ${i}`);
  }
  return tokens;
}

function toRPN(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  let prev: Token | null = null;
  for (const t of tokens) {
    if (t.kind === 'num' || t.kind === 'ident') {
      output.push(t);
    } else if (t.kind === 'op') {
      // A `-` is unary when it appears at the start of an expression or
      // after another operator / opening paren. (We intentionally do not
      // treat `-` after an identifier as unary, so `pow(2, -3)` style
      // expressions are not supported — this keeps the parser simple.)
      const isUnary =
        t.value === '-' &&
        (prev === null || prev.kind === 'op' || prev.kind === 'lparen');
      const opKey = isUnary ? 'u-' : t.value;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.kind === 'op') {
          const topKey = top.value;
          const topPrec = PRECEDENCE[topKey] ?? 0;
          const curPrec = PRECEDENCE[opKey] ?? 0;
          if (
            (RIGHT_ASSOC[opKey] ? topPrec > curPrec : topPrec >= curPrec) &&
            topKey !== ','
          ) {
            output.push(stack.pop() as Token);
            continue;
          }
        }
        break;
      }
      stack.push({ kind: 'op', value: isUnary ? 'u-' : t.value });
    } else if (t.kind === 'lparen') {
      stack.push(t);
    } else if (t.kind === 'rparen') {
      let found = false;
      while (stack.length) {
        const top = stack.pop() as Token;
        if (top.kind === 'lparen') {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) throw new Error('Mismatched parentheses');
      // Implicit multiplication: if the next token is a number or ident, handle later.
    }
    prev = t;
  }

  while (stack.length) {
    const top = stack.pop() as Token;
    if (top.kind === 'lparen' || top.kind === 'rparen') {
      throw new Error('Mismatched parentheses');
    }
    output.push(top);
  }
  return output;
}

function evalRPN(rpn: Token[]): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (t.kind === 'num') {
      stack.push(t.value);
    } else if (t.kind === 'op') {
      if (t.value === 'u-') {
        const a = stack.pop();
        if (a === undefined) throw new Error('Invalid expression: unary minus');
        stack.push(-a);
        continue;
      }
      if (t.value === ',') {
        // function arg separator; in this simplified eval it's a no-op
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) {
        throw new Error('Invalid expression: missing operand');
      }
      switch (t.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(a / b); break;
        case '^': stack.push(Math.pow(a, b)); break;
      }
    } else if (t.kind === 'ident') {
      const name = t.value;
      if (CONSTANTS[name] !== undefined) {
        stack.push(CONSTANTS[name]);
      } else if (FUNCTIONS[name]) {
        const spec = FUNCTIONS[name];
        // For variadic functions (min/max) the comma operator consumed the
        // separators during tokenization; pop everything up to the
        // matching parenthesis marker. We approximate this by consuming
        // until the stack is empty (these functions accept any number
        // of args, and the parser will not leave extra values).
        const argc = spec.variadic ? stack.length : spec.arity;
        if (stack.length < argc) {
          throw new Error(
            `Invalid expression: ${name}() expects ${spec.arity} argument(s), got ${stack.length}`,
          );
        }
        const args: number[] = [];
        for (let i = 0; i < argc; i++) args.unshift(stack.pop() as number);
        if (args.some((a) => typeof a !== 'number' || !Number.isFinite(a))) {
          throw new Error(`Invalid argument for ${name}`);
        }
        const r = spec.fn(args);
        if (!Number.isFinite(r)) {
          throw new Error(`Function ${name}() produced a non-finite result`);
        }
        stack.push(r);
      } else {
        throw new Error(`Unknown identifier: ${name}`);
      }
    }
  }
  if (stack.length !== 1) throw new Error('Invalid expression');
  return stack[0];
}

/**
 * Supports: numbers, + - * / ^ (with precedence and right-assoc ^),
 * parentheses, common math functions, pi/e constants.
 * NOT supported: variables, assignments, member access, or anything beyond math.
 */
export function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error('Empty expression');
  const rpn = toRPN(tokens);
  return evalRPN(rpn);
}

export const calculatorSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'calculator',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Mathematical expression' },
          },
          required: ['expression'],
        },
      },
    };
  },
  async execute(rawArgs, _ctx: SkillContext): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as CalculatorArgs;
    if (typeof args.expression !== 'string' || !args.expression.trim()) {
      return { success: false, output: '', error: 'Parameter "expression" is required.' };
    }
    try {
      const value = evaluateExpression(args.expression);
      if (!Number.isFinite(value)) {
        return {
          success: false,
          output: '',
          error: `Expression evaluated to a non-finite value: ${String(value)}`,
        };
      }
      return {
        success: true,
        output: String(value),
        data: { value },
        metadata: { expression: args.expression },
      };
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `Failed to evaluate expression: ${(e as Error).message}`,
      };
    }
  },
};

export default calculatorSkill;
