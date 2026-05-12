import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getRuntimeTrpcClient } from "@/runtime/trpc-client";
import type { ProjectConfig } from "@/workspace/types";

interface ProjectsSettingsProps {
	workspaceId: string | null;
	projects: ProjectConfig[];
	onProjectsChange: () => void;
}

export function ProjectsSettings({
	workspaceId,
	projects,
	onProjectsChange,
}: ProjectsSettingsProps): React.ReactElement {
	const [isAdding, setIsAdding] = useState(false);
	const [newProjectPath, setNewProjectPath] = useState("");
	const [newProjectName, setNewProjectName] = useState("");
	const [newProjectMode, setNewProjectMode] = useState<"git" | "manual">("manual");
	const [error, setError] = useState<string | null>(null);
	const [isRemoving, setIsRemoving] = useState<string | null>(null);

	const handleAddProject = useCallback(async () => {
		if (!newProjectPath.trim()) {
			setError("Project path is required.");
			return;
		}

		setIsAdding(true);
		setError(null);

		try {
			const trpcClient = getRuntimeTrpcClient(workspaceId);
			const result = await trpcClient.projects.add.mutate({
				path: newProjectPath.trim(),
				mode: newProjectMode,
			});

			if (result.ok) {
				setNewProjectPath("");
				setNewProjectName("");
				onProjectsChange();
			} else {
				setError(result.error ?? "Failed to add project.");
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setIsAdding(false);
		}
	}, [newProjectPath, workspaceId, onProjectsChange]);

	const handleRemoveProject = useCallback(
		async (projectId: string) => {
			setIsRemoving(projectId);
			setError(null);

			try {
				const trpcClient = getRuntimeTrpcClient(workspaceId);
				const result = await trpcClient.projects.remove.mutate({ projectId });

				if (result.ok) {
					onProjectsChange();
				} else {
					setError(result.error ?? "Failed to remove project.");
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setError(message);
			} finally {
				setIsRemoving(null);
			}
		},
		[workspaceId, onProjectsChange],
	);

	const handlePickDirectory = useCallback(async () => {
		try {
			const trpcClient = getRuntimeTrpcClient(workspaceId);
			const result = await trpcClient.projects.pickDirectory.mutate();

			if (result.ok && result.path) {
				setNewProjectPath(result.path);
				const pathParts = result.path.split(/[/\\]/).filter(Boolean);
				const dirName = pathParts[pathParts.length - 1] ?? "";
				setNewProjectName(dirName);
			}
		} catch {
			// Ignore errors from directory picker
		}
	}, [workspaceId]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-text-primary">Projects</h3>
			</div>

			<p className="text-xs text-text-secondary">
				Configure projects. Choose Git Worktree mode (uses git for version control) or Manual Directory mode (plain
				folder, no git).
			</p>

			{/* Add project form */}
			<div className="flex flex-col gap-2 rounded-md border border-border p-3">
				<div className="flex gap-2">
					<input
						type="text"
						value={newProjectPath}
						onChange={(e) => setNewProjectPath(e.target.value)}
						placeholder="Project path (e.g., /home/user/my-project)"
						className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
					/>
					<Button variant="ghost" size="sm" onClick={handlePickDirectory}>
						Browse
					</Button>
				</div>
				<input
					type="text"
					value={newProjectName}
					onChange={(e) => setNewProjectName(e.target.value)}
					placeholder="Project name (optional)"
					className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
				/>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setNewProjectMode("git")}
						className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
							newProjectMode === "git"
								? "border-accent bg-accent/10 text-accent"
								: "border-border bg-surface-2 text-text-secondary hover:bg-surface-3"
						}`}
					>
						Git Worktree
					</button>
					<button
						type="button"
						onClick={() => setNewProjectMode("manual")}
						className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
							newProjectMode === "manual"
								? "border-accent bg-accent/10 text-accent"
								: "border-border bg-surface-2 text-text-secondary hover:bg-surface-3"
						}`}
					>
						Manual Directory
					</button>
				</div>
				<Button
					variant="primary"
					size="sm"
					onClick={handleAddProject}
					disabled={isAdding || !newProjectPath.trim()}
					icon={isAdding ? <Spinner size={14} /> : <Plus size={14} />}
				>
					Add Project
				</Button>
			</div>

			{error && <div className="rounded-md bg-status-red/10 px-3 py-2 text-xs text-status-red">{error}</div>}

			{/* Project list */}
			<div className="flex flex-col gap-2">
				{projects.length === 0 ? (
					<div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-text-tertiary">
						<FolderOpen size={24} strokeWidth={1} />
						<p className="text-xs">No projects configured yet.</p>
					</div>
				) : (
					projects.map((project) => (
						<div
							key={project.id}
							className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3"
						>
							<FolderOpen size={16} className="shrink-0 text-text-secondary" />
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<p className="text-sm font-medium text-text-primary truncate">{project.name}</p>
									<span
										className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
											project.mode === "manual"
												? "bg-status-blue/15 text-status-blue"
												: "bg-status-green/15 text-status-green"
										}`}
									>
										{project.mode === "manual" ? "Manual" : "Git"}
									</span>
								</div>
								<p className="text-xs text-text-tertiary truncate">{project.rootPath}</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleRemoveProject(project.id)}
								disabled={isRemoving === project.id}
								icon={isRemoving === project.id ? <Spinner size={14} /> : <Trash2 size={14} />}
							>
								Remove
							</Button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
