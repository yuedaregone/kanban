import { access, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { RuntimeWorktreeDeleteResponse, RuntimeWorktreeEnsureResponse } from "../core/api-contract";
import type { ProjectConfig } from "./types";

const KANBAN_TASKS_DIR = ".kanban-tasks";

export async function ensureManualWorkspace(options: {
	taskId: string;
	projectId: string;
	projects: ProjectConfig[];
}): Promise<RuntimeWorktreeEnsureResponse> {
	const { taskId, projectId, projects } = options;

	const project = projects.find((p) => p.id === projectId);
	if (!project) {
		return {
			ok: false,
			path: null,
			baseRef: "",
			baseCommit: null,
			error: `Project not found: ${projectId}`,
		};
	}

	try {
		await access(project.rootPath);
	} catch {
		return {
			ok: false,
			path: null,
			baseRef: "",
			baseCommit: null,
			error: `Project directory does not exist: ${project.rootPath}`,
		};
	}

	const taskDir = join(project.rootPath, KANBAN_TASKS_DIR, taskId);

	try {
		await mkdir(taskDir, { recursive: true });
	} catch (error) {
		return {
			ok: false,
			path: null,
			baseRef: "",
			baseCommit: null,
			error: `Failed to create task directory: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	return {
		ok: true,
		path: taskDir,
		baseRef: "",
		baseCommit: "",
	};
}

export async function deleteManualWorkspace(options: {
	taskId: string;
	projectId: string;
	projects: ProjectConfig[];
}): Promise<RuntimeWorktreeDeleteResponse> {
	const { taskId, projectId, projects } = options;

	const project = projects.find((p) => p.id === projectId);
	if (!project) {
		return {
			ok: false,
			removed: false,
			error: `Project not found: ${projectId}`,
		};
	}

	const taskDir = join(project.rootPath, KANBAN_TASKS_DIR, taskId);

	try {
		await access(taskDir);
	} catch {
		return {
			ok: true,
			removed: false,
		};
	}

	return {
		ok: true,
		removed: false,
	};
}

export async function resolveManualTaskCwd(options: {
	taskId: string;
	projectId: string;
	projects: ProjectConfig[];
}): Promise<string | null> {
	const { taskId, projectId, projects } = options;

	const project = projects.find((p) => p.id === projectId);
	if (!project) {
		return null;
	}

	const taskDir = join(project.rootPath, KANBAN_TASKS_DIR, taskId);

	try {
		await access(taskDir);
		return taskDir;
	} catch {
		return null;
	}
}

export async function listManualTaskDirs(options: { projectId: string; projects: ProjectConfig[] }): Promise<string[]> {
	const { projectId, projects } = options;

	const project = projects.find((p) => p.id === projectId);
	if (!project) {
		return [];
	}

	const kanbanTasksDir = join(project.rootPath, KANBAN_TASKS_DIR);

	try {
		const entries = await readdir(kanbanTasksDir, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {
		return [];
	}
}
