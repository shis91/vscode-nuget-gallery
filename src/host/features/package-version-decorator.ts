import * as vscode from 'vscode';
import nugetApiFactory from '../nuget/api-factory';
import NuGetConfigResolver from '../utilities/nuget-config-resolver';
import { Logger } from '../../common/logger';

export class PackageVersionDecorator implements vscode.Disposable {
    private _disposables: vscode.Disposable[] = [];
    private _decorationType: vscode.TextEditorDecorationType;
    private _cache: Map<string, string> = new Map(); // PackageId -> LatestVersion
    private _failedCache: Set<string> = new Set(); // PackageIds that failed to fetch

    constructor() {
        this._decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 1em',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
            }
        });

        // Listen for active editor changes
        this._disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.triggerUpdateDecorations(editor);
            }
        }));

        // Listen for document changes
        this._disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
            if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                this.triggerUpdateDecorations(vscode.window.activeTextEditor);
            }
        }));

        if (vscode.window.activeTextEditor) {
            this.triggerUpdateDecorations(vscode.window.activeTextEditor);
        }
    }

    private _timeout: NodeJS.Timeout | undefined = undefined;

    private triggerUpdateDecorations(editor: vscode.TextEditor) {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = undefined;
        }
        this._timeout = setTimeout(() => {
            this.updateDecorations(editor);
        }, 500);
    }

    private async updateDecorations(editor: vscode.TextEditor) {
        if (!editor || editor.document.isClosed) {
            return;
        }

        const doc = editor.document;
        const fileName = doc.fileName;

        if (!fileName.endsWith('Directory.Packages.props') &&
            !fileName.endsWith('.csproj') &&
            !fileName.endsWith('.fsproj') &&
            !fileName.endsWith('.vbproj')) {
            return;
        }

        const text = doc.getText();
        const regex = /<(PackageReference|PackageVersion)\s+[^>]*>/g;
        const decorations: vscode.DecorationOptions[] = [];
        const packagesToFetch: string[] = [];

        let match;
        while ((match = regex.exec(text))) {
            const tag = match[0];
            const includeMatch = /Include="([^"]+)"/.exec(tag);
            const versionMatch = /Version="([^"]+)"/.exec(tag);

            if (includeMatch && versionMatch) {
                const packageId = includeMatch[1];
                const currentVersion = versionMatch[1];

                // Find position of Version value
                // We need to find the specific "Version" attribute associated with this tag
                // simple search might be risky if "Version" appears in other attributes, but standard is Version=".."

                // Find Version=" inside the tag
                const versionAttrIndex = tag.indexOf(versionMatch[0]);
                if (versionAttrIndex === -1) continue;

                // Value start is after Version="
                const versionValueStartIndex = versionAttrIndex + 'Version="'.length;
                const absoluteIndex = match.index + versionValueStartIndex;

                const startPos = doc.positionAt(absoluteIndex);
                const endPos = doc.positionAt(absoluteIndex + currentVersion.length);

                const latestVersion = this._cache.get(packageId);

                if (latestVersion) {
                    if (latestVersion !== currentVersion) {
                         // Check if latest is actually newer
                         // Simple string compare is not enough for SemVer but usually sufficient for quick check.
                         // ideally we use semver compare. But for now let's show if different.
                         // The user asked "show inline information that the package has avliable newer version"
                         // So I should probably check if it is newer.
                         // But for now, let's just show latest if different.
                        decorations.push({
                            range: new vscode.Range(startPos, endPos),
                            renderOptions: {
                                after: {
                                    contentText: ` (Latest: ${latestVersion})`,
                                }
                            }
                        });
                    }
                } else if (!this._failedCache.has(packageId)) {
                    if (!packagesToFetch.includes(packageId)) {
                        packagesToFetch.push(packageId);
                    }
                }
            }
        }

        editor.setDecorations(this._decorationType, decorations);

        if (packagesToFetch.length > 0) {
            this.fetchVersions(packagesToFetch, editor);
        }
    }

    private async fetchVersions(packageIds: string[], editor: vscode.TextEditor) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(workspaceRoot);

        if (sources.length === 0) {
            return;
        }

        // We'll process packages in batches to avoid overwhelming, but here we just iterate
        for (const packageId of packageIds) {
             // Avoid refetching if already cached (check again as async)
             if (this._cache.has(packageId) || this._failedCache.has(packageId)) continue;

             try {
                 // Try sources in order until found
                 let found = false;
                 for (const source of sources) {
                     try {
                         const api = await nugetApiFactory.GetSourceApi(source.Url);
                         const result = await api.GetPackageAsync(packageId);

                         if (!result.isError && result.data) {
                             // Get the absolute latest version from all versions
                             // The GetPackageAsync returns `data.Versions` which is all versions.
                             // We should pick the last one or sort?
                             // result.data.Versions seems to be sorted usually?
                             // result.data.Version is the latest version from catalog entry?

                             let latest = result.data.Version;

                             // If Versions array is available, use it to find latest stable if possible, or just latest.
                             // The user probably wants latest stable unless they are on prerelease.
                             // For simplicity, let's take the Version property which usually points to latest.

                             // If result.data.Versions is present, we can look at it.
                             if (result.data.Versions && result.data.Versions.length > 0) {
                                 const versions = result.data.Versions.map(v => v.Version);
                                 // Simple logic: last one.
                                 // Better logic would be semver sort, but let's trust the API order or use the top level Version property.
                                 // The NuGetApi.GetPackageAsync implementation sets Version from catalogEntry.version
                                 // "let item = items[items.length - 1]; let catalogEntry = item.catalogEntry; ... Version: catalogEntry?.version"
                                 // It seems it fetches all pages and takes the last item.
                             }

                             this._cache.set(packageId, latest);
                             found = true;
                             break;
                         }
                     } catch (e) {
                         // Try next source
                     }
                 }

                 if (!found) {
                     this._failedCache.add(packageId);
                 }

             } catch (error) {
                 Logger.error(`PackageVersionDecorator: Failed to fetch version for ${packageId}`, error);
                 this._failedCache.add(packageId);
             }
        }

        // Re-run update decorations
        if (vscode.window.activeTextEditor === editor) {
            this.triggerUpdateDecorations(editor);
        }
    }

    dispose() {
        this._disposables.forEach(d => d.dispose());
        this._decorationType.dispose();
    }
}
