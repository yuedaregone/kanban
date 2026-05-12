import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export interface ManualWorkspaceChanges {
	added: string[];
	modified: string[];
	deleted: string[];
}

interface FileSnapshot {
	path: string;
	mtime: number;
	size: number;
	hash: string;
}

const IGNORE_DIRS = new Set(["node_modules", ".git", ".kanban-tasks"]);
const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db"]);

async function walkFiles(dir: string): Promise<string[]> {
	const results: string[] = [];

	async function walk(currentDir: string): Promise<void> {
		let entries: Dirent[];
		try {
			entries = await readdir(currentDir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (IGNORE_DIRS.has(entry.name)) continue;
				await walk(join(currentDir, entry.name));
			} else if (entry.isFile()) {
				if (IGNORE_FILES.has(entry.name)) continue;
				results.push(relative(dir, join(currentDir, entry.name)));
			}
		}
	}

	await walk(dir);
	return results;
}

export class ManualChangesDetector {
	private snapshots: Map<string, Map<string, FileSnapshot>> = new Map();

	async takeSnapshot(taskId: string, dir: string): Promise<Map<string, FileSnapshot>> {
		const snapshot = new Map<string, FileSnapshot>();

		try {
			const files = await walkFiles(dir);

			for (const file of files) {
				const fullPath = join(dir, file);
				try {
					const fileStat = await stat(fullPath);
					if (fileStat.isFile()) {
						const content = await readFile(fullPath);
						const hash = createHash("sha256").update(content).digest("hex");

						snapshot.set(file, {
							path: file,
							mtime: fileStat.mtimeMs,
							size: fileStat.size,
							hash,
						});
					}
				} catch {
					// Skip files that can't be read
				}
			}
		} catch {
			// If walk fails, return empty snapshot
		}

		this.snapshots.set(taskId, snapshot);
		return snapshot;
	}

	async getChanges(taskId: string, dir: string): Promise<ManualWorkspaceChanges> {
		const oldSnapshot = this.snapshots.get(taskId) ?? new Map();
		const newSnapshot = await this.takeSnapshot(taskId, dir);

		const added: string[] = [];
		const modified: string[] = [];
		const deleted: string[] = [];

		for (const [file, newMeta] of newSnapshot) {
			const oldMeta = oldSnapshot.get(file);
			if (!oldMeta) {
				added.push(file);
			} else if (oldMeta.hash !== newMeta.hash) {
				modified.push(file);
			}
		}

		for (const file of oldSnapshot.keys()) {
			if (!newSnapshot.has(file)) {
				deleted.push(file);
			}
		}

		return { added, modified, deleted };
	}

	hasSnapshot(taskId: string): boolean {
		return this.snapshots.has(taskId);
	}

	clearSnapshot(taskId: string): void {
		this.snapshots.delete(taskId);
	}
}

export const manualChangesDetector = new ManualChangesDetector();
