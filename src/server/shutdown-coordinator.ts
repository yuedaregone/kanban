import type { RuntimeTaskSessionSummary, RuntimeWorkspaceStateResponse } from "../core/api-contract";
import { updateTaskDependencies } from "../core/task-board-mutations";
import { listWorkspaceIndexEntries, loadWorkspaceState, saveWorkspaceState } from "../state/workspace-state";
import type { TerminalSessionManager } from "../terminal/session-manager";
import type { WorkspaceRegistry } from "./workspace-registry";

export interface RuntimeShutdownCoordinatorDependencies {
	workspaceRegistry: Pick<WorkspaceRegistry, "listManagedWorkspaces">;
	warn: (message: string) => void;
	closeRuntimeServer: () => Promise<void>;
	skipSessionCleanup?: boolean;
}

function moveTaskToTrash(
	board: RuntimeWorkspaceStateResponse["board"],
	taskId: string,
): RuntimeWorkspaceStateResponse["board"] {
	const columns = board.columns.map((column) => ({
		...column,
		cards: [...column.cards],
	}));
	let removedCard: RuntimeWorkspaceStateResponse["board"]["columns"][number]["cards"][number] | undefined;

	for (const column of columns) {
		const cardIndex = column.cards.findIndex((candidate) => candidate.id === taskId);
		if (cardIndex === -1) {
			continue;
		}
		removedCard = column.cards[cardIndex];
		column.cards.splice(cardIndex, 1);
		break;
	}

	if (!removedCard) {
		return board;
	}
	const trashColumnIndex = columns.findIndex((column) => column.id === "trash");
	if (trashColumnIndex === -1) {
		return board;
	}
	const trashColumn = columns[trashColumnIndex];
	if (!trashColumn.cards.some((candidate) => candidate.id === taskId)) {
		trashColumn.cards.unshift({
			...removedCard,
			updatedAt: Date.now(),
		});
	}
	return updateTaskDependencies({
		...board,
		columns,
	});
}

async function persistInterruptedSessions(
	workspacePath: string,
	interruptedTaskIds: string[],
	options?: {
		workspaceState?: RuntimeWorkspaceStateResponse;
		resolveSummary?: (taskId: string) => RuntimeTaskSessionSummary | null;
	},
): Promise<void> {
	if (interruptedTaskIds.length === 0) {
		return;
	}
	const workspaceState = options?.workspaceState ?? (await loadWorkspaceState(workspacePath));
	let nextBoard = workspaceState.board;
	for (const taskId of interruptedTaskIds) {
		nextBoard = moveTaskToTrash(nextBoard, taskId);
	}
	const nextSessions = {
		...workspaceState.sessions,
	};
	for (const taskId of interruptedTaskIds) {
		const summary = options?.resolveSummary?.(taskId) ?? workspaceState.sessions[taskId] ?? null;
		if (summary) {
			nextSessions[taskId] = {
				...summary,
				state: "interrupted",
				reviewReason: "interrupted",
				pid: null,
				updatedAt: Date.now(),
			};
		}
	}
	await saveWorkspaceState(workspacePath, {
		board: nextBoard,
		sessions: nextSessions,
	});
}

function shouldInterruptSessionOnShutdown(summary: RuntimeTaskSessionSummary): boolean {
	if (summary.state === "running") {
		return true;
	}
	return summary.state === "awaiting_review";
}

function collectShutdownInterruptedTaskIds(
	interruptedSummaries: RuntimeTaskSessionSummary[],
	terminalManager: TerminalSessionManager,
): string[] {
	const taskIds = new Set(interruptedSummaries.map((summary) => summary.taskId));
	for (const summary of terminalManager.listSummaries()) {
		if (!shouldInterruptSessionOnShutdown(summary)) {
			continue;
		}
		taskIds.add(summary.taskId);
	}
	return Array.from(taskIds);
}

export async function shutdownRuntimeServer(deps: RuntimeShutdownCoordinatorDependencies): Promise<void> {
	if (deps.skipSessionCleanup) {
		await deps.closeRuntimeServer();
		return;
	}

	const interruptedByWorkspace: Array<{
		workspacePath: string;
		interruptedTaskIds: string[];
		workspaceState?: RuntimeWorkspaceStateResponse;
		resolveSummary?: (taskId: string) => RuntimeTaskSessionSummary | null;
	}> = [];
	const managedWorkspacePaths = new Set<string>();

	for (const { workspacePath, terminalManager } of deps.workspaceRegistry.listManagedWorkspaces()) {
		const interrupted = terminalManager.markInterruptedAndStopAll();
		const interruptedTaskIds = new Set(collectShutdownInterruptedTaskIds(interrupted, terminalManager));
		if (!workspacePath) {
			continue;
		}
		managedWorkspacePaths.add(workspacePath);
		try {
			const workspaceState = await loadWorkspaceState(workspacePath);
			interruptedByWorkspace.push({
				workspacePath,
				interruptedTaskIds: Array.from(interruptedTaskIds),
				workspaceState,
				resolveSummary: (taskId) => terminalManager.getSummary(taskId),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			deps.warn(`Could not load workspace state for ${workspacePath} during shutdown cleanup. ${message}`);
		}
	}

	const indexedWorkspaces = await listWorkspaceIndexEntries();
	for (const workspace of indexedWorkspaces) {
		if (managedWorkspacePaths.has(workspace.repoPath)) {
			continue;
		}
		try {
			const workspaceState = await loadWorkspaceState(workspace.repoPath);
			const interruptedTaskIds: string[] = [];
			if (interruptedTaskIds.length === 0) {
				continue;
			}
			interruptedByWorkspace.push({
				workspacePath: workspace.repoPath,
				interruptedTaskIds,
				workspaceState,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			deps.warn(`Could not load workspace state for ${workspace.repoPath} during shutdown cleanup. ${message}`);
		}
	}

	await Promise.all(
		interruptedByWorkspace.map(async (workspace) => {
			await persistInterruptedSessions(workspace.workspacePath, workspace.interruptedTaskIds, {
				workspaceState: workspace.workspaceState,
				resolveSummary: workspace.resolveSummary,
			});
		}),
	);

	await deps.closeRuntimeServer();
}
