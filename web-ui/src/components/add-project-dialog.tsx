import { FolderOpen, GitBranch, Search } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

import { showAppToast } from "@/components/app-toaster";
import { DirectoryAutocomplete } from "@/components/directory-autocomplete";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getRuntimeTrpcClient } from "@/runtime/trpc-client";
import { toServerAbsolute } from "@/utils/server-path";

type AddProjectTab = "path" | "clone";

export interface AddProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onProjectAdded: (projectId: string) => void;
	currentProjectId: string | null;
}

export function AddProjectDialog({
	open,
	onOpenChange,
	onProjectAdded,
	currentProjectId,
}: AddProjectDialogProps): ReactElement {
	const [activeTab, setActiveTab] = useState<AddProjectTab>("path");
	const [pathInput, setPathInput] = useState("");
	const [isAddingByPath, setIsAddingByPath] = useState(false);
	const [gitUrlInput, setGitUrlInput] = useState("");
	const [cloneDestInput, setCloneDestInput] = useState("");
	const [cloneFolderName, setCloneFolderName] = useState("");
	const [isCloning, setIsCloning] = useState(false);
	const pathInputRef = useRef<HTMLInputElement>(null);
	const gitUrlInputRef = useRef<HTMLInputElement>(null);
	const [serverRootPath, setServerRootPath] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		setActiveTab("path");
		setPathInput("/");
		setGitUrlInput("");
		setCloneDestInput("/");
		setCloneFolderName("");
		setIsAddingByPath(false);
		setIsCloning(false);

		const fetchRoot = async () => {
			try {
				const trpcClient = getRuntimeTrpcClient(currentProjectId);
				const response = await trpcClient.projects.listDirectoryContents.query({});
				if (response.ok && response.rootPath) {
					setServerRootPath(response.rootPath);
				}
			} catch {}
		};
		void fetchRoot();
	}, [open, currentProjectId]);

	useEffect(() => {
		if (!open || activeTab !== "clone") {
			return;
		}
		const timer = setTimeout(() => {
			gitUrlInputRef.current?.focus();
		}, 50);
		return () => clearTimeout(timer);
	}, [open, activeTab]);

	const resolveToAbsolutePath = useCallback(
		(relativePath: string): string => {
			const cleaned = relativePath.replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
			if (!serverRootPath) {
				return cleaned;
			}
			return toServerAbsolute(serverRootPath, cleaned);
		},
		[serverRootPath],
	);

	const handleAddByPath = useCallback(
		async (path: string) => {
			const absolutePath = resolveToAbsolutePath(path);
			if (!absolutePath) {
				return;
			}
			setIsAddingByPath(true);
			try {
				const trpcClient = getRuntimeTrpcClient(currentProjectId);
				const added = await trpcClient.projects.add.mutate({ path: absolutePath });
				if (!added.ok || !added.project) {
					throw new Error(added.error ?? "Could not add project.");
				}
				onProjectAdded(added.project.id);
				onOpenChange(false);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				showAppToast({ intent: "danger", icon: "warning-sign", message, timeout: 7000 });
			} finally {
				setIsAddingByPath(false);
			}
		},
		[currentProjectId, onOpenChange, onProjectAdded, resolveToAbsolutePath],
	);

	const handleClone = useCallback(async () => {
		const trimmedUrl = gitUrlInput.trim();
		if (!trimmedUrl) {
			return;
		}
		setIsCloning(true);
		try {
			const trpcClient = getRuntimeTrpcClient(currentProjectId);
			const mutationInput: { gitUrl: string; path?: string } = { gitUrl: trimmedUrl };
			const trimmedDest = cloneDestInput.trim();
			const trimmedFolder = cloneFolderName.trim();

			if (trimmedDest && trimmedDest !== "/") {
				const resolvedDest = resolveToAbsolutePath(trimmedDest);
				mutationInput.path = trimmedFolder ? toServerAbsolute(resolvedDest, trimmedFolder) : resolvedDest;
			} else if (trimmedFolder) {
				mutationInput.path = serverRootPath ? toServerAbsolute(serverRootPath, trimmedFolder) : trimmedFolder;
			}
			const added = await trpcClient.projects.add.mutate(mutationInput);
			if (!added.ok || !added.project) {
				throw new Error(added.error ?? "Clone failed.");
			}
			showAppToast({ intent: "success", message: "Repository cloned and added successfully.", timeout: 4000 });
			onProjectAdded(added.project.id);
			onOpenChange(false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showAppToast({ intent: "danger", icon: "warning-sign", message, timeout: 7000 });
		} finally {
			setIsCloning(false);
		}
	}, [
		cloneDestInput,
		cloneFolderName,
		currentProjectId,
		gitUrlInput,
		onOpenChange,
		onProjectAdded,
		resolveToAbsolutePath,
		serverRootPath,
	]);

	const handleDialogEscapeKeyDown = useCallback((event: KeyboardEvent) => {
		const active = document.activeElement;
		if (active instanceof HTMLInputElement) {
			event.preventDefault();
			if (active.role !== "combobox") {
				active.blur();
			}
		}
	}, []);

	const isBusy = isAddingByPath || isCloning;

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={(isOpen) => {
					if (!isOpen && isBusy) {
						return;
					}
					onOpenChange(isOpen);
				}}
				contentClassName="max-w-lg"
				contentAriaDescribedBy="add-project-dialog-description"
				onEscapeKeyDown={handleDialogEscapeKeyDown}
			>
				<DialogHeader title="Add Project" icon={<FolderOpen size={16} />} />
				<div className="flex flex-col gap-4 p-4 bg-surface-1">
					<div className="rounded-md bg-surface-2 p-1">
						<div className="grid grid-cols-2 gap-1">
							<button
								type="button"
								onClick={() => {
									setActiveTab("path");
								}}
								disabled={isBusy}
								className={cn(
									"cursor-pointer rounded-sm px-2 py-1 text-xs font-medium inline-flex items-center justify-center gap-1.5",
									activeTab === "path"
										? "bg-surface-4 text-text-primary"
										: "text-text-secondary hover:text-text-primary",
									isBusy && "cursor-not-allowed opacity-50",
								)}
							>
								<Search size={12} />
								Server Path
							</button>
							<button
								type="button"
								onClick={() => {
									setActiveTab("clone");
								}}
								disabled={isBusy}
								className={cn(
									"cursor-pointer rounded-sm px-2 py-1 text-xs font-medium inline-flex items-center justify-center gap-1.5",
									activeTab === "clone"
										? "bg-surface-4 text-text-primary"
										: "text-text-secondary hover:text-text-primary",
									isBusy && "cursor-not-allowed opacity-50",
								)}
							>
								<GitBranch size={12} />
								Git Clone
							</button>
						</div>
					</div>

					{activeTab === "path" ? (
						<PathTabContent
							pathInput={pathInput}
							setPathInput={setPathInput}
							pathInputRef={pathInputRef}
							isAddingByPath={isAddingByPath}
							onSubmitPath={() => void handleAddByPath(pathInput)}
							currentProjectId={currentProjectId}
						/>
					) : (
						<CloneTabContent
							gitUrlInput={gitUrlInput}
							setGitUrlInput={setGitUrlInput}
							cloneDestInput={cloneDestInput}
							setCloneDestInput={setCloneDestInput}
							cloneFolderName={cloneFolderName}
							setCloneFolderName={setCloneFolderName}
							gitUrlInputRef={gitUrlInputRef}
							isCloning={isCloning}
							onSubmitClone={() => void handleClone()}
							currentProjectId={currentProjectId}
						/>
					)}
				</div>
				<DialogFooter>
					<Button variant="default" onClick={() => onOpenChange(false)} disabled={isBusy}>
						Cancel
					</Button>
					{activeTab === "path" ? (
						<Button
							variant="primary"
							onClick={() => void handleAddByPath(pathInput)}
							disabled={pathInput.trim() === "/" || isAddingByPath}
						>
							{isAddingByPath ? (
								<>
									<Spinner size={14} />
									Adding...
								</>
							) : (
								"Add Project"
							)}
						</Button>
					) : (
						<Button
							variant="primary"
							onClick={() => void handleClone()}
							disabled={!gitUrlInput.trim() || isCloning}
						>
							{isCloning ? (
								<>
									<Spinner size={14} />
									Cloning...
								</>
							) : (
								"Clone & Add"
							)}
						</Button>
					)}
				</DialogFooter>
			</Dialog>
		</>
	);
}

