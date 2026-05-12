import { FileDiff, FilePlus, FileX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getRuntimeTrpcClient } from "@/runtime/trpc-client";
import type { ManualWorkspaceChanges } from "@/workspace/types";

interface ManualChangesPanelProps {
	workspaceId: string | null;
	taskId: string;
	taskPath: string;
}

export function ManualChangesPanel({ workspaceId, taskId, taskPath }: ManualChangesPanelProps): React.ReactElement {
	const [changes, setChanges] = useState<ManualWorkspaceChanges | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchChanges = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const trpcClient = getRuntimeTrpcClient(workspaceId);
			const result = await trpcClient.workspace.getManualWorkspaceChanges.query({
				taskId,
				dir: taskPath,
			});
			setChanges(result);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setIsLoading(false);
		}
	}, [workspaceId, taskId, taskPath]);

	const takeSnapshot = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const trpcClient = getRuntimeTrpcClient(workspaceId);
			await trpcClient.workspace.takeManualSnapshot.mutate({
				taskId,
				dir: taskPath,
			});
			// After taking snapshot, fetch changes
			await fetchChanges();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setIsLoading(false);
		}
	}, [workspaceId, taskId, taskPath, fetchChanges]);

	useEffect(() => {
		fetchChanges();
	}, [fetchChanges]);

	const totalChanges = changes ? changes.added.length + changes.modified.length + changes.deleted.length : 0;

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b border-border">
				<h3 className="text-sm font-semibold text-text-primary">
					File Changes
					{totalChanges > 0 && (
						<span className="ml-2 text-xs font-normal text-text-secondary">
							({totalChanges} {totalChanges === 1 ? "file" : "files"})
						</span>
					)}
				</h3>
				<div className="flex gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={takeSnapshot}
						disabled={isLoading}
						icon={isLoading ? <Spinner size={14} /> : <RefreshCw size={14} />}
					>
						Take Snapshot
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={fetchChanges}
						disabled={isLoading}
						icon={isLoading ? <Spinner size={14} /> : <RefreshCw size={14} />}
					>
						Refresh
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-3">
				{error && <div className="rounded-md bg-status-red/10 px-3 py-2 text-xs text-status-red mb-3">{error}</div>}

				{isLoading && !changes ? (
					<div className="flex items-center justify-center py-8">
						<Spinner size={24} />
					</div>
				) : !changes || totalChanges === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-text-tertiary">
						<FileDiff size={24} strokeWidth={1} />
						<p className="text-xs">No file changes detected.</p>
						<p className="text-xs">Take a snapshot to start tracking changes.</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{/* Added files */}
						{changes.added.length > 0 && (
							<div>
								<h4 className="text-xs font-semibold text-status-green mb-1">Added ({changes.added.length})</h4>
								{changes.added.map((file) => (
									<div key={file} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-3">
										<FilePlus size={14} className="shrink-0 text-status-green" />
										<span className="text-xs text-text-primary truncate">{file}</span>
									</div>
								))}
							</div>
						)}

						{/* Modified files */}
						{changes.modified.length > 0 && (
							<div>
								<h4 className="text-xs font-semibold text-status-orange mb-1">
									Modified ({changes.modified.length})
								</h4>
								{changes.modified.map((file) => (
									<div key={file} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-3">
										<FileDiff size={14} className="shrink-0 text-status-orange" />
										<span className="text-xs text-text-primary truncate">{file}</span>
									</div>
								))}
							</div>
						)}

						{/* Deleted files */}
						{changes.deleted.length > 0 && (
							<div>
								<h4 className="text-xs font-semibold text-status-red mb-1">
									Deleted ({changes.deleted.length})
								</h4>
								{changes.deleted.map((file) => (
									<div key={file} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-3">
										<FileX size={14} className="shrink-0 text-status-red" />
										<span className="text-xs text-text-primary truncate">{file}</span>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
