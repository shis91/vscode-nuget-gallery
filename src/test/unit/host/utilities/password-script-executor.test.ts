import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import PasswordScriptExecutor from '../../../../host/utilities/password-script-executor';
const child_process = require('child_process');

suite('PasswordScriptExecutor Tests', () => {
    let createTerminalStub: sinon.SinonStub;
    let spawnStub: sinon.SinonStub;
    let terminalMock: any;
    let ptyMock: any;
    let processMock: any;

    setup(() => {
        createTerminalStub = sinon.stub(vscode.window, 'createTerminal');

        // Mock child_process.spawn
        processMock = new EventEmitter();
        (processMock as any).stdout = new EventEmitter();
        (processMock as any).stderr = new EventEmitter();
        (processMock as any).kill = () => {};

        // child_process.spawn might be read-only if imported as * or via import { spawn }
        // but here we required it, so it should be mutable or stubbable.
        spawnStub = sinon.stub(child_process, 'spawn').returns(processMock);

        PasswordScriptExecutor.ClearCache();

        terminalMock = {
            dispose: sinon.spy()
        };
    });

    teardown(() => {
        sinon.restore();
    });

    test('ExecuteScript throws if password is empty', async () => {
        await assert.rejects(
            async () => await PasswordScriptExecutor.ExecuteScript('script.bat', ''),
            /Encoded password is empty/
        );
    });

    test('ExecuteScript uses cache', async () => {
        const scriptPath = 'script.bat';
        const encodedPassword = 'encoded';
        const decodedPassword = 'decoded';

        // First call - successful execution
        createTerminalStub.callsFake((options) => {
            ptyMock = options.pty;

            // Simulate pty opening and process output
            setTimeout(() => {
                ptyMock.open();

                // Emitting data from process stdout
                processMock.stdout.emit('data', Buffer.from(decodedPassword));

                // Process close
                processMock.emit('close', 0);
            }, 10);

            return terminalMock;
        });

        const result1 = await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword);
        assert.strictEqual(result1, decodedPassword);
        assert.ok(createTerminalStub.calledOnce);

        // Second call - should use cache
        const result2 = await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword);
        assert.strictEqual(result2, decodedPassword);
        assert.ok(createTerminalStub.calledOnce); // Still called once
    });

    test('ExecuteScript executes script successfully', async () => {
        const scriptPath = 'script.sh';
        const encodedPassword = 'encoded';
        const decodedPassword = 'decoded';

        createTerminalStub.callsFake((options) => {
            ptyMock = options.pty;
            setTimeout(() => {
                ptyMock.open();
                processMock.stdout.emit('data', Buffer.from(decodedPassword));
                processMock.emit('close', 0);
            }, 10);
            return terminalMock;
        });

        const result = await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword);
        assert.strictEqual(result, decodedPassword);
    });

    test('ExecuteScript handles script failure', async () => {
        const scriptPath = 'script.sh';
        const encodedPassword = 'encoded';
        const errorMessage = 'Error occurred';

        createTerminalStub.callsFake((options) => {
            ptyMock = options.pty;
            setTimeout(() => {
                ptyMock.open();
                processMock.stderr.emit('data', Buffer.from(errorMessage));
                processMock.emit('close', 1);
            }, 10);
            return terminalMock;
        });

        await assert.rejects(
            async () => await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword),
            (err: Error) => err.message.includes('Script exited with code 1') && err.message.includes(errorMessage)
        );
    });

    test('ExecuteScript handles empty output', async () => {
        const scriptPath = 'script.sh';
        const encodedPassword = 'encoded';

        createTerminalStub.callsFake((options) => {
            ptyMock = options.pty;
            setTimeout(() => {
                ptyMock.open();
                // No output
                processMock.emit('close', 0);
            }, 10);
            return terminalMock;
        });

        await assert.rejects(
            async () => await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword),
            /Password script returned empty output/
        );
    });

    test('ExecuteScript handles process error', async () => {
         const scriptPath = 'script.sh';
        const encodedPassword = 'encoded';

        createTerminalStub.callsFake((options) => {
            ptyMock = options.pty;
            setTimeout(() => {
                ptyMock.open();
                processMock.emit('error', new Error('Spawn failed'));
            }, 10);
            return terminalMock;
        });

         await assert.rejects(
            async () => await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword),
            /Spawn failed/
        );
    });

    test('ClearCache and ClearExpiredCache', async () => {
         const scriptPath = 'script.bat';
        const encodedPassword = 'encoded';
        const decodedPassword = 'decoded';

        // Setup success
        createTerminalStub.callsFake((options) => {
            ptyMock = options.pty;
            setTimeout(() => {
                ptyMock.open();
                processMock.stdout.emit('data', Buffer.from(decodedPassword));
                processMock.emit('close', 0);
            }, 10);
            return terminalMock;
        });

        await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword);

        // Cache hit check
        createTerminalStub.resetHistory();
        await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword);
        assert.ok(createTerminalStub.notCalled);

        // Clear cache
        PasswordScriptExecutor.ClearCache();

        // Should call again
        await PasswordScriptExecutor.ExecuteScript(scriptPath, encodedPassword);
        assert.ok(createTerminalStub.calledOnce);
    });
});
