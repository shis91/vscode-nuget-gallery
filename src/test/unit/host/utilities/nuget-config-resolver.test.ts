import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import NuGetConfigResolver, { SourceWithCredentials } from '../../../../host/utilities/nuget-config-resolver';
import PasswordScriptExecutor from '../../../../host/utilities/password-script-executor';
import CredentialsCache from '../../../../host/utilities/credentials-cache';

suite('NuGetConfigResolver Tests', () => {
    let tmpDir: string;
    let getConfigurationStub: sinon.SinonStub;
    let executeScriptStub: sinon.SinonStub;
    let credentialsCacheStub: sinon.SinonStub;
    let osHomedirStub: sinon.SinonStub;

    // Save original env vars
    const originalEnv = { ...process.env };

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-gallery-config-test-'));

        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
        executeScriptStub = sinon.stub(PasswordScriptExecutor, 'ExecuteScript');
        credentialsCacheStub = sinon.stub(CredentialsCache, 'set');

        // Mock os.homedir to isolate tests from user's actual config
        osHomedirStub = sinon.stub(os, 'homedir').returns(tmpDir);

        // Clear environment variables that might affect config resolution
        delete process.env.APPDATA;
        delete process.env.ProgramFiles;
        delete process.env['ProgramFiles(x86)'];
        // Also clear process.env.HOME if relevant (handled by os.homedir usually, but good to be safe)

        NuGetConfigResolver.ClearCache();
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        sinon.restore();

        // Restore env vars
        process.env = { ...originalEnv };
    });

    test('GetSourcesAndDecodePasswords resolves sources from workspace config', async () => {
        const nugetConfigPath = path.join(tmpDir, 'nuget.config');
        const xml = `
            <configuration>
                <packageSources>
                    <clear />
                    <add key="Test Source" value="https://test.source/v3/index.json" />
                </packageSources>
            </configuration>
        `;
        fs.writeFileSync(nugetConfigPath, xml);

        getConfigurationStub.returns({
            get: () => []
        });

        const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(tmpDir);

        assert.strictEqual(sources.length, 1);
        assert.strictEqual(sources[0].Name, 'Test Source');
        assert.strictEqual(sources[0].Url, 'https://test.source/v3/index.json');
    });

    test('GetSourcesAndDecodePasswords handles credentials in config', async () => {
        const nugetConfigPath = path.join(tmpDir, 'NuGet.Config');
        const xml = `
            <configuration>
                <packageSources>
                    <clear />
                    <add key="Private" value="https://private.source/v3/index.json" />
                </packageSources>
                <packageSourceCredentials>
                    <Private>
                        <add key="Username" value="user" />
                        <add key="Password" value="pass" />
                    </Private>
                </packageSourceCredentials>
            </configuration>
        `;
        fs.writeFileSync(nugetConfigPath, xml);

        getConfigurationStub.returns({
            get: () => []
        });

        const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(tmpDir);

        assert.strictEqual(sources.length, 1);
        assert.strictEqual(sources[0].Username, 'user');
        assert.strictEqual(sources[0].Password, 'pass');
        assert.ok(credentialsCacheStub.calledWith('Private', 'user', 'pass'));
    });

    test('GetSourcesAndDecodePasswords resolves sources from VS Code settings', async () => {
        getConfigurationStub.returns({
            get: (key: string) => {
                if (key === 'sources') {
                    return [JSON.stringify({ name: 'Settings Source', url: 'https://settings.source' })];
                }
                return undefined;
            }
        });

        // Ensure no other sources are found
        const nugetConfigPath = path.join(tmpDir, 'nuget.config');
        fs.writeFileSync(nugetConfigPath, '<configuration><packageSources><clear/></packageSources></configuration>');

        const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(tmpDir);

        assert.strictEqual(sources.length, 1);
        assert.strictEqual(sources[0].Name, 'Settings Source');
        assert.strictEqual(sources[0].Url, 'https://settings.source');
    });

    test('GetSourcesAndDecodePasswords handles password scripts', async () => {
         const nugetConfigPath = path.join(tmpDir, 'nuget.config');
        const xml = `
            <configuration>
                <packageSources>
                    <clear />
                    <add key="Script Source" value="https://script.source" />
                </packageSources>
                 <packageSourceCredentials>
                    <Script_x0020_Source>
                        <add key="Username" value="user" />
                        <add key="Password" value="encoded" />
                    </Script_x0020_Source>
                </packageSourceCredentials>
            </configuration>
        `;
        fs.writeFileSync(nugetConfigPath, xml);

        getConfigurationStub.returns({
            get: (key: string) => {
                if (key === 'sources') {
                    return [JSON.stringify({ name: 'Script Source', passwordScriptPath: '/path/to/script' })];
                }
                return undefined;
            }
        });

        executeScriptStub.resolves('decoded');

        const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(tmpDir);

        assert.strictEqual(sources[0].Password, 'decoded');
        assert.ok(executeScriptStub.calledWith('/path/to/script', 'encoded'));
        assert.ok(credentialsCacheStub.calledWith('Script Source', 'user', 'decoded'));
    });

    test('GetSourcesWithCredentials handles clear and disabled sources', () => {
        const nugetConfigPath = path.join(tmpDir, 'nuget.config');
        const xml = `
            <configuration>
                <packageSources>
                    <clear />
                    <add key="Source A" value="https://a.com" />
                    <add key="Source B" value="https://b.com" />
                </packageSources>
                <disabledPackageSources>
                    <add key="Source B" value="true" />
                </disabledPackageSources>
            </configuration>
        `;
        fs.writeFileSync(nugetConfigPath, xml);

        const sources = NuGetConfigResolver.GetSourcesWithCredentials(tmpDir);

        assert.strictEqual(sources.length, 1);
        assert.strictEqual(sources[0].Name, 'Source A');
    });

    test('FindAllConfigFiles respects priority (Workspace > User > Machine)', () => {
         // Create workspace config
         const workspaceConfig = path.join(tmpDir, 'nuget.config');
         fs.writeFileSync(workspaceConfig, '<configuration><packageSources><add key="Workspace" value="w" /></packageSources></configuration>');

         // Create user config (in the mocked homedir)
         const userNuGetDir = path.join(tmpDir, '.nuget', 'NuGet');
         fs.mkdirSync(userNuGetDir, { recursive: true });
         const userConfig = path.join(userNuGetDir, 'NuGet.Config');
         fs.writeFileSync(userConfig, '<configuration><packageSources><add key="User" value="u" /></packageSources></configuration>');

         const sources = NuGetConfigResolver.GetSourcesWithCredentials(tmpDir);

         // Should find both
         assert.strictEqual(sources.length, 2);
         const names = sources.map(s => s.Name).sort();
         assert.deepStrictEqual(names, ['User', 'Workspace']);
    });
});
