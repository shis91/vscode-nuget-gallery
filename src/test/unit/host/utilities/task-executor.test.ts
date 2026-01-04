import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { TaskExecutor } from '../../../../host/utilities/task-executor';

// Helper to wait for a condition to be true
async function waitForCondition(condition: () => boolean, timeout: number = 2000, interval: number = 10): Promise<void> {
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

        await waitForCondition(() => executeTaskStub.called);
        assert.strictEqual(completed, false);

        await waitForCondition(() => !!taskEndCallback);

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

        executeTaskStub.callsFake(async (t: vscode.Task) => {
            if (t.name === 'Task 1') {
                task1Started = true;
                return execution1;
            } else if (t.name === 'Task 2') {
                task2Started = true;
                return execution2;
            } else {
                console.error('Unknown task:', t.name);
                return undefined;
            }
        });

        const promise1 = taskExecutor.ExecuteTask(task1);
        const promise2 = taskExecutor.ExecuteTask(task2);

        // Wait for Task 1 to start
        try {
            await waitForCondition(() => task1Started);
        } catch (e) {
            console.error('Timeout waiting for Task 1 to start. task1Started:', task1Started);
            console.error('executeTaskStub call count:', executeTaskStub.callCount);
            if (executeTaskStub.callCount > 0) {
                 console.error('Call args:', executeTaskStub.getCall(0).args);
            }
            throw e;
        }

        assert.strictEqual(task1Started, true);

        // Ensure Task 2 has NOT started yet
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
