import type {
	RuntimeTaskWorkspaceInfoResponse,
	RuntimeWorktreeDeleteResponse,
	RuntimeWorktreeEnsureResponse,
} from "../core/api-contract";
import { loadWorkspaceContext } from "../state/workspace-state";
import { isGitRepository } from "./git-detection";
import { readGitHeadInfo } from "./git-utils";

export async function ensureTaskWorktreeIfDoesntExist(options: {
	cwd: string;
	taskId: string;
	baseRef: string;
}): Promise<RuntimeWorktreeEnsureResponse> {
	const context = await loadWorkspaceContext(options.cwd);
	const isGit = await isGitRepository(context.repoPath);

	if (!isGit) {
		return {
			ok: true,
			path: context.repoPath,
			baseRef: options.baseRef.trim(),
			baseCommit: "",
		};
	}

	return {
		ok: true,
		path: context.repoPath,
		baseRef: options.baseRef.trim(),
		baseCommit: "",
	};
}

export async function deleteTaskWorktree(_options: {
	repoPath: string;
	taskId: string;
}): Promise<RuntimeWorktreeDeleteResponse> {
	return {
		ok: true,
		removed: false,
	};
}

export async function resolveTaskCwd(options: {
	cwd: string;
	taskId: string;
	baseRef: string;
	ensure?: boolean;
}): Promise<string> {
	const context = await loadWorkspaceContext(options.cwd);
	return context.repoPath;
}

export async function getTaskWorkspacePathInfo(options: {
	cwd: string;
	taskId: string;
	baseRef: string;
}): Promise<Pick<RuntimeTaskWorkspaceInfoResponse, "taskId" | "path" | "exists" | "baseRef">> {
	const normalizedBaseRef = options.baseRef.trim();
	const repoPath = options.cwd.trim();

	if (!repoPath) {
		throw new Error("Task workspace root is required for task workspace info.");
	}

	return {
		taskId: options.taskId,
		path: repoPath,
		exists: true,
		baseRef: normalizedBaseRef,
	};
}

export async function getTaskWorkspaceInfo(options: {
	cwd: string;
	taskId: string;
	baseRef: string;
}): Promise<RuntimeTaskWorkspaceInfoResponse> {
	const context = await loadWorkspaceContext(options.cwd);
	const isGit = await isGitRepository(context.repoPath);

	if (!isGit) {
		return {
			taskId: options.taskId,
			path: context.repoPath,
			exists: true,
			baseRef: options.baseRef.trim(),
			branch: null,
			isDetached: false,
			headCommit: null,
		};
	}

	const headInfo = await readGitHeadInfo(context.repoPath);
	return {
		taskId: options.taskId,
		path: context.repoPath,
		exists: true,
		baseRef: options.baseRef.trim(),
		branch: headInfo.branch,
		isDetached: headInfo.isDetached,
		headCommit: headInfo.headCommit,
	};
}
