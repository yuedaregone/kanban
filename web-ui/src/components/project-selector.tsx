import { ChevronDown, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

interface ProjectSelectorProps {
	projects: Array<{ id: string; name: string; rootPath: string }>;
	selectedProjectId: string | null;
	onSelectProject: (projectId: string) => void;
	onCreateProject?: () => void;
	disabled?: boolean;
}

export function ProjectSelector({
	projects,
	selectedProjectId,
	onSelectProject,
	onCreateProject,
	disabled = false,
}: ProjectSelectorProps): React.ReactElement | null {
	const [isOpen, setIsOpen] = useState(false);

	if (projects.length === 0 && !onCreateProject) {
		return null;
	}

	const selectedProject = projects.find((p) => p.id === selectedProjectId);

	return (
		<div className="relative">
			<Button
				variant="default"
				size="sm"
				icon={<FolderOpen size={14} />}
				onClick={() => setIsOpen(!isOpen)}
				disabled={disabled}
				className="kb-navbar-btn"
			>
				<span className="truncate max-w-[150px]">{selectedProject?.name ?? "Select Project"}</span>
				<ChevronDown size={12} className="ml-1" />
			</Button>

			{isOpen && (
				<div
					className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-md border border-border bg-surface-2 shadow-lg"
					onMouseLeave={() => setIsOpen(false)}
				>
					<div className="py-1">
						{projects.map((project) => (
							<button
								key={project.id}
								type="button"
								className={cn(
									"w-full px-3 py-2 text-left text-sm hover:bg-surface-3",
									project.id === selectedProjectId && "bg-surface-3",
								)}
								onClick={() => {
									onSelectProject(project.id);
									setIsOpen(false);
								}}
							>
								<div className="font-medium text-text-primary">{project.name}</div>
								<div className="text-xs text-text-tertiary truncate">{project.rootPath}</div>
							</button>
						))}

						{onCreateProject && (
							<>
								<div className="border-t border-border my-1" />
								<button
									type="button"
									className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-3 flex items-center gap-2"
									onClick={() => {
										onCreateProject();
										setIsOpen(false);
									}}
								>
									<Plus size={14} />
									Add Project
								</button>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
