import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import TaskExecutor from '../../../../host/utilities/task-executor';

suite('TaskExecutor Tests', () => {
    let executeTaskStub: sinon.SinonStub;
    let onDidEndTaskStub: sinon.SinonStub;

    setup(() => {
        executeTaskStub = sinon.stub(vscode.tasks, 'executeTask');
        onDidEndTaskStub = sinon.stub(vscode.tasks, 'onDidEndTask');
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
            return { dispose: () => {} };
        });

        const promise = TaskExecutor.ExecuteTask(task);

        // Simulate task completion
        setTimeout(() => {
            if (taskEndCallback) {
                taskEndCallback({ execution } as vscode.TaskEndEvent);
            }
        }, 10);

        await promise;

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
            return { dispose: () => {} };
        });

        const promise = TaskExecutor.ExecuteTask(task);

        // Simulate task completion
        setTimeout(() => {
            if (taskEndCallback) {
                taskEndCallback({ execution } as vscode.TaskEndEvent);
            }
        }, 10);

        await promise;

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

        let taskEndCallback: (e: vscode.TaskEndEvent) => void;
        onDidEndTaskStub.callsFake((callback) => {
            taskEndCallback = callback;
            return { dispose: () => {} };
        });

        let completed = false;
        const promise = TaskExecutor.ExecuteTask(task).then(() => {
            completed = true;
        });

        assert.strictEqual(completed, false);

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

        let taskEndCallback: (e: vscode.TaskEndEvent) => void;
        onDidEndTaskStub.callsFake((callback) => {
            // Only capture the first one, or manage multiple listeners?
            // The implementation calls onDidEndTask for each ExecuteTask call.
            // So we need to handle multiple listeners.
            return { dispose: () => {} };
        });

        // We need a more sophisticated stub for onDidEndTask to handle multiple subscriptions
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

        const promise1 = TaskExecutor.ExecuteTask(task1);
        const promise2 = TaskExecutor.ExecuteTask(task2);

        // Allow some time for task1 to start
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(task1Started, true);
        assert.strictEqual(task2Started, false); // Should be waiting

        // Complete task 1
        listeners.forEach(l => l({ execution: execution1 } as vscode.TaskEndEvent));

        await promise1;

        // Allow some time for task2 to start
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(task2Started, true);

        // Complete task 2
        listeners.forEach(l => l({ execution: execution2 } as vscode.TaskEndEvent));

        await promise2;
    });
});
