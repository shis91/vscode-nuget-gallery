import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { TaskExecutor } from '../../../../host/utilities/task-executor';

// Helper to wait for a condition to be true
async function waitForCondition(condition: () => boolean, timeout: number = 1000, interval: number = 10): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
}

suite('TaskExecutor Tests', () => {
    let executeTaskStub: sinon.SinonStub;
    let onDidEndTaskStub: sinon.SinonStub;
    let taskExecutor: TaskExecutor;

    setup(() => {
        executeTaskStub = sinon.stub(vscode.tasks, 'executeTask');
        onDidEndTaskStub = sinon.stub(vscode.tasks, 'onDidEndTask');
        taskExecutor = new TaskExecutor();
    });

    teardown(() => {
        sinon.restore();
    });

    test('ExecuteTask executes a task', async () => {
        const task = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'Test Task',
            'test',
            new vscode.ShellExecution('echo test')
        );

        const execution = {
            task: task,
            terminate: () => {}
        } as unknown as vscode.TaskExecution;

        executeTaskStub.resolves(execution);

        let taskEndCallback: (e: vscode.TaskEndEvent) => void;
        onDidEndTaskStub.callsFake((callback) => {
            taskEndCallback = callback;

            // Trigger completion after a short delay to simulate async task duration
            setTimeout(() => {
                if (taskEndCallback) {
                    taskEndCallback({ execution } as vscode.TaskEndEvent);
                }
            }, 10);

            return { dispose: () => {} };
        });

        await taskExecutor.ExecuteTask(task);

        assert.ok(executeTaskStub.calledOnceWith(task));
    });

    test('ExecuteTask executes a process task', async () => {
        const task = new vscode.Task(
            { type: 'process' },
            vscode.TaskScope.Workspace,
            'Test Process Task',
            'test',
            new vscode.ProcessExecution('ls', ['-la'])
        );

        const execution = {
            task: task,
            terminate: () => {}
        } as unknown as vscode.TaskExecution;

        executeTaskStub.resolves(execution);

        let taskEndCallback: (e: vscode.TaskEndEvent) => void;
        onDidEndTaskStub.callsFake((callback) => {
            taskEndCallback = callback;
             // Trigger completion
             setTimeout(() => {
                if (taskEndCallback) {
                    taskEndCallback({ execution } as vscode.TaskEndEvent);
                }
            }, 10);
            return { dispose: () => {} };
        });

        await taskExecutor.ExecuteTask(task);

        assert.ok(executeTaskStub.calledOnceWith(task));
    });

    test('ExecuteTask waits for task completion', async () => {
        const task = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'Test Task',
            'test',
            new vscode.ShellExecution('echo test')
        );

        const execution = {
            task: task,
            terminate: () => {}
        } as unknown as vscode.TaskExecution;

        executeTaskStub.resolves(execution);

        let taskEndCallback: ((e: vscode.TaskEndEvent) => void) | undefined;
        onDidEndTaskStub.callsFake((callback) => {
            taskEndCallback = callback;
            return { dispose: () => {} };
        });

        let completed = false;
        const promise = taskExecutor.ExecuteTask(task).then(() => {
            completed = true;
        });

        // Verify executeTask was called but promise not resolved yet
        await waitForCondition(() => executeTaskStub.called);
        assert.strictEqual(completed, false);

        // Verify callback was registered
        await waitForCondition(() => !!taskEndCallback);

        // Simulate task completion
        if (taskEndCallback!) {
             taskEndCallback!({ execution } as vscode.TaskEndEvent);
        }

        await promise;
        assert.strictEqual(completed, true);
    });

    test('ExecuteTask runs tasks sequentially', async () => {
        const task1 = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'Task 1',
            'test',
            new vscode.ShellExecution('echo 1')
        );

        const task2 = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'Task 2',
            'test',
            new vscode.ShellExecution('echo 2')
        );

        const execution1 = { task: task1 } as vscode.TaskExecution;
        const execution2 = { task: task2 } as vscode.TaskExecution;

        executeTaskStub.withArgs(task1).resolves(execution1);
        executeTaskStub.withArgs(task2).resolves(execution2);

        const listeners: ((e: vscode.TaskEndEvent) => void)[] = [];
        onDidEndTaskStub.callsFake((callback) => {
            listeners.push(callback);
            return { dispose: () => {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            } };
        });

        let task1Started = false;
        let task2Started = false;

        executeTaskStub.callsFake(async (t) => {
            if (t === task1) {
                task1Started = true;
                return execution1;
            } else if (t === task2) {
                task2Started = true;
                return execution2;
            }
        });

        const promise1 = taskExecutor.ExecuteTask(task1);
        const promise2 = taskExecutor.ExecuteTask(task2);

        // Wait for Task 1 to start
        await waitForCondition(() => task1Started);
        assert.strictEqual(task1Started, true);

        // Ensure Task 2 has NOT started yet (give it a moment to potentially race)
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(task2Started, false, 'Task 2 should not start while Task 1 is running');

        // Complete task 1
        listeners.forEach(l => l({ execution: execution1 } as vscode.TaskEndEvent));

        await promise1;

        // Now Task 2 should start
        await waitForCondition(() => task2Started);
        assert.strictEqual(task2Started, true);

        // Complete task 2
        listeners.forEach(l => l({ execution: execution2 } as vscode.TaskEndEvent));

        await promise2;
    });
});
