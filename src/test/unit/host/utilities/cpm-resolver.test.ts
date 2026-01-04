import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CpmResolver from '../../../../host/utilities/cpm-resolver';

suite('CpmResolver Tests', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-gallery-cpm-test-'));
        CpmResolver.ClearCache();
    });

    teardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        CpmResolver.ClearCache();
    });

    test('GetPackageVersions returns null if no Directory.Packages.props found', () => {
        const projectPath = path.join(tmpDir, 'project', 'test.csproj');
        fs.mkdirSync(path.dirname(projectPath), { recursive: true });
        fs.writeFileSync(projectPath, '<Project></Project>');

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions returns null if CPM is disabled in Directory.Packages.props', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const projectPath = path.join(tmpDir, 'test.csproj');

        fs.writeFileSync(cpmPath, `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>
        `);
        fs.writeFileSync(projectPath, '<Project></Project>');

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions returns null if CPM is disabled in project file', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const projectPath = path.join(tmpDir, 'test.csproj');

        fs.writeFileSync(cpmPath, `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>
        `);

        fs.writeFileSync(projectPath, `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
                </PropertyGroup>
            </Project>
        `);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions, null);
    });

    test('GetPackageVersions returns map of versions if CPM is enabled', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const projectPath = path.join(tmpDir, 'test.csproj');

        fs.writeFileSync(cpmPath, `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="PkgA" Version="1.0.0" />
                    <PackageVersion Include="PkgB" Version="2.0.0" />
                </ItemGroup>
            </Project>
        `);

        fs.writeFileSync(projectPath, `<Project></Project>`);

        const versions = CpmResolver.GetPackageVersions(projectPath);
        assert.ok(versions);
        assert.strictEqual(versions?.size, 2);
        assert.strictEqual(versions?.get('PkgA'), '1.0.0');
        assert.strictEqual(versions?.get('PkgB'), '2.0.0');
    });

    test('GetPackageVersions caches results', () => {
        const cpmPath = path.join(tmpDir, 'Directory.Packages.props');
        const projectPath = path.join(tmpDir, 'test.csproj');

        fs.writeFileSync(cpmPath, `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="PkgA" Version="1.0.0" />
                </ItemGroup>
            </Project>
        `);

        fs.writeFileSync(projectPath, `<Project></Project>`);

        const versions1 = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions1?.get('PkgA'), '1.0.0');

        // Modify file, should still return cached result
        fs.writeFileSync(cpmPath, `
            <Project>
                <PropertyGroup>
                    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
                </PropertyGroup>
                <ItemGroup>
                    <PackageVersion Include="PkgA" Version="2.0.0" />
                </ItemGroup>
            </Project>
        `);

        const versions2 = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions2?.get('PkgA'), '1.0.0');

        // Clear cache
        CpmResolver.ClearCacheForProject(projectPath);

        const versions3 = CpmResolver.GetPackageVersions(projectPath);
        assert.strictEqual(versions3?.get('PkgA'), '2.0.0');
    });
});
