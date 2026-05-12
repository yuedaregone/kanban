import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";

import { createGitProcessEnv } from "../core/git-process-env";

export async function isGitRepository(path: string): Promise<boolean> {
	try {
		const gitDir = join(path, ".git");
		await access(gitDir);
		return true;
	} catch {
		// .git doesn't exist, but it could be a worktree with a .git file
		try {
			const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
				cwd: path,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				env: createGitProcessEnv(),
				timeout: 5000,
			});
			return result.status === 0 && result.stdout.trim() === "true";
		} catch {
			return false;
		}
	}
}

export function isGitRepositorySync(path: string): boolean {
	try {
		const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
			cwd: path,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			env: createGitProcessEnv(),
			timeout: 5000,
		});
		return result.status === 0 && result.stdout.trim() === "true";
	} catch {
		return false;
	}
}
