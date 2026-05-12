import { useCallback, useState } from "react";
import {
	clearQueue,
	createTaskQueueState,
	dequeueTask,
	enqueueTask,
	pauseQueue,
	resumeQueue,
	setRunningTask,
	startNextTask,
	type TaskQueueState,
	toggleAutoExecute,
} from "@/state/task-queue";

export interface UseTaskQueueResult {
	queueState: TaskQueueState;
	enqueueTask: (taskId: string) => void;
	dequeueTask: (taskId: string) => void;
	startNextTask: () => string | null;
	pauseQueue: () => void;
	resumeQueue: () => void;
	toggleAutoExecute: () => void;
	setRunningTask: (taskId: string | null) => void;
	clearQueue: () => void;
	isTaskQueued: (taskId: string) => boolean;
	isTaskRunning: (taskId: string) => boolean;
	getTaskQueuePosition: (taskId: string) => number | null;
}

export function useTaskQueue(): UseTaskQueueResult {
	const [queueState, setQueueState] = useState<TaskQueueState>(createTaskQueueState);

	const handleEnqueueTask = useCallback((taskId: string) => {
		setQueueState((current) => enqueueTask(current, taskId));
	}, []);

	const handleDequeueTask = useCallback((taskId: string) => {
		setQueueState((current) => dequeueTask(current, taskId));
	}, []);

	const handleStartNextTask = useCallback(() => {
		let nextTaskId: string | null = null;
		setQueueState((current) => {
			const result = startNextTask(current);
			nextTaskId = result.nextTaskId;
			return result.state;
		});
		return nextTaskId;
	}, []);

	const handlePauseQueue = useCallback(() => {
		setQueueState((current) => pauseQueue(current));
	}, []);

	const handleResumeQueue = useCallback(() => {
		setQueueState((current) => resumeQueue(current));
	}, []);

	const handleToggleAutoExecute = useCallback(() => {
		setQueueState((current) => toggleAutoExecute(current));
	}, []);

	const handleSetRunningTask = useCallback((taskId: string | null) => {
		setQueueState((current) => setRunningTask(current, taskId));
	}, []);

	const handleClearQueue = useCallback(() => {
		setQueueState(clearQueue);
	}, []);

	const isTaskQueued = useCallback(
		(taskId: string) => {
			return queueState.queuedTaskIds.includes(taskId);
		},
		[queueState.queuedTaskIds],
	);

	const isTaskRunning = useCallback(
		(taskId: string) => {
			return queueState.runningTaskId === taskId;
		},
		[queueState.runningTaskId],
	);

	const getTaskQueuePosition = useCallback(
		(taskId: string) => {
			const index = queueState.queuedTaskIds.indexOf(taskId);
			return index >= 0 ? index + 1 : null;
		},
		[queueState.queuedTaskIds],
	);

	return {
		queueState,
		enqueueTask: handleEnqueueTask,
		dequeueTask: handleDequeueTask,
		startNextTask: handleStartNextTask,
		pauseQueue: handlePauseQueue,
		resumeQueue: handleResumeQueue,
		toggleAutoExecute: handleToggleAutoExecute,
		setRunningTask: handleSetRunningTask,
		clearQueue: handleClearQueue,
		isTaskQueued,
		isTaskRunning,
		getTaskQueuePosition,
	};
}
