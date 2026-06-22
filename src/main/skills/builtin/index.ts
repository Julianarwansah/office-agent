import type { SkillRegistry } from '../registry';
import { terminalSkill } from './terminal';
import { webFetchSkill } from './web-fetch';
import { webSearchSkill } from './web-search';
import { fileSystemSkill } from './file-system';
import { httpRequestSkill } from './http-request';
import { codeExecSkill } from './code-exec';
import { dateTimeSkill } from './datetime';
import { memoryOpsSkill } from './memory-ops';
import { calculatorSkill } from './calculator';
import { agentDelegateSkill } from './agent-delegate';

export const BUILTIN_SKILLS = [
  terminalSkill,
  webFetchSkill,
  webSearchSkill,
  fileSystemSkill,
  httpRequestSkill,
  codeExecSkill,
  dateTimeSkill,
  memoryOpsSkill,
  calculatorSkill,
  agentDelegateSkill,
] as const;

export function registerBuiltinSkills(registry: SkillRegistry): SkillRegistry {
  for (const skill of BUILTIN_SKILLS) {
    registry.register(skill);
  }
  return registry;
}

export {
  terminalSkill,
  webFetchSkill,
  webSearchSkill,
  fileSystemSkill,
  httpRequestSkill,
  codeExecSkill,
  dateTimeSkill,
  memoryOpsSkill,
  calculatorSkill,
  agentDelegateSkill,
};
