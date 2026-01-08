type UpdateType = "INSTALL" | "UNINSTALL" | "UPDATE";

type UpdateProjectRequest = {
  ProjectPath: string;
  PackageId: string;
  Version?: string;
  Type: UpdateType;
  SourceUrl?: string;
};

type UpdateProjectResponse = {
  Project: Project;
  IsCpmEnabled: boolean;
};
