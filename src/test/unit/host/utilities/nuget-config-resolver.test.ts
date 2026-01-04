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

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-gallery-config-test-'));

        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
        executeScriptStub = sinon.stub(PasswordScriptExecutor, 'ExecuteScript');
        credentialsCacheStub = sinon.stub(CredentialsCache, 'set');

        NuGetConfigResolver.ClearCache();
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        sinon.restore();
    });

    test('GetSourcesAndDecodePasswords resolves sources from workspace config', async () => {
        const nugetConfigPath = path.join(tmpDir, 'nuget.config');
        const xml = `
            <configuration>
                <packageSources>
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
         // This is harder to test without mocking fs.existsSync completely or process.env,
         // but we can test that it finds the file in our tmpDir when passed as workspaceRoot.

         const workspaceConfig = path.join(tmpDir, 'nuget.config');
         fs.writeFileSync(workspaceConfig, '<configuration/>');

         // We can't easily spy on private method FindAllConfigFiles,
         // but GetSourcesWithCredentials calls it.
         // Let's create a nuget.config in a subfolder and see if it picks up.

         const subDir = path.join(tmpDir, '.nuget');
         fs.mkdirSync(subDir);
         const subConfig = path.join(subDir, 'NuGet.Config');
         fs.writeFileSync(subConfig, `
            <configuration>
                <packageSources>
                    <add key="Sub Source" value="https://sub.com" />
                </packageSources>
            </configuration>
         `);

         // If workspace root has config, it should pick it up.
         // If we remove workspace config, it should pick up .nuget/NuGet.Config

         fs.unlinkSync(workspaceConfig);

         const sources = NuGetConfigResolver.GetSourcesWithCredentials(tmpDir);
         assert.strictEqual(sources.length, 1);
         assert.strictEqual(sources[0].Name, 'Sub Source');
    });
});
