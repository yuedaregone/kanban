import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { WorkspaceMode } from "../workspace/types";

const OLD_CONFIG_DIR = join(homedir(), ".cline", "kanban");
const NEW_CONFIG_DIR = join(homedir(), ".kanban");
const CONFIG_FILENAME = "config.json";

interface OldConfigShape {
	selectedAgentId?: string;
	selectedShortcutLabel?: string;
	agentAutonomousModeEnabled?: boolean;
	readyForReviewNotificationsEnabled?: boolean;
	commitPromptTemplate?: string;
	openPrPromptTemplate?: string;
}

interface NewConfigShape extends OldConfigShape {
	workspaceMode?: WorkspaceMode;
	projects?: Array<{
		id: string;
		name: string;
		rootPath: string;
		agentType?: string;
		description?: string;
		createdAt: number;
	}>;
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function readJsonFile<T>(path: string): Promise<T | null> {
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content) as T;
	} catch {
		return null;
	}
}

export async function migrateConfig(): Promise<void> {
	const oldConfigPath = join(OLD_CONFIG_DIR, CONFIG_FILENAME);
	const newConfigPath = join(NEW_CONFIG_DIR, CONFIG_FILENAME);

	if (await pathExists(newConfigPath)) {
		return;
	}

	if (!(await pathExists(oldConfigPath))) {
		await mkdir(NEW_CONFIG_DIR, { recursive: true });
		const defaultConfig: NewConfigShape = {
			workspaceMode: "git",
			projects: [],
		};
		await writeFile(newConfigPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
		return;
	}

	const oldConfig = await readJsonFile<OldConfigShape>(oldConfigPath);
	if (!oldConfig) {
		return;
	}

	await mkdir(NEW_CONFIG_DIR, { recursive: true });

	const newConfig: NewConfigShape = {
		...oldConfig,
		workspaceMode: "git",
		projects: [],
	};

	await writeFile(newConfigPath, JSON.stringify(newConfig, null, 2), "utf-8");

	const backupPath = join(OLD_CONFIG_DIR, `${CONFIG_FILENAME}.backup`);
	try {
		await cp(oldConfigPath, backupPath);
	} catch {
		// Best effort backup
	}
}

export async function migrateConfigIfNeeded(): Promise<void> {
	try {
		await migrateConfig();
	} catch {
		// Migration failures should not prevent app startup
	}
}
