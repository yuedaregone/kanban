export type WorkspaceMode = "git" | "manual";

export interface ProjectConfig {
	id: string;
	name: string;
	rootPath: string;
	mode?: WorkspaceMode;
	agentType?: string;
	description?: string;
	createdAt: number;
}

export interface WorkspaceConfig {
	mode: WorkspaceMode;
	projects: ProjectConfig[];
}

export interface TaskWorkspace {
	taskId: string;
	projectId?: string;
	path: string;
	mode: WorkspaceMode;
}

export interface ManualWorkspaceChanges {
	added: string[];
	modified: string[];
	deleted: string[];
}
