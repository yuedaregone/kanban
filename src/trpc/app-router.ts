// Defines the typed TRPC boundary between the browser and the local runtime.
// Keep request and response contracts plus workspace-scoped procedures here,
// and delegate domain behavior to runtime-api.ts and lower-level services.
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import type {
	RuntimeCommandRunRequest,
	RuntimeCommandRunResponse,
	RuntimeConfigResponse,
	RuntimeConfigSaveRequest,
	RuntimeCreateManualCheckpointRequest,
	RuntimeCreateManualCheckpointResponse,
	RuntimeDebugResetAllStateResponse,
	RuntimeDeleteManualCheckpointRequest,
	RuntimeDeleteManualCheckpointResponse,
	RuntimeDirectoryListRequest,
	RuntimeDirectoryListResponse,
	RuntimeGetManualWorkspaceChangesRequest,
	RuntimeGitCheckoutRequest,
	RuntimeGitCheckoutResponse,
	RuntimeGitCommitDiffRequest,
	RuntimeGitCommitDiffResponse,
	RuntimeGitDiscardResponse,
	RuntimeGitLogRequest,
	RuntimeGitLogResponse,
	RuntimeGitRefsResponse,
	RuntimeGitSummaryResponse,
	RuntimeGitSyncAction,
	RuntimeGitSyncResponse,
	RuntimeHookIngestRequest,
	RuntimeHookIngestResponse,
	RuntimeListManualCheckpointsRequest,
	RuntimeListManualCheckpointsResponse,
	RuntimeManualWorkspaceChanges,
	RuntimeOpenFileRequest,
	RuntimeOpenFileResponse,
	RuntimeProjectAddRequest,
	RuntimeProjectAddResponse,
	RuntimeProjectDirectoryPickerResponse,
	RuntimeProjectRemoveRequest,
	RuntimeProjectRemoveResponse,
	RuntimeProjectsResponse,
	RuntimeRestoreManualCheckpointRequest,
	RuntimeRestoreManualCheckpointResponse,
	RuntimeRunUpdateResponse,
	RuntimeShellSessionStartRequest,
	RuntimeShellSessionStartResponse,
	RuntimeSlashCommandsResponse,
	RuntimeTakeManualSnapshotRequest,
	RuntimeTakeManualSnapshotResponse,
	RuntimeTaskChatAbortRequest,
	RuntimeTaskChatAbortResponse,
	RuntimeTaskChatCancelRequest,
	RuntimeTaskChatCancelResponse,
	RuntimeTaskChatMessagesRequest,
	RuntimeTaskChatMessagesResponse,
	RuntimeTaskChatReloadRequest,
	RuntimeTaskChatReloadResponse,
	RuntimeTaskChatSendRequest,
	RuntimeTaskChatSendResponse,
	RuntimeTaskSessionInputRequest,
	RuntimeTaskSessionInputResponse,
	RuntimeTaskSessionStartRequest,
	RuntimeTaskSessionStartResponse,
	RuntimeTaskSessionStopRequest,
	RuntimeTaskSessionStopResponse,
	RuntimeTaskWorkspaceInfoRequest,
	RuntimeTaskWorkspaceInfoResponse,
	RuntimeUpdateStatusResponse,
	RuntimeWorkspaceChangesRequest,
	RuntimeWorkspaceChangesResponse,
	RuntimeWorkspaceFileSearchRequest,
	RuntimeWorkspaceFileSearchResponse,
	RuntimeWorkspaceStateNotifyResponse,
	RuntimeWorkspaceStateResponse,
	RuntimeWorkspaceStateSaveRequest,
	RuntimeWorktreeDeleteRequest,
	RuntimeWorktreeDeleteResponse,
	RuntimeWorktreeEnsureRequest,
	RuntimeWorktreeEnsureResponse,
} from "../core/api-contract";
import {
	runtimeCommandRunRequestSchema,
	runtimeCommandRunResponseSchema,
	runtimeConfigResponseSchema,
	runtimeConfigSaveRequestSchema,
	runtimeCreateManualCheckpointRequestSchema,
	runtimeCreateManualCheckpointResponseSchema,
	runtimeDebugResetAllStateResponseSchema,
	runtimeDeleteManualCheckpointRequestSchema,
	runtimeDeleteManualCheckpointResponseSchema,
	runtimeDirectoryListRequestSchema,
	runtimeDirectoryListResponseSchema,
	runtimeGetManualWorkspaceChangesRequestSchema,
	runtimeGitCheckoutRequestSchema,
	runtimeGitCheckoutResponseSchema,
	runtimeGitCommitDiffRequestSchema,
	runtimeGitCommitDiffResponseSchema,
	runtimeGitDiscardResponseSchema,
	runtimeGitLogRequestSchema,
	runtimeGitLogResponseSchema,
	runtimeGitRefsResponseSchema,
	runtimeGitSummaryResponseSchema,
	runtimeGitSyncActionSchema,
	runtimeGitSyncResponseSchema,
	runtimeHookIngestRequestSchema,
	runtimeHookIngestResponseSchema,
	runtimeListManualCheckpointsRequestSchema,
	runtimeListManualCheckpointsResponseSchema,
	runtimeManualWorkspaceChangesSchema,
	runtimeOpenFileRequestSchema,
	runtimeOpenFileResponseSchema,
	runtimeProjectAddRequestSchema,
	runtimeProjectAddResponseSchema,
	runtimeProjectDirectoryPickerResponseSchema,
	runtimeProjectRemoveRequestSchema,
	runtimeProjectRemoveResponseSchema,
	runtimeProjectsResponseSchema,
	runtimeRestoreManualCheckpointRequestSchema,
	runtimeRestoreManualCheckpointResponseSchema,
	runtimeRunUpdateResponseSchema,
	runtimeShellSessionStartRequestSchema,
	runtimeShellSessionStartResponseSchema,
	runtimeSlashCommandsResponseSchema,
	runtimeTakeManualSnapshotRequestSchema,
	runtimeTakeManualSnapshotResponseSchema,
	runtimeTaskChatAbortRequestSchema,
	runtimeTaskChatAbortResponseSchema,
	runtimeTaskChatCancelRequestSchema,
	runtimeTaskChatCancelResponseSchema,
	runtimeTaskChatMessagesRequestSchema,
	runtimeTaskChatMessagesResponseSchema,
	runtimeTaskChatReloadRequestSchema,
	runtimeTaskChatReloadResponseSchema,
	runtimeTaskChatSendRequestSchema,
	runtimeTaskChatSendResponseSchema,
	runtimeTaskSessionInputRequestSchema,
	runtimeTaskSessionInputResponseSchema,
	runtimeTaskSessionStartRequestSchema,
	runtimeTaskSessionStartResponseSchema,
	runtimeTaskSessionStopRequestSchema,
	runtimeTaskSessionStopResponseSchema,
	runtimeTaskWorkspaceInfoRequestSchema,
	runtimeTaskWorkspaceInfoResponseSchema,
	runtimeUpdateStatusResponseSchema,
	runtimeWorkspaceChangesRequestSchema,
	runtimeWorkspaceChangesResponseSchema,
	runtimeWorkspaceFileSearchRequestSchema,
	runtimeWorkspaceFileSearchResponseSchema,
	runtimeWorkspaceStateNotifyResponseSchema,
	runtimeWorkspaceStateResponseSchema,
	runtimeWorkspaceStateSaveRequestSchema,
	runtimeWorktreeDeleteRequestSchema,
	runtimeWorktreeDeleteResponseSchema,
	runtimeWorktreeEnsureRequestSchema,
	runtimeWorktreeEnsureResponseSchema,
} from "../core/api-contract";

