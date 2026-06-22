import type { SkillParameterValue } from './types';

export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface SkillParameter {
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  default?: string | number | boolean | string[] | SkillParameterValue;
  enum?: string[];
  items?: ParameterType | SkillParameter;
  properties?: Record<string, SkillParameter>;
}

export interface SkillExample {
  title: string;
  description?: string;
  input?: SkillParameterValue;
  output?: string;
}

export interface SkillManifest {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  author?: string;
  parameters: SkillParameter[];
  requiresApproval: boolean;
  dangerous: boolean;
  examples?: SkillExample[];
}

export const ParameterTypeEnum = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
} as const satisfies Record<string, ParameterType>;
