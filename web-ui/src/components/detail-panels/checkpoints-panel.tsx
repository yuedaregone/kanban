import { Clock, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getRuntimeTrpcClient } from "@/runtime/trpc-client";

interface CheckpointInfo {
	id: string;
	createdAt: number;
}

interface CheckpointsPanelProps {
	workspaceId: string | null;
	taskId: string;
	taskPath: string;
}

export function CheckpointsPanel({ workspaceId, taskId, taskPath }: CheckpointsPanelProps): React.ReactElement {
	const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isRestoring, setIsRestoring] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState<string | null>(null);

	const fetchCheckpoints = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const trpcClient = getRuntimeTrpcClient(workspaceId);
			const result = await trpcClient.workspace.listManualCheckpoints.query({ taskId });
			if (result.ok) {
				setCheckpoints(result.checkpoints);
			} else {
				setError("Failed to load checkpoints.");
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setIsLoading(false);
		}
	}, [workspaceId, taskId]);

	useEffect(() => {
		fetchCheckpoints();
	}, [fetchCheckpoints]);

	const handleCreateCheckpoint = useCallback(async () => {
		setIsCreating(true);
		setError(null);

		try {
			const trpcClient = getRuntimeTrpcClient(workspaceId);
			const result = await trpcClient.workspace.createManualCheckpoint.mutate({
				taskId,
				dir: taskPath,
			});
			if (result.ok) {
				await fetchCheckpoints();
			} else {
				setError("Failed to create checkpoint.");
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setIsCreating(false);
		}
	}, [workspaceId, taskId, taskPath, fetchCheckpoints]);

	const handleRestoreCheckpoint = useCallback(
		async (checkpointId: string) => {
			setIsRestoring(checkpointId);
			setError(null);

			try {
				const trpcClient = getRuntimeTrpcClient(workspaceId);
				const result = await trpcClient.workspace.restoreManualCheckpoint.mutate({
					taskId,
					checkpointId,
					dir: taskPath,
				});
				if (!result.ok) {
					setError("Failed to restore checkpoint.");
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setError(message);
			} finally {
				setIsRestoring(null);
			}
		},
		[workspaceId, taskId, taskPath],
	);

	const handleDeleteCheckpoint = useCallback(
		async (checkpointId: string) => {
			setIsDeleting(checkpointId);
			setError(null);

			try {
				const trpcClient = getRuntimeTrpcClient(workspaceId);
				const result = await trpcClient.workspace.deleteManualCheckpoint.mutate({
					taskId,
					checkpointId,
				});
				if (result.ok) {
					await fetchCheckpoints();
				} else {
					setError("Failed to delete checkpoint.");
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setError(message);
			} finally {
				setIsDeleting(null);
			}
		},
		[workspaceId, taskId, fetchCheckpoints],
	);

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleString();
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b border-border">
				<h3 className="text-sm font-semibold text-text-primary">
					Checkpoints
					{checkpoints.length > 0 && (
						<span className="ml-2 text-xs font-normal text-text-secondary">({checkpoints.length})</span>
					)}
				</h3>
				<Button
					variant="primary"
					size="sm"
					onClick={handleCreateCheckpoint}
					disabled={isCreating}
					icon={isCreating ? <Spinner size={14} /> : <Clock size={14} />}
				>
					Create Checkpoint
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-3">
				{error && <div className="rounded-md bg-status-red/10 px-3 py-2 text-xs text-status-red mb-3">{error}</div>}

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner size={24} />
					</div>
				) : checkpoints.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-text-tertiary">
						<Clock size={24} strokeWidth={1} />
						<p className="text-xs">No checkpoints yet.</p>
						<p className="text-xs">Create a checkpoint to save the current state.</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{checkpoints.map((checkpoint) => (
							<div
								key={checkpoint.id}
								className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-3"
							>
								<Clock size={16} className="shrink-0 text-text-secondary" />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-text-primary">Checkpoint {checkpoint.id}</p>
									<p className="text-xs text-text-tertiary">{formatTimestamp(checkpoint.createdAt)}</p>
								</div>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleRestoreCheckpoint(checkpoint.id)}
										disabled={isRestoring === checkpoint.id}
										icon={isRestoring === checkpoint.id ? <Spinner size={14} /> : <RotateCcw size={14} />}
									>
										Restore
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleDeleteCheckpoint(checkpoint.id)}
										disabled={isDeleting === checkpoint.id}
										icon={isDeleting === checkpoint.id ? <Spinner size={14} /> : <Trash2 size={14} />}
									>
										Delete
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