export interface RuntimeTrpcWorkspaceScope {
	workspaceId: string;
	workspacePath: string;
}

export interface RuntimeTrpcContext {
	requestedWorkspaceId: string | null;
	workspaceScope: RuntimeTrpcWorkspaceScope | null;
	runtimeApi: {
		loadConfig: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<RuntimeConfigResponse>;
		saveConfig: (
			scope: RuntimeTrpcWorkspaceScope | null,
			input: RuntimeConfigSaveRequest,
		) => Promise<RuntimeConfigResponse>;
		saveClineProviderSettings: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		addClineProvider: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		updateClineProvider: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		startTaskSession: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskSessionStartRequest,
		) => Promise<RuntimeTaskSessionStartResponse>;
		stopTaskSession: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskSessionStopRequest,
		) => Promise<RuntimeTaskSessionStopResponse>;
		sendTaskSessionInput: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskSessionInputRequest,
		) => Promise<RuntimeTaskSessionInputResponse>;
		getTaskChatMessages: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskChatMessagesRequest,
		) => Promise<RuntimeTaskChatMessagesResponse>;
		getClineSlashCommands: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<RuntimeSlashCommandsResponse>;
		sendTaskChatMessage: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskChatSendRequest,
		) => Promise<RuntimeTaskChatSendResponse>;
		reloadTaskChatSession: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskChatReloadRequest,
		) => Promise<RuntimeTaskChatReloadResponse>;
		abortTaskChatTurn: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskChatAbortRequest,
		) => Promise<RuntimeTaskChatAbortResponse>;
		cancelTaskChatTurn: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskChatCancelRequest,
		) => Promise<RuntimeTaskChatCancelResponse>;
		getClineProviderCatalog: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		getClineAccountProfile: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		getClineKanbanAccess: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		getFeaturebaseToken: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		getClineAccountBalance: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		getClineAccountOrganizations: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		switchClineAccount: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		getClineProviderModels: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		runClineProviderOAuthLogin: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		startClineDeviceAuth: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		completeClineDeviceAuth: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		getClineMcpAuthStatuses: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		runClineMcpServerOAuth: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		getClineMcpSettings: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<unknown>;
		saveClineMcpSettings: (scope: RuntimeTrpcWorkspaceScope | null, input: unknown) => Promise<unknown>;
		startShellSession: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeShellSessionStartRequest,
		) => Promise<RuntimeShellSessionStartResponse>;
		runCommand: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeCommandRunRequest,
		) => Promise<RuntimeCommandRunResponse>;
		resetAllState: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<RuntimeDebugResetAllStateResponse>;
		openFile: (input: RuntimeOpenFileRequest) => Promise<RuntimeOpenFileResponse>;
		getUpdateStatus: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<RuntimeUpdateStatusResponse>;
		runUpdateNow: (scope: RuntimeTrpcWorkspaceScope | null) => Promise<RuntimeRunUpdateResponse>;
	};
	workspaceApi: {
		loadGitSummary: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskWorkspaceInfoRequest | null,
		) => Promise<RuntimeGitSummaryResponse>;
		runGitSyncAction: (
			scope: RuntimeTrpcWorkspaceScope,
			input: { action: RuntimeGitSyncAction },
		) => Promise<RuntimeGitSyncResponse>;
		checkoutGitBranch: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeGitCheckoutRequest,
		) => Promise<RuntimeGitCheckoutResponse>;
		discardGitChanges: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskWorkspaceInfoRequest | null,
		) => Promise<RuntimeGitDiscardResponse>;
		loadChanges: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeWorkspaceChangesRequest,
		) => Promise<RuntimeWorkspaceChangesResponse>;
		ensureWorktree: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeWorktreeEnsureRequest,
		) => Promise<RuntimeWorktreeEnsureResponse>;
		deleteWorktree: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeWorktreeDeleteRequest,
		) => Promise<RuntimeWorktreeDeleteResponse>;
		loadTaskContext: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskWorkspaceInfoRequest,
		) => Promise<RuntimeTaskWorkspaceInfoResponse>;
		searchFiles: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeWorkspaceFileSearchRequest,
		) => Promise<RuntimeWorkspaceFileSearchResponse>;
		loadState: (scope: RuntimeTrpcWorkspaceScope) => Promise<RuntimeWorkspaceStateResponse>;
		notifyStateUpdated: (scope: RuntimeTrpcWorkspaceScope) => Promise<RuntimeWorkspaceStateNotifyResponse>;
		saveState: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeWorkspaceStateSaveRequest,
		) => Promise<RuntimeWorkspaceStateResponse>;
		loadWorkspaceChanges: (scope: RuntimeTrpcWorkspaceScope) => Promise<RuntimeWorkspaceChangesResponse>;
		loadGitLog: (scope: RuntimeTrpcWorkspaceScope, input: RuntimeGitLogRequest) => Promise<RuntimeGitLogResponse>;
		loadGitRefs: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTaskWorkspaceInfoRequest | null,
		) => Promise<RuntimeGitRefsResponse>;
		loadCommitDiff: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeGitCommitDiffRequest,
		) => Promise<RuntimeGitCommitDiffResponse>;
		listManualCheckpoints: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeListManualCheckpointsRequest,
		) => Promise<RuntimeListManualCheckpointsResponse>;
		createManualCheckpoint: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeCreateManualCheckpointRequest,
		) => Promise<RuntimeCreateManualCheckpointResponse>;
		restoreManualCheckpoint: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeRestoreManualCheckpointRequest,
		) => Promise<RuntimeRestoreManualCheckpointResponse>;
		deleteManualCheckpoint: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeDeleteManualCheckpointRequest,
		) => Promise<RuntimeDeleteManualCheckpointResponse>;
		getManualWorkspaceChanges: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeGetManualWorkspaceChangesRequest,
		) => Promise<RuntimeManualWorkspaceChanges>;
		takeManualSnapshot: (
			scope: RuntimeTrpcWorkspaceScope,
			input: RuntimeTakeManualSnapshotRequest,
		) => Promise<RuntimeTakeManualSnapshotResponse>;
	};
	projectsApi: {
		listProjects: (preferredWorkspaceId: string | null) => Promise<RuntimeProjectsResponse>;
		addProject: (
			preferredWorkspaceId: string | null,
			input: RuntimeProjectAddRequest,
		) => Promise<RuntimeProjectAddResponse>;
		removeProject: (
			preferredWorkspaceId: string | null,
			input: RuntimeProjectRemoveRequest,
		) => Promise<RuntimeProjectRemoveResponse>;
		pickProjectDirectory: (preferredWorkspaceId: string | null) => Promise<RuntimeProjectDirectoryPickerResponse>;
		listDirectoryContents: (
			preferredWorkspaceId: string | null,
			input: RuntimeDirectoryListRequest,
		) => Promise<RuntimeDirectoryListResponse>;
	};
	hooksApi: {
		ingest: (input: RuntimeHookIngestRequest) => Promise<RuntimeHookIngestResponse>;
	};
}

