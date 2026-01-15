export type UpdateType = "INSTALL" | "UNINSTALL" | "UPDATE";

export type UpdateProjectRequest = {
  ProjectPath: string;
  PackageId: string;
  Version?: string;
  Type: UpdateType;
  SourceUrl?: string;
};

export type UpdateProjectResponse = {
  Project: Project;
  IsCpmEnabled: boolean;
};
