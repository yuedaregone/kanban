export interface TaskQueueState {
	queuedTaskIds: string[];
	runningTaskId: string | null;
	autoExecuteEnabled: boolean;
	isPaused: boolean;
}

export interface TaskQueueActions {
	enqueueTask: (taskId: string) => void;
	dequeueTask: (taskId: string) => void;
	startNextTask: () => string | null;
	pauseQueue: () => void;
	resumeQueue: () => void;
	toggleAutoExecute: () => void;
	setRunningTask: (taskId: string | null) => void;
	clearQueue: () => void;
}

export function createTaskQueueState(): TaskQueueState {
	return {
		queuedTaskIds: [],
		runningTaskId: null,
		autoExecuteEnabled: false,
		isPaused: false,
	};
}

export function enqueueTask(state: TaskQueueState, taskId: string): TaskQueueState {
	if (state.queuedTaskIds.includes(taskId) || state.runningTaskId === taskId) {
		return state;
	}
	return {
		...state,
		queuedTaskIds: [...state.queuedTaskIds, taskId],
	};
}

export function dequeueTask(state: TaskQueueState, taskId: string): TaskQueueState {
	return {
		...state,
		queuedTaskIds: state.queuedTaskIds.filter((id) => id !== taskId),
	};
}

export function startNextTask(state: TaskQueueState): { state: TaskQueueState; nextTaskId: string | null } {
	if (state.isPaused || state.runningTaskId !== null) {
		return { state, nextTaskId: null };
	}
	if (state.queuedTaskIds.length === 0) {
		return { state, nextTaskId: null };
	}
	const [nextTaskId, ...remainingTasks] = state.queuedTaskIds;
	return {
		state: {
			...state,
			queuedTaskIds: remainingTasks,
			runningTaskId: nextTaskId,
		},
		nextTaskId,
	};
}

export function pauseQueue(state: TaskQueueState): TaskQueueState {
	return {
		...state,
		isPaused: true,
	};
}

export function resumeQueue(state: TaskQueueState): TaskQueueState {
	return {
		...state,
		isPaused: false,
	};
}

export function toggleAutoExecute(state: TaskQueueState): TaskQueueState {
	return {
		...state,
		autoExecuteEnabled: !state.autoExecuteEnabled,
	};
}

export function setRunningTask(state: TaskQueueState, taskId: string | null): TaskQueueState {
	return {
		...state,
		runningTaskId: taskId,
	};
}

export function clearQueue(state: TaskQueueState): TaskQueueState {
	return {
		...state,
		queuedTaskIds: [],
		runningTaskId: null,
		isPaused: false,
	};
}
