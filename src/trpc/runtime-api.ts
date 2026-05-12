// Coordinates the runtime-side TRPC handlers used by the browser.
// This is the main backend entrypoint for sessions, settings, git, and
// workspace actions.

import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { TRPCError } from "@trpc/server";
import type { RuntimeConfigState } from "../config/runtime-config";
import { updateGlobalRuntimeConfig, updateRuntimeConfig } from "../config/runtime-config";
import type {
	RuntimeCommandRunResponse,
	RuntimeRunUpdateResponse,
	RuntimeUpdateStatusResponse,
} from "../core/api-contract";
import {
	parseCommandRunRequest,
	parseRuntimeConfigSaveRequest,
	parseShellSessionStartRequest,
	parseTaskSessionInputRequest,
	parseTaskSessionStartRequest,
	parseTaskSessionStopRequest,
} from "../core/api-validation";
import { isHomeAgentSessionId } from "../core/home-agent-session";
import { openInBrowser } from "../server/browser";
import { buildRuntimeConfigResponse, resolveAgentCommand } from "../terminal/agent-registry";
import type { TerminalSessionManager } from "../terminal/session-manager";
import { resolveTaskCwd } from "../workspace/task-worktree";
import { captureTaskTurnCheckpoint } from "../workspace/turn-checkpoints";
import type { RuntimeTrpcContext, RuntimeTrpcWorkspaceScope } from "./app-router";

export interface CreateRuntimeApiDependencies {
	getActiveWorkspaceId: () => string | null;
	getActiveRuntimeConfig?: () => RuntimeConfigState;
	loadScopedRuntimeConfig: (scope: RuntimeTrpcWorkspaceScope) => Promise<RuntimeConfigState>;
	setActiveRuntimeConfig: (config: RuntimeConfigState) => void;
	getScopedTerminalManager: (scope: RuntimeTrpcWorkspaceScope) => Promise<TerminalSessionManager>;
	resolveInteractiveShellCommand: () => { binary: string; args: string[] };
	runCommand: (command: string, cwd: string) => Promise<RuntimeCommandRunResponse>;
	broadcastTaskChatCleared?: (workspaceId: string, taskId: string) => void;
	prepareForStateReset?: () => Promise<void>;
	getUpdateStatus: () => RuntimeUpdateStatusResponse;
	runUpdateNow: () => Promise<RuntimeRunUpdateResponse>;
}

async function resolveExistingTaskCwdOrEnsure(options: {
	cwd: string;
	taskId: string;
	baseRef: string;
}): Promise<string> {
	try {
		return await resolveTaskCwd({
			cwd: options.cwd,
			taskId: options.taskId,
			baseRef: options.baseRef,
			ensure: false,
		});
	} catch {
		return await resolveTaskCwd({
			cwd: options.cwd,
			taskId: options.taskId,
			baseRef: options.baseRef,
			ensure: true,
		});
	}
}

