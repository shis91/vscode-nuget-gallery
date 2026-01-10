type Package = {
  Id: string;
  Name: string;
  Authors: Array<string>;
  Description: string;
  IconUrl: string;
  LicenseUrl: string;
  ProjectUrl: string;
  Registration: string;
  TotalDownloads: number;
  Verified: boolean;
  InstalledVersion: string;
  Version: string;
  Versions: Array<PackageVersion>;
  Tags: Array<string>;
  Vulnerabilities: Array<Vulnerability>;
};

type PackageVersion = {
  Version: string;
  Id: string;
  Vulnerabilities: Array<Vulnerability>;
};

type Vulnerability = {
  Severity: number; // 0=Low, 1=Moderate, 2=High, 3=Critical (based on NuGet API usually, or we map it)
  AdvisoryUrl: string;
};

type PackageDetails = {
  dependencies: PackageDependencyGroup;
};

type PackageDependencyGroup = {
  frameworks: { [id: string]: Array<PackageDependency> };
};

type PackageDependency = {
  package: string;
  versionRange: string;
};

type ProjectPackage = {
  Id: string;
  Version: string;
};

type Project = {
  Name: string;
  Path: string;
  Packages: Array<ProjectPackage>;
};

type Source = {
  Name: string;
  Url: string;
  PasswordScriptPath?: string;
};

type Configuration = {
  SkipRestore: boolean;
  EnablePackageVersionInlineInfo: boolean;
  Sources: Array<Source>;
  StatusBarLoadingIndicator: boolean;
};

type HttpError = {
  Message: string;
};

type Credentials = {
  Username: string;
  Password: string;
};
