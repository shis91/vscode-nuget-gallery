type GetPackageRequest = {
  Url: string;
  SourceName?: string;
  Id: string;
  Prerelease: boolean;
  PasswordScriptPath?: string;
};

type GetPackageResponse = {
  IsFailure: boolean;
  Package?: Package;
  Error?: HttpError;
};
