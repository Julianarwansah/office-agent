import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

type DateOp = 'now' | 'format' | 'add' | 'diff';
type DateUnit = 'seconds' | 'minutes' | 'hours' | 'days';

function manifest() {
  return {
    name: 'datetime',
    displayName: 'Date & Time',
    description: 'Get current date/time in various formats, or perform date arithmetic.',
    category: 'productivity',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'operation',
        type: 'string' as const,
        description: 'Operation to perform',
        required: true,
        enum: ['now', 'format', 'add', 'diff'],
      },
      {
        name: 'format',
        type: 'string' as const,
        description:
          'Output format string (default ISO). For format op, can use these tokens: YYYY MM DD HH mm ss SSS',
        required: false,
        default: 'iso',
      },
      {
        name: 'date',
        type: 'string' as const,
        description: 'ISO date string. Defaults to now.',
        required: false,
      },
      {
        name: 'amount',
        type: 'number' as const,
        description: 'Numeric amount for add (positive or negative)',
        required: false,
      },
      {
        name: 'unit',
        type: 'string' as const,
        description: 'Unit for add',
        required: false,
        enum: ['seconds', 'minutes', 'hours', 'days'],
      },
      {
        name: 'date2',
        type: 'string' as const,
        description: 'Second date for diff operation (ISO string)',
        required: false,
      },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      { title: 'Current time', input: { operation: 'now' } },
    ],
  };
}

interface DateTimeArgs {
  operation: DateOp;
  format?: string;
  date?: string;
  amount?: number;
  unit?: DateUnit;
  date2?: string;
}

const UNIT_MS: Record<DateUnit, number> = {
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date, fmt: string): string {
  if (fmt === 'iso') return d.toISOString();
  if (fmt === 'unix') return String(Math.floor(d.getTime() / 1000));
  if (fmt === 'rfc') return d.toUTCString();
  if (fmt === 'locale') return d.toLocaleString();

  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return fmt
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/YY/g, String(d.getFullYear()).slice(-2))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()))
    .replace(/SSS/g, pad(d.getMilliseconds(), 3));
}

export const dateTimeSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'datetime',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['now', 'format', 'add', 'diff'] },
            format: { type: 'string', description: 'Output format string or preset (iso|unix|rfc|locale)' },
            date: { type: 'string', description: 'ISO date string' },
            amount: { type: 'number' },
            unit: { type: 'string', enum: ['seconds', 'minutes', 'hours', 'days'] },
            date2: { type: 'string', description: 'Second ISO date for diff' },
          },
          required: ['operation'],
        },
      },
    };
  },
  async execute(rawArgs): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as DateTimeArgs;
    const op = args.operation;
    const valid: DateOp[] = ['now', 'format', 'add', 'diff'];
    if (!valid.includes(op)) {
      return { success: false, output: '', error: `Invalid operation "${op}"` };
    }

    try {
      switch (op) {
        case 'now': {
          const now = new Date();
          const fmt = args.format ?? 'iso';
          const out = formatDate(now, fmt);
          return {
            success: true,
            output: out,
            data: { iso: now.toISOString(), epoch: now.getTime(), tz: now.getTimezoneOffset() },
          };
        }
        case 'format': {
          const d = parseDate(args.date) ?? new Date();
          if (!parseDate(args.date) && args.date) {
            return { success: false, output: '', error: `Invalid date: ${args.date}` };
          }
          const fmt = args.format ?? 'iso';
          const out = formatDate(d, fmt);
          return {
            success: true,
            output: out,
            data: { iso: d.toISOString(), epoch: d.getTime() },
          };
        }
        case 'add': {
          const d = parseDate(args.date) ?? new Date();
          if (!parseDate(args.date) && args.date) {
            return { success: false, output: '', error: `Invalid date: ${args.date}` };
          }
          if (typeof args.amount !== 'number') {
            return { success: false, output: '', error: 'Parameter "amount" is required for add.' };
          }
          const unit: DateUnit = args.unit ?? 'days';
          const result = new Date(d.getTime() + args.amount * UNIT_MS[unit]);
          const fmt = args.format ?? 'iso';
          return {
            success: true,
            output: formatDate(result, fmt),
            data: { iso: result.toISOString(), epoch: result.getTime(), amount: args.amount, unit },
          };
        }
        case 'diff': {
          const d1 = parseDate(args.date) ?? new Date();
          const d2 = parseDate(args.date2);
          if (!d2) {
            return { success: false, output: '', error: 'Parameter "date2" is required for diff and must be a valid ISO date.' };
          }
          const ms = d1.getTime() - d2.getTime();
          return {
            success: true,
            output: JSON.stringify({
              ms,
              seconds: ms / 1000,
              minutes: ms / 60_000,
              hours: ms / 3_600_000,
              days: ms / 86_400_000,
            }, null, 2),
            data: { ms, date1: d1.toISOString(), date2: d2.toISOString() },
          };
        }
        default:
          return { success: false, output: '', error: `Unhandled operation: ${op}` };
      }
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `datetime skill failed: ${(e as Error).message}`,
      };
    }
  },
};

export default dateTimeSkill;