interface RuntimeTrpcContextWithWorkspaceScope extends RuntimeTrpcContext {
	workspaceScope: RuntimeTrpcWorkspaceScope;
}

function readConflictRevision(cause: unknown): number | null {
	if (!cause || typeof cause !== "object" || !("currentRevision" in cause)) {
		return null;
	}
	const revision = (cause as { currentRevision?: unknown }).currentRevision;
	if (typeof revision !== "number") {
		return null;
	}
	return Number.isFinite(revision) ? revision : null;
}

const t = initTRPC.context<RuntimeTrpcContext>().create({
	errorFormatter({ shape, error }) {
		const conflictRevision = error.code === "CONFLICT" ? readConflictRevision(error.cause) : null;
		return {
			...shape,
			data: {
				...shape.data,
				conflictRevision,
			},
		};
	},
});

const workspaceProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.requestedWorkspaceId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Missing workspace scope. Include x-kanban-workspace-id header or workspaceId query parameter.",
		});
	}
	if (!ctx.workspaceScope) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Unknown workspace ID: ${ctx.requestedWorkspaceId}`,
		});
	}
	return next({
		ctx: {
			...ctx,
			workspaceScope: ctx.workspaceScope,
		} satisfies RuntimeTrpcContextWithWorkspaceScope,
	});
});

const optionalTaskWorkspaceInfoRequestSchema = runtimeTaskWorkspaceInfoRequestSchema.nullable().optional();
const gitSyncActionInputSchema = z.object({
	action: runtimeGitSyncActionSchema,
});

export const runtimeAppRouter = t.router({
	runtime: t.router({
		getConfig: t.procedure.output(runtimeConfigResponseSchema).query(async ({ ctx }) => {
			return await ctx.runtimeApi.loadConfig(ctx.workspaceScope);
		}),
		saveConfig: t.procedure
			.input(runtimeConfigSaveRequestSchema)
			.output(runtimeConfigResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.saveConfig(ctx.workspaceScope, input);
			}),
		saveClineProviderSettings: t.procedure.mutation(async () => {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cline SDK has been removed. Use CLI-based agents instead.",
			});
		}),
		addClineProvider: t.procedure.mutation(async () => {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cline SDK has been removed. Use CLI-based agents instead.",
			});
		}),
		updateClineProvider: t.procedure.mutation(async () => {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cline SDK has been removed. Use CLI-based agents instead.",
			});
		}),
		startTaskSession: workspaceProcedure
			.input(runtimeTaskSessionStartRequestSchema)
			.output(runtimeTaskSessionStartResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.startTaskSession(ctx.workspaceScope, input);
			}),
		stopTaskSession: workspaceProcedure
			.input(runtimeTaskSessionStopRequestSchema)
			.output(runtimeTaskSessionStopResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.stopTaskSession(ctx.workspaceScope, input);
			}),
		sendTaskSessionInput: workspaceProcedure
			.input(runtimeTaskSessionInputRequestSchema)
			.output(runtimeTaskSessionInputResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.sendTaskSessionInput(ctx.workspaceScope, input);
			}),
		getTaskChatMessages: workspaceProcedure
			.input(runtimeTaskChatMessagesRequestSchema)
			.output(runtimeTaskChatMessagesResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.runtimeApi.getTaskChatMessages(ctx.workspaceScope, input);
			}),
		getClineSlashCommands: t.procedure.output(runtimeSlashCommandsResponseSchema).query(async ({ ctx }) => {
			return await ctx.runtimeApi.getClineSlashCommands(ctx.workspaceScope);
		}),
		reloadTaskChatSession: workspaceProcedure
			.input(runtimeTaskChatReloadRequestSchema)
			.output(runtimeTaskChatReloadResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.reloadTaskChatSession(ctx.workspaceScope, input);
			}),
		sendTaskChatMessage: workspaceProcedure
			.input(runtimeTaskChatSendRequestSchema)
			.output(runtimeTaskChatSendResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.sendTaskChatMessage(ctx.workspaceScope, input);
			}),
		abortTaskChatTurn: workspaceProcedure
			.input(runtimeTaskChatAbortRequestSchema)
			.output(runtimeTaskChatAbortResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.abortTaskChatTurn(ctx.workspaceScope, input);
			}),
		cancelTaskChatTurn: workspaceProcedure
			.input(runtimeTaskChatCancelRequestSchema)
			.output(runtimeTaskChatCancelResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.cancelTaskChatTurn(ctx.workspaceScope, input);
			}),
		getClineProviderCatalog: t.procedure.query(async () => {
			return { providers: [] };
		}),
		getClineAccountProfile: t.procedure.query(async () => {
			return { profile: null, error: "Cline SDK has been removed." };
		}),
		getClineKanbanAccess: t.procedure.query(async () => {
			return { enabled: false, error: "Cline SDK has been removed." };
		}),
		getFeaturebaseToken: t.procedure.query(async () => {
			return { featurebaseJwt: "" };
		}),
		getClineAccountBalance: t.procedure.query(async () => {
			return {
				balance: null,
				activeAccountLabel: null,
				activeOrganizationId: null,
				error: "Cline SDK has been removed.",
			};
		}),
		getClineAccountOrganizations: t.procedure.query(async () => {
			return { organizations: [], error: "Cline SDK has been removed." };
		}),
		switchClineAccount: t.procedure.mutation(async () => {
			return { ok: false, error: "Cline SDK has been removed." };
		}),
		getClineProviderModels: t.procedure.query(async () => {
			return { providerId: "", models: [] };
		}),
		getClineMcpAuthStatuses: t.procedure.query(async () => {
			return { statuses: [] };
		}),
		runClineMcpServerOAuth: t.procedure.mutation(async () => {
			return { serverName: "", authorized: true as const, message: "Cline SDK has been removed." };
		}),
		getClineMcpSettings: t.procedure.query(async () => {
			return { path: "", servers: [] };
		}),
		saveClineMcpSettings: t.procedure.mutation(async () => {
			return { path: "", servers: [] };
		}),
		runClineProviderOAuthLogin: t.procedure.mutation(async () => {
			return { ok: false, provider: "cline" as const, error: "Cline SDK has been removed." };
		}),
		startClineDeviceAuth: t.procedure.mutation(async () => {
			return { deviceCode: "", userCode: "", verificationUrl: "", expiresInSeconds: 0, pollIntervalSeconds: 0 };
		}),
		completeClineDeviceAuth: t.procedure.mutation(async () => {
			return { ok: false, provider: "cline" as const, error: "Cline SDK has been removed." };
		}),
		startShellSession: workspaceProcedure
			.input(runtimeShellSessionStartRequestSchema)
			.output(runtimeShellSessionStartResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.startShellSession(ctx.workspaceScope, input);
			}),
		runCommand: workspaceProcedure
			.input(runtimeCommandRunRequestSchema)
			.output(runtimeCommandRunResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.runCommand(ctx.workspaceScope, input);
			}),
		resetAllState: t.procedure.output(runtimeDebugResetAllStateResponseSchema).mutation(async ({ ctx }) => {
			return await ctx.runtimeApi.resetAllState(ctx.workspaceScope);
		}),
		openFile: t.procedure
			.input(runtimeOpenFileRequestSchema)
			.output(runtimeOpenFileResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.runtimeApi.openFile(input);
			}),
		getUpdateStatus: t.procedure.output(runtimeUpdateStatusResponseSchema).query(async ({ ctx }) => {
			return await ctx.runtimeApi.getUpdateStatus(ctx.workspaceScope);
		}),
		runUpdateNow: t.procedure.output(runtimeRunUpdateResponseSchema).mutation(async ({ ctx }) => {
			return await ctx.runtimeApi.runUpdateNow(ctx.workspaceScope);
		}),
	}),
	workspace: t.router({
		getGitSummary: workspaceProcedure
			.input(optionalTaskWorkspaceInfoRequestSchema)
			.output(runtimeGitSummaryResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.loadGitSummary(ctx.workspaceScope, input ?? null);
			}),
		runGitSyncAction: workspaceProcedure
			.input(gitSyncActionInputSchema)
			.output(runtimeGitSyncResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.runGitSyncAction(ctx.workspaceScope, input);
			}),
		checkoutGitBranch: workspaceProcedure
			.input(runtimeGitCheckoutRequestSchema)
			.output(runtimeGitCheckoutResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.checkoutGitBranch(ctx.workspaceScope, input);
			}),
		discardGitChanges: workspaceProcedure
			.input(optionalTaskWorkspaceInfoRequestSchema)
			.output(runtimeGitDiscardResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.discardGitChanges(ctx.workspaceScope, input ?? null);
			}),
		getChanges: workspaceProcedure
			.input(runtimeWorkspaceChangesRequestSchema)
			.output(runtimeWorkspaceChangesResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.loadChanges(ctx.workspaceScope, input);
			}),
		ensureWorktree: workspaceProcedure
			.input(runtimeWorktreeEnsureRequestSchema)
			.output(runtimeWorktreeEnsureResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.ensureWorktree(ctx.workspaceScope, input);
			}),
		deleteWorktree: workspaceProcedure
			.input(runtimeWorktreeDeleteRequestSchema)
			.output(runtimeWorktreeDeleteResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.deleteWorktree(ctx.workspaceScope, input);
			}),
		getTaskContext: workspaceProcedure
			.input(runtimeTaskWorkspaceInfoRequestSchema)
			.output(runtimeTaskWorkspaceInfoResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.loadTaskContext(ctx.workspaceScope, input);
			}),
		searchFiles: workspaceProcedure
			.input(runtimeWorkspaceFileSearchRequestSchema)
			.output(runtimeWorkspaceFileSearchResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.searchFiles(ctx.workspaceScope, input);
			}),
		getState: workspaceProcedure.output(runtimeWorkspaceStateResponseSchema).query(async ({ ctx }) => {
			return await ctx.workspaceApi.loadState(ctx.workspaceScope);
		}),
		notifyStateUpdated: workspaceProcedure
			.output(runtimeWorkspaceStateNotifyResponseSchema)
			.mutation(async ({ ctx }) => {
				return await ctx.workspaceApi.notifyStateUpdated(ctx.workspaceScope);
			}),
		saveState: workspaceProcedure
			.input(runtimeWorkspaceStateSaveRequestSchema)
			.output(runtimeWorkspaceStateResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.saveState(ctx.workspaceScope, input);
			}),
		getWorkspaceChanges: workspaceProcedure.output(runtimeWorkspaceChangesResponseSchema).query(async ({ ctx }) => {
			return await ctx.workspaceApi.loadWorkspaceChanges(ctx.workspaceScope);
		}),
		getGitLog: workspaceProcedure
			.input(runtimeGitLogRequestSchema)
			.output(runtimeGitLogResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.loadGitLog(ctx.workspaceScope, input);
			}),
		getGitRefs: workspaceProcedure
			.input(optionalTaskWorkspaceInfoRequestSchema)
			.output(runtimeGitRefsResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.loadGitRefs(ctx.workspaceScope, input ?? null);
			}),
		getCommitDiff: workspaceProcedure
			.input(runtimeGitCommitDiffRequestSchema)
			.output(runtimeGitCommitDiffResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.loadCommitDiff(ctx.workspaceScope, input);
			}),
		listManualCheckpoints: workspaceProcedure
			.input(runtimeListManualCheckpointsRequestSchema)
			.output(runtimeListManualCheckpointsResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.listManualCheckpoints(ctx.workspaceScope, input);
			}),
		createManualCheckpoint: workspaceProcedure
			.input(runtimeCreateManualCheckpointRequestSchema)
			.output(runtimeCreateManualCheckpointResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.createManualCheckpoint(ctx.workspaceScope, input);
			}),
		restoreManualCheckpoint: workspaceProcedure
			.input(runtimeRestoreManualCheckpointRequestSchema)
			.output(runtimeRestoreManualCheckpointResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.restoreManualCheckpoint(ctx.workspaceScope, input);
			}),
		deleteManualCheckpoint: workspaceProcedure
			.input(runtimeDeleteManualCheckpointRequestSchema)
			.output(runtimeDeleteManualCheckpointResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.deleteManualCheckpoint(ctx.workspaceScope, input);
			}),
		getManualWorkspaceChanges: workspaceProcedure
			.input(runtimeGetManualWorkspaceChangesRequestSchema)
			.output(runtimeManualWorkspaceChangesSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.workspaceApi.getManualWorkspaceChanges(ctx.workspaceScope, input);
			}),
		takeManualSnapshot: workspaceProcedure
			.input(runtimeTakeManualSnapshotRequestSchema)
			.output(runtimeTakeManualSnapshotResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.workspaceApi.takeManualSnapshot(ctx.workspaceScope, input);
			}),
	}),
	projects: t.router({
		list: t.procedure.output(runtimeProjectsResponseSchema).query(async ({ ctx }) => {
			return await ctx.projectsApi.listProjects(ctx.requestedWorkspaceId);
		}),
		add: t.procedure
			.input(runtimeProjectAddRequestSchema)
			.output(runtimeProjectAddResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.projectsApi.addProject(ctx.requestedWorkspaceId, input);
			}),
		remove: t.procedure
			.input(runtimeProjectRemoveRequestSchema)
			.output(runtimeProjectRemoveResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.projectsApi.removeProject(ctx.requestedWorkspaceId, input);
			}),
		pickDirectory: t.procedure.output(runtimeProjectDirectoryPickerResponseSchema).mutation(async ({ ctx }) => {
			return await ctx.projectsApi.pickProjectDirectory(ctx.requestedWorkspaceId);
		}),
		listDirectoryContents: t.procedure
			.input(runtimeDirectoryListRequestSchema)
			.output(runtimeDirectoryListResponseSchema)
			.query(async ({ ctx, input }) => {
				return await ctx.projectsApi.listDirectoryContents(ctx.requestedWorkspaceId, input);
			}),
	}),
	hooks: t.router({
		ingest: t.procedure
			.input(runtimeHookIngestRequestSchema)
			.output(runtimeHookIngestResponseSchema)
			.mutation(async ({ ctx, input }) => {
				return await ctx.hooksApi.ingest(input);
			}),
	}),
});

export type RuntimeAppRouter = typeof runtimeAppRouter;
export type RuntimeAppRouterInputs = inferRouterInputs<RuntimeAppRouter>;
export type RuntimeAppRouterOutputs = inferRouterOutputs<RuntimeAppRouter>;
