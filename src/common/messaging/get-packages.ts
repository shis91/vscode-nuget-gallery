type GetPackagesRequest = {
  Url: string;
  SourceName?: string;
  Filter: string;
  Prerelease: boolean;
  Skip: number;
  Take: number;
  PasswordScriptPath?: string;
  ClearCache?: boolean;
};

type GetPackagesResponse = {
  IsFailure: boolean;
  Packages?: Array<Package>;
  Error?: HttpError;
};
