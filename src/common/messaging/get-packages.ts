type GetPackagesRequest = {
  Url: string;
  SourceName?: string;
  Filter: string;
  Prerelease: boolean;
  Skip: number;
  Take: number;
  PasswordScriptPath?: string;
  ForceRefresh?: boolean;
};

type GetPackagesResponse = {
  IsFailure: boolean;
  Packages?: Array<Package>;
  Error?: HttpError;
  IsFromCache?: boolean;
  CacheExpires?: Date;
};
