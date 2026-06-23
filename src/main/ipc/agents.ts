/**
 * IPC handlers for agents + teams.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { Agent, AgentRole, AgentSkill, ApiResponse, Team } from '../../shared/types';
import type { AgentRepository, TeamRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';

const log = createLogger('ipc:agents');

function ok<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail<T = never>(error: string): ApiResponse<T> { return { success: false, error }; }
const AGENT_ROLES: AgentRole[] = ['lead', 'member', 'observer'];

export interface AgentHandlerDeps {
  agents: AgentRepository;
  teams: TeamRepository;
}

export function registerAgentHandlers(deps: AgentHandlerDeps): void {
  const { agents: agentRepo, teams: teamRepo } = deps;

  /* ------------------------------- Agents ------------------------------- */

  ipcMain.handle(IPC_CHANNELS.AGENT.LIST, async (): Promise<ApiResponse<Agent[]>> => {
    try { return ok(agentRepo.findAll()); }
    catch (err) { return failErr('AGENT.LIST', err); }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT.GET, async (_evt, id: string): Promise<ApiResponse<Agent | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(agentRepo.findById(id));
    } catch (err) { return failErr('AGENT.GET', err); }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT.CREATE, async (_evt, input: Partial<Agent>): Promise<ApiResponse<Agent>> => {
    try {
      const created = agentRepo.create(sanitizeAgentInput(input) as Parameters<typeof agentRepo.create>[0]);
      return ok(created);
    } catch (err) { return failErr('AGENT.CREATE', err); }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT.UPDATE, async (_evt, id: string, partial: Partial<Agent>): Promise<ApiResponse<Agent | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      const updated = agentRepo.update(id, sanitizeAgentInput(partial));
      return ok(updated);
    } catch (err) { return failErr('AGENT.UPDATE', err); }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(agentRepo.delete(id));
    } catch (err) { return failErr('AGENT.DELETE', err); }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT.SET_SKILLS, async (
    _evt,
    id: string,
    skills: AgentSkill[],
  ): Promise<ApiResponse<Agent | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      if (!Array.isArray(skills)) return fail('skills must be an array');
      agentRepo.setSkills(id, skills);
      return ok(agentRepo.findById(id));
    } catch (err) { return failErr('AGENT.SET_SKILLS', err); }
  });

  /* ------------------------------- Teams -------------------------------- */

  ipcMain.handle(IPC_CHANNELS.TEAM.LIST, async (): Promise<ApiResponse<Team[]>> => {
    try { return ok(teamRepo.findAll()); }
    catch (err) { return failErr('TEAM.LIST', err); }
  });

  ipcMain.handle(IPC_CHANNELS.TEAM.GET, async (_evt, id: string): Promise<ApiResponse<Team | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(teamRepo.findById(id));
    } catch (err) { return failErr('TEAM.GET', err); }
  });

  ipcMain.handle(IPC_CHANNELS.TEAM.CREATE, async (_evt, input: Partial<Team>): Promise<ApiResponse<Team>> => {
    try {
      const created = teamRepo.create(sanitizeTeamInput(input) as Parameters<typeof teamRepo.create>[0]);
      return ok(created);
    } catch (err) { return failErr('TEAM.CREATE', err); }
  });

  ipcMain.handle(IPC_CHANNELS.TEAM.UPDATE, async (_evt, id: string, partial: Partial<Team>): Promise<ApiResponse<Team | null>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(teamRepo.update(id, sanitizeTeamInput(partial)));
    } catch (err) { return failErr('TEAM.UPDATE', err); }
  });

  ipcMain.handle(IPC_CHANNELS.TEAM.DELETE, async (_evt, id: string): Promise<ApiResponse<boolean>> => {
    try {
      if (!id || typeof id !== 'string') return fail('id is required');
      return ok(teamRepo.delete(id));
    } catch (err) { return failErr('TEAM.DELETE', err); }
  });

  ipcMain.handle(IPC_CHANNELS.TEAM.ADD_AGENT, async (
    _evt,
    args: { teamId: string; agentId: string },
  ): Promise<ApiResponse<boolean>> => {
    try {
      if (!args?.teamId || !args?.agentId) return fail('teamId and agentId are required');
      teamRepo.addAgent(args.teamId, args.agentId);
      return ok(true);
    } catch (err) { return failErr('TEAM.ADD_AGENT', err); }
  });

  ipcMain.handle(IPC_CHANNELS.TEAM.REMOVE_AGENT, async (
    _evt,
    args: { teamId: string; agentId: string },
  ): Promise<ApiResponse<boolean>> => {
    try {
      if (!args?.teamId || !args?.agentId) return fail('teamId and agentId are required');
      teamRepo.removeAgent(args.teamId, args.agentId);
      return ok(true);
    } catch (err) { return failErr('TEAM.REMOVE_AGENT', err); }
  });
}

function sanitizeAgentInput(input: Partial<Agent> | undefined): Partial<Agent> {
  if (!input) return {};
  const out: Partial<Agent> = {};
  if (input.name !== undefined) out.name = String(input.name);
  if (input.description !== undefined) out.description = input.description ?? undefined;
  if (input.avatar !== undefined) out.avatar = input.avatar ?? undefined;
  if (input.systemPrompt !== undefined) out.systemPrompt = String(input.systemPrompt ?? '');
  if (input.providerId !== undefined) out.providerId = String(input.providerId);
  if (input.teamId !== undefined) out.teamId = input.teamId ?? undefined;
  if (input.role !== undefined) {
    out.role = AGENT_ROLES.includes(input.role as AgentRole)
      ? (input.role as AgentRole)
      : 'member';
  }
  if (input.color !== undefined) out.color = input.color ?? undefined;
  if (input.isLead !== undefined) out.isLead = Boolean(input.isLead);
  if (input.temperature !== undefined) out.temperature = numOrU(input.temperature);
  if (input.maxTokens !== undefined) out.maxTokens = numOrU(input.maxTokens);
  if (Array.isArray(input.enabledSkills)) out.enabledSkills = input.enabledSkills;
  return out;
}

function sanitizeTeamInput(input: Partial<Team> | undefined): Partial<Team> {
  if (!input) return {};
  const out: Partial<Team> = {};
  if (input.name !== undefined) out.name = String(input.name);
  if (input.description !== undefined) out.description = input.description ?? undefined;
  if (input.instructions !== undefined) out.instructions = input.instructions ?? undefined;
  if (input.color !== undefined) out.color = input.color ?? undefined;
  if (input.avatar !== undefined) out.avatar = input.avatar ?? undefined;
  return out;
}

function numOrU(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function failErr(scope: string, err: unknown): ApiResponse<never> {
  log.error(`${scope} failed`, err);
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}
