import * as vscode from "vscode";
import NuGetApi from "../nuget/api";
import NuGetConfigResolver from "../utilities/nuget-config-resolver";
import PasswordScriptExecutor from "../utilities/password-script-executor";

type SourceApiCollection = {
  [url: string]: NuGetApi;
};

class NuGetApiFactory {
  private readonly _sourceApiCollection: SourceApiCollection = {};

  public async GetSourceApi(url: string): Promise<NuGetApi> {
    if (!(url in this._sourceApiCollection)) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
      const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(workspaceRoot);
      const sourceWithCreds = sources.find(s => s.Url === url);
      
      let username = sourceWithCreds?.Username;
      let password = sourceWithCreds?.Password;

      this._sourceApiCollection[url] = new NuGetApi(url, username, password);
    }

    return this._sourceApiCollection[url];
  }

  public ClearCache() {
    for (const key in this._sourceApiCollection) {
      delete this._sourceApiCollection[key];
    }
    PasswordScriptExecutor.ClearCache();
  }
}

export default new NuGetApiFactory();
