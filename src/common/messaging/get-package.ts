type GetPackageRequest = {
  Url: string;
  SourceName?: string;
  Id: string;
  Prerelease: boolean;
  PasswordScriptPath?: string;
  ClearCache?: boolean;
};

type GetPackageResponse = {
  IsFailure: boolean;
  Package?: Package;
  Error?: HttpError;
};
