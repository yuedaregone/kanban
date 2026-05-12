import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CheckpointInfo {
	id: string;
	taskId: string;
	timestamp: number;
	path: string;
}

interface CheckpointRecord {
	id: string;
	taskId: string;
	timestamp: number;
	path: string;
}

const CHECKPOINTS_DIR = join(homedir(), ".kanban", "checkpoints");
const CHECKPOINTS_INDEX_FILE = "index.json";

export class ManualCheckpointManager {
	private indexCache: Map<string, CheckpointRecord[]> = new Map();

	private getTaskCheckpointDir(taskId: string): string {
		return join(CHECKPOINTS_DIR, taskId);
	}

	private getTaskIndexPath(taskId: string): string {
		return join(this.getTaskCheckpointDir(taskId), CHECKPOINTS_INDEX_FILE);
	}

	private async ensureTaskDir(taskId: string): Promise<string> {
		const taskDir = this.getTaskCheckpointDir(taskId);
		await mkdir(taskDir, { recursive: true });
		return taskDir;
	}

	private async loadIndex(taskId: string): Promise<CheckpointRecord[]> {
		const cached = this.indexCache.get(taskId);
		if (cached) {
			return cached;
		}

		try {
			const indexPath = this.getTaskIndexPath(taskId);
			const content = await readFile(indexPath, "utf-8");
			const records = JSON.parse(content) as CheckpointRecord[];
			this.indexCache.set(taskId, records);
			return records;
		} catch {
			return [];
		}
	}

	private async saveIndex(taskId: string, records: CheckpointRecord[]): Promise<void> {
		await this.ensureTaskDir(taskId);
		const indexPath = this.getTaskIndexPath(taskId);
		await writeFile(indexPath, JSON.stringify(records, null, 2), "utf-8");
		this.indexCache.set(taskId, records);
	}

	async createCheckpoint(taskId: string, sourceDir: string): Promise<string> {
		const timestamp = Date.now();
		const checkpointId = `${taskId}-${timestamp}`;
		const checkpointPath = join(this.getTaskCheckpointDir(taskId), checkpointId);

		await this.ensureTaskDir(taskId);
		await cp(sourceDir, checkpointPath, {
			recursive: true,
			filter: (src) => {
				const relativePath = src.replace(sourceDir, "").replace(/^[/\\]/, "");
				return (
					!relativePath.startsWith("node_modules") &&
					!relativePath.startsWith(".git") &&
					!relativePath.startsWith(".kanban-tasks")
				);
			},
		});

		const records = await this.loadIndex(taskId);
		records.push({
			id: checkpointId,
			taskId,
			timestamp,
			path: checkpointPath,
		});
		await this.saveIndex(taskId, records);

		return checkpointId;
	}

	async restoreCheckpoint(taskId: string, checkpointId: string, targetDir: string): Promise<void> {
		const records = await this.loadIndex(taskId);
		const record = records.find((r) => r.id === checkpointId);

		if (!record) {
			throw new Error(`Checkpoint not found: ${checkpointId}`);
		}

		await rm(targetDir, { recursive: true, force: true });
		await mkdir(targetDir, { recursive: true });
		await cp(record.path, targetDir, { recursive: true });
	}

	async listCheckpoints(taskId: string): Promise<CheckpointInfo[]> {
		const records = await this.loadIndex(taskId);
		return records
			.map((r) => ({
				id: r.id,
				taskId: r.taskId,
				timestamp: r.timestamp,
				path: r.path,
			}))
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	async deleteCheckpoint(taskId: string, checkpointId: string): Promise<void> {
		const records = await this.loadIndex(taskId);
		const recordIndex = records.findIndex((r) => r.id === checkpointId);

		if (recordIndex === -1) {
			return;
		}

		const record = records[recordIndex];
		await rm(record.path, { recursive: true, force: true }).catch(() => {});
		records.splice(recordIndex, 1);
		await this.saveIndex(taskId, records);
	}

	async deleteAllCheckpoints(taskId: string): Promise<void> {
		const records = await this.loadIndex(taskId);
		for (const record of records) {
			await rm(record.path, { recursive: true, force: true }).catch(() => {});
		}
		await this.saveIndex(taskId, []);
	}
}

export const manualCheckpointManager = new ManualCheckpointManager();
