import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CpmResolver from '../../../../host/utilities/cpm-resolver';
import { Logger } from '../../../../common/logger';

suite('CpmResolver Tests', () => {
    let tmpDir: string;
    let projectDir: string;
    let projectPath: string;

    // Store original Logger methods to restore them after tests
    const originalDebug = Logger.debug;
    const originalError = Logger.error;

    setup(() => {
        // Create a temporary directory structure:
        // tmpDir/
        //   src/
        //     MyProject/
        //       MyProject.csproj
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-resolver-test-'));
        projectDir = path.join(tmpDir, 'src', 'MyProject');
        fs.mkdirSync(projectDir, { recursive: true });
        projectPath = path.join(projectDir, 'MyProject.csproj');

        // Default project content
        fs.writeFileSync(projectPath, '<Project><PropertyGroup><ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally></PropertyGroup></Project>');

        // Reset cache before each test
        CpmResolver.ClearCache();

        // Silence logger by default to keep test output clean
        Logger.debug = () => {};
        Logger.error = () => {};
    });

    teardown(() => {
        // Restore logger
        Logger.debug = originalDebug;
        Logger.error = originalError;

        try {
           fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch(e) {
            console.error(`Failed to cleanup temp dir: ${e}`);
        }
    });

    test('GetPackageVersions returns null when no Directory.Packages.props exists', () => {
        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions returns null when CPM is disabled in Directory.Packages.props', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions returns null when CPM is enabled in props but disabled in Project', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        // Overwrite project to disable CPM
        const projectContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>`;
        fs.writeFileSync(projectPath, projectContent);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions returns null when CPM property is missing (defaults to false/disabled in this logic)', () => {
        // The implementation checks if cpmEnabled !== "true" -> return false.
        // So if missing, it's not "true", so false.
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <!-- Missing ManagePackageVersionsCentrally -->
                </PropertyGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions parses versions when CPM is enabled', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Package.A" Version="1.0.0" />
                    <PackageVersion Include="Package.B" Version="2.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.notStrictEqual(versions, null);
        assert.strictEqual(versions!.size, 2);
        assert.strictEqual(versions!.get('Package.A'), '1.0.0');
        assert.strictEqual(versions!.get('Package.B'), '2.0.0');
    });

    test('GetPackageVersions finds Directory.Packages.props in parent directory', () => {
        // Create CPM file in root tmpDir, project is in tmpDir/src/MyProject/
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Root.Package" Version="3.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.notStrictEqual(versions, null);
        assert.strictEqual(versions!.get('Root.Package'), '3.0.0');
    });

    test('GetPackageVersions uses cache on subsequent calls', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent1 = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="1.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent1);

        // First call
        let versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions!.get('Test.Package'), '1.0.0');

        // Update file
        const cpmContent2 = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="2.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent2);

        // Second call should return cached value
        versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions!.get('Test.Package'), '1.0.0');
    });

    test('ClearCache clears the cache', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent1 = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="1.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent1);

        CpmResolver.GetPackageVersions(projectPath);

        // Update file
        const cpmContent2 = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="2.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent2);

        // Clear cache
        CpmResolver.ClearCache();

        // Should get new value
        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions!.get('Test.Package'), '2.0.0');
    });

    test('ClearCacheForProject clears cache for specific project', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent1 = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="1.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent1);

        CpmResolver.GetPackageVersions(projectPath);

        // Update file
        const cpmContent2 = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="2.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent2);

        // Clear cache for project
        CpmResolver.ClearCacheForProject(projectPath);

        // Should get new value
        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions!.get('Test.Package'), '2.0.0');
    });

    test('ParsePackageVersions handles malformed XML gracefully', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        // Malformed XML (missing closing tag)
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Test.Package" Version="1.0.0" />
            `;
        fs.writeFileSync(cpmPath, cpmContent);

        let errorLogged = false;
        Logger.error = () => { errorLogged = true; };

        // Even with malformed XML, it checks status first.
        // IsCentralPackageManagementEnabled uses try/catch.
        // ParsePackageVersions also uses try/catch.
        // But for IsCentralPackageManagementEnabled, if it fails, it returns false.
        // So GetPackageVersions calls IsCentralPackageManagementEnabled first.
        // If the XML is so bad that IsCentralPackageManagementEnabled throws or fails to find "true", it returns null.

        // Let's see if we can craft an XML that passes the boolean check but fails parsing versions,
        // OR if the boolean check fails, verify it returns null.

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
        assert.strictEqual(errorLogged, true);
    });

    test('ParsePackageVersions handles items with missing attributes', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="Valid.Package" Version="1.0.0" />
                    <PackageVersion Include="Missing.Version" />
                    <PackageVersion Version="2.0.0" />
                </ItemGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.notStrictEqual(versions, null);
        assert.strictEqual(versions!.size, 1);
        assert.strictEqual(versions!.get('Valid.Package'), '1.0.0');
        assert.strictEqual(versions!.has('Missing.Version'), false);
    });

    test('IsCentralPackageManagementEnabled returns false if project XML is invalid', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const cpmContent = `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>`;
        fs.writeFileSync(cpmPath, cpmContent);

        // Invalid project XML
        fs.writeFileSync(projectPath, '<Project><Invalid');

        let errorLogged = false;
        Logger.error = () => { errorLogged = true; };

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
        assert.strictEqual(errorLogged, true);
    });
});