function PathTabContent({
	pathInput,
	setPathInput,
	pathInputRef,
	isAddingByPath,
	onSubmitPath,
	currentProjectId,
}: {
	pathInput: string;
	setPathInput: (value: string) => void;
	pathInputRef: React.RefObject<HTMLInputElement>;
	isAddingByPath: boolean;
	onSubmitPath: () => void;
	currentProjectId: string | null;
}): ReactElement {
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmitPath();
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-3">
			<div>
				<span className="block text-[12px] text-text-secondary mb-1.5">Directory path</span>
				<DirectoryAutocomplete
					inputRef={pathInputRef}
					value={pathInput}
					onChange={setPathInput}
					placeholder="Search directories…"
					disabled={isAddingByPath}
					id="add-project-path-input"
					ariaLabel="Server path input"
					workspaceId={currentProjectId}
				/>
			</div>
			<p id="add-project-dialog-description" className="sr-only">
				Add a project by entering a server path, browsing the remote filesystem, or cloning a git repository.
			</p>
		</form>
	);
}

function deriveRepoNameFromUrl(gitUrl: string): string {
	const trimmed = gitUrl.trim().replace(/\/+$/, "");
	if (!trimmed) {
		return "";
	}
	const sshMatch = trimmed.match(/^[^@]+@[^:]+:(.+)$/);
	const pathPart = sshMatch?.[1] ?? trimmed;
	const lastSegment = pathPart.split("/").pop() ?? "";
	return lastSegment.endsWith(".git") ? lastSegment.slice(0, -4) : lastSegment;
}

