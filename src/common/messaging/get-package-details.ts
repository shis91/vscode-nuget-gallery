type GetPackageDetailsRequest = {
  PackageVersionUrl: string;
  SourceUrl: string;
  SourceName?: string;
  PasswordScriptPath?: string;
};

type GetPackageDetailsResponse = {
  IsFailure: boolean;
  Package?: PackageDetails;
  Error?: HttpError;
};