export function createRuntimeApi(deps: CreateRuntimeApiDependencies): RuntimeTrpcContext["runtimeApi"] {
	const debugResetTargetPaths = [
		join(homedir(), ".cline", "data"),
		join(homedir(), ".cline", "kanban"),
		join(homedir(), ".cline", "worktrees"),
	] as const;

	const defaultClineProviderSettings = {
		providerId: null,
		modelId: null,
		baseUrl: null,
		reasoningEffort: null,
		apiKeyConfigured: false,
		oauthProvider: null,
		oauthAccessTokenConfigured: false,
		oauthRefreshTokenConfigured: false,
		oauthAccountId: null,
		oauthExpiresAt: null,
	};
	const buildConfigResponse = (runtimeConfig: RuntimeConfigState) =>
		buildRuntimeConfigResponse(runtimeConfig, defaultClineProviderSettings);

	return {
		loadConfig: async (workspaceScope) => {
			const activeRuntimeConfig = deps.getActiveRuntimeConfig?.();
			if (!workspaceScope && !activeRuntimeConfig) {
				throw new Error("No active runtime config provider is available.");
			}
			let scopedRuntimeConfig: RuntimeConfigState;
			if (workspaceScope) {
				scopedRuntimeConfig = await deps.loadScopedRuntimeConfig(workspaceScope);
			} else if (activeRuntimeConfig) {
				scopedRuntimeConfig = activeRuntimeConfig;
			} else {
				throw new Error("No active runtime config provider is available.");
			}
			return buildConfigResponse(scopedRuntimeConfig);
		},
		saveConfig: async (workspaceScope, input) => {
			const parsed = parseRuntimeConfigSaveRequest(input);
			let nextRuntimeConfig: RuntimeConfigState;
			if (workspaceScope) {
				nextRuntimeConfig = await updateRuntimeConfig(workspaceScope.workspacePath, parsed);
			} else {
				const activeRuntimeConfig = deps.getActiveRuntimeConfig?.();
				if (!activeRuntimeConfig) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "No active runtime config is available.",
					});
				}
				nextRuntimeConfig = await updateGlobalRuntimeConfig(activeRuntimeConfig, parsed);
			}
			if (workspaceScope && workspaceScope.workspaceId === deps.getActiveWorkspaceId()) {
				deps.setActiveRuntimeConfig(nextRuntimeConfig);
			}
			if (!workspaceScope) {
				deps.setActiveRuntimeConfig(nextRuntimeConfig);
			}
			return buildConfigResponse(nextRuntimeConfig);
		},
		saveClineProviderSettings: async (_workspaceScope, _input) => {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cline SDK has been removed. Use CLI-based agents instead.",
			});
		},
		addClineProvider: async (_workspaceScope, _input) => {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cline SDK has been removed. Use CLI-based agents instead.",
			});
		},
		updateClineProvider: async (_workspaceScope, _input) => {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cline SDK has been removed. Use CLI-based agents instead.",
			});
		},
		startTaskSession: async (workspaceScope, input) => {
			try {
				const body = parseTaskSessionStartRequest(input);
				if (body.resumeFromTrash) {
					deps.broadcastTaskChatCleared?.(workspaceScope.workspaceId, body.taskId);
				}
				const scopedRuntimeConfig = await deps.loadScopedRuntimeConfig(workspaceScope);
				const taskCwd = isHomeAgentSessionId(body.taskId)
					? workspaceScope.workspacePath
					: await resolveExistingTaskCwdOrEnsure({
							cwd: workspaceScope.workspacePath,
							taskId: body.taskId,
							baseRef: body.baseRef,
						});
				const shouldCaptureTurnCheckpoint = !body.resumeFromTrash && !isHomeAgentSessionId(body.taskId);

				const terminalManager = await deps.getScopedTerminalManager(workspaceScope);
				const previousTerminalAgentId = body.resumeFromTrash
					? (terminalManager.getSummary(body.taskId)?.agentId ?? null)
					: null;
				const effectiveAgentId = previousTerminalAgentId ?? body.agentId ?? scopedRuntimeConfig.selectedAgentId;

				const resolvedConfig =
					effectiveAgentId !== scopedRuntimeConfig.selectedAgentId
						? { ...scopedRuntimeConfig, selectedAgentId: effectiveAgentId }
						: scopedRuntimeConfig;
				const resolved = resolveAgentCommand(resolvedConfig);
				if (!resolved) {
					return {
						ok: false,
						summary: null,
						error: "No runnable agent command is configured. Open Settings, install a supported CLI, and select it.",
					};
				}
				const summary = await terminalManager.startTaskSession({
					taskId: body.taskId,
					agentId: resolved.agentId,
					binary: resolved.binary,
					args: resolved.args,
					autonomousModeEnabled: scopedRuntimeConfig.agentAutonomousModeEnabled,
					cwd: taskCwd,
					prompt: body.prompt,
					images: body.images,
					startInPlanMode: body.startInPlanMode,
					resumeFromTrash: body.resumeFromTrash,
					cols: body.cols,
					rows: body.rows,
					workspaceId: workspaceScope.workspaceId,
				});

				let nextSummary = summary;
				if (shouldCaptureTurnCheckpoint) {
					try {
						const nextTurn = (summary.latestTurnCheckpoint?.turn ?? 0) + 1;
						const checkpoint = await captureTaskTurnCheckpoint({
							cwd: taskCwd,
							taskId: body.taskId,
							turn: nextTurn,
						});
						nextSummary = terminalManager.applyTurnCheckpoint(body.taskId, checkpoint) ?? summary;
					} catch {
						// Best effort checkpointing only.
					}
				}
				return {
					ok: true,
					summary: nextSummary,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					summary: null,
					error: message,
				};
			}
		},
		stopTaskSession: async (workspaceScope, input) => {
			try {
				const body = parseTaskSessionStopRequest(input);
				const terminalManager = await deps.getScopedTerminalManager(workspaceScope);
				const summary = terminalManager.stopTaskSession(body.taskId);
				return {
					ok: Boolean(summary),
					summary,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					summary: null,
					error: message,
				};
			}
		},
		sendTaskSessionInput: async (workspaceScope, input) => {
			try {
				const body = parseTaskSessionInputRequest(input);
				const payloadText = body.appendNewline ? `${body.text}\n` : body.text;
				const terminalManager = await deps.getScopedTerminalManager(workspaceScope);
				const summary = terminalManager.writeInput(body.taskId, Buffer.from(payloadText, "utf8"));
				if (!summary) {
					return {
						ok: false,
						summary: null,
						error: "Task session is not running.",
					};
				}
				return {
					ok: true,
					summary,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					summary: null,
					error: message,
				};
			}
		},
		getTaskChatMessages: async (_workspaceScope, _input) => {
			return {
				ok: false,
				messages: [],
				error: "Cline SDK has been removed. Use terminal-based agents instead.",
			};
		},
		getClineSlashCommands: async (_workspaceScope) => {
			return {
				commands: [],
			};
		},
		reloadTaskChatSession: async (_workspaceScope, _input) => {
			return {
				ok: false,
				summary: null,
				error: "Cline SDK has been removed. Use terminal-based agents instead.",
			};
		},
		abortTaskChatTurn: async (_workspaceScope, _input) => {
			return {
				ok: false,
				summary: null,
				error: "Cline SDK has been removed. Use terminal-based agents instead.",
			};
		},
		cancelTaskChatTurn: async (_workspaceScope, _input) => {
			return {
				ok: false,
				summary: null,
				error: "Cline SDK has been removed. Use terminal-based agents instead.",
			};
		},
		getClineProviderCatalog: async (_workspaceScope) => {
			return {
				providers: [],
			};
		},
		getClineAccountProfile: async (_workspaceScope) => {
			return {
				profile: null,
				error: "Cline SDK has been removed.",
			};
		},
		getClineKanbanAccess: async (_workspaceScope) => {
			return {
				enabled: true,
			};
		},
		getFeaturebaseToken: async (_workspaceScope) => {
			return {
				featurebaseJwt: "",
			};
		},
		getClineAccountBalance: async (_workspaceScope) => {
			return {
				balance: null,
				activeAccountLabel: null,
				activeOrganizationId: null,
				error: "Cline SDK has been removed.",
			};
		},
		getClineAccountOrganizations: async (_workspaceScope) => {
			return {
				organizations: [],
				error: "Cline SDK has been removed.",
			};
		},
		switchClineAccount: async (_workspaceScope, _input) => {
			return {
				ok: false,
				error: "Cline SDK has been removed.",
			};
		},
		getClineProviderModels: async (_workspaceScope, _input) => {
			return {
				providerId: "",
				models: [],
			};
		},
		getClineMcpAuthStatuses: async (_workspaceScope) => {
			return {
				statuses: [],
			};
		},
		runClineMcpServerOAuth: async (_workspaceScope, _input) => {
			return {
				serverName: "",
				authorized: true as const,
				message: "Cline SDK has been removed.",
			};
		},
		getClineMcpSettings: async (_workspaceScope) => {
			return {
				path: "",
				servers: [],
			};
		},
		saveClineMcpSettings: async (_workspaceScope, _input) => {
			return {
				path: "",
				servers: [],
			};
		},
		runClineProviderOAuthLogin: async (_workspaceScope, _input) => {
			return {
				ok: false,
				provider: "cline" as const,
				error: "Cline SDK has been removed.",
			};
		},
		startClineDeviceAuth: async () => {
			return {
				deviceCode: "",
				userCode: "",
				verificationUrl: "",
				expiresInSeconds: 0,
				pollIntervalSeconds: 0,
			};
		},
		completeClineDeviceAuth: async (_workspaceScope, _input) => {
			return {
				ok: false,
				provider: "cline" as const,
				error: "Cline SDK has been removed.",
			};
		},
		sendTaskChatMessage: async (_workspaceScope, _input) => {
			return {
				ok: false,
				summary: null,
				message: null,
				error: "Cline SDK has been removed. Use terminal-based agents instead.",
			};
		},
		startShellSession: async (workspaceScope, input) => {
			try {
				const body = parseShellSessionStartRequest(input);
				const terminalManager = await deps.getScopedTerminalManager(workspaceScope);
				const shell = deps.resolveInteractiveShellCommand();
				const shellCwd = body.workspaceTaskId
					? await resolveTaskCwd({
							cwd: workspaceScope.workspacePath,
							taskId: body.workspaceTaskId,
							baseRef: body.baseRef,
							ensure: true,
						})
					: workspaceScope.workspacePath;
				const summary = await terminalManager.startShellSession({
					taskId: body.taskId,
					cwd: shellCwd,
					cols: body.cols,
					rows: body.rows,
					binary: shell.binary,
					args: shell.args,
				});
				return {
					ok: true,
					summary,
					shellBinary: shell.binary,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					ok: false,
					summary: null,
					shellBinary: null,
					error: message,
				};
			}
		},
		runCommand: async (workspaceScope, input) => {
			try {
				const body = parseCommandRunRequest(input);
				return await deps.runCommand(body.command, workspaceScope.workspacePath);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message,
				});
			}
		},
		resetAllState: async (_workspaceScope) => {
			await deps.prepareForStateReset?.();
			await Promise.all(
				debugResetTargetPaths.map(async (path) => {
					await rm(path, { recursive: true, force: true });
				}),
			);
			return {
				ok: true,
				clearedPaths: [...debugResetTargetPaths],
			};
		},
		openFile: async (input) => {
			const filePath = input.filePath.trim();
			if (!filePath) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "File path cannot be empty.",
				});
			}
			openInBrowser(filePath);
			return { ok: true };
		},
		getUpdateStatus: async () => {
			return deps.getUpdateStatus();
		},
		runUpdateNow: async () => {
			return await deps.runUpdateNow();
		},
	};
}