function CloneTabContent({
	gitUrlInput,
	setGitUrlInput,
	cloneDestInput,
	setCloneDestInput,
	cloneFolderName,
	setCloneFolderName,
	gitUrlInputRef,
	isCloning,
	onSubmitClone,
	currentProjectId,
}: {
	gitUrlInput: string;
	setGitUrlInput: (value: string) => void;
	cloneDestInput: string;
	setCloneDestInput: (value: string) => void;
	cloneFolderName: string;
	setCloneFolderName: (value: string) => void;
	gitUrlInputRef: React.RefObject<HTMLInputElement>;
	isCloning: boolean;
	onSubmitClone: () => void;
	currentProjectId: string | null;
}): ReactElement {
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmitClone();
	};

	const derivedName = deriveRepoNameFromUrl(gitUrlInput);

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-3">
			<div>
				<label htmlFor="add-project-git-url-input" className="block text-[12px] text-text-secondary mb-1.5">
					Git repository URL
				</label>
				<input
					ref={gitUrlInputRef}
					type="text"
					id="add-project-git-url-input"
					value={gitUrlInput}
					onChange={(e) => setGitUrlInput(e.target.value)}
					placeholder="e.g. https://github.com/user/repo.git"
					className="w-full h-8 px-2.5 text-[13px] font-mono rounded-md border border-border bg-surface-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
					disabled={isCloning}
					aria-label="Git URL input"
				/>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<div>
					<span className="block text-[12px] text-text-secondary mb-1.5">Clone into</span>
					<DirectoryAutocomplete
						value={cloneDestInput}
						onChange={setCloneDestInput}
						placeholder="Search directories…"
						disabled={isCloning}
						id="add-project-clone-dest-input"
						ariaLabel="Clone destination path"
						workspaceId={currentProjectId}
					/>
				</div>
				<div>
					<label htmlFor="add-project-folder-name-input" className="block text-[12px] text-text-secondary mb-1.5">
						Folder name
					</label>
					<input
						type="text"
						id="add-project-folder-name-input"
						value={cloneFolderName}
						onChange={(e) => setCloneFolderName(e.target.value.replace(/[\\/]/g, ""))}
						placeholder={derivedName || "repo-name"}
						className="w-full h-8 px-2.5 text-[13px] font-mono rounded-md border border-border bg-surface-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
						disabled={isCloning}
						aria-label="Clone folder name"
					/>
				</div>
			</div>
			{isCloning ? (
				<div className="flex items-center gap-2 text-[13px] text-text-secondary">
					<Spinner size={14} />
					Cloning repository... This may take a moment.
				</div>
			) : null}
		</form>
	);
}
