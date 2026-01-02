import { IRequestHandler } from "@/common/messaging/core/types";
import nugetApiFactory from "../nuget/api-factory";
import * as vscode from "vscode";

export class GetPackages implements IRequestHandler<GetPackagesRequest, GetPackagesResponse> {
  async HandleAsync(request: GetPackagesRequest): Promise<GetPackagesResponse> {
    let api = await nugetApiFactory.GetSourceApi(request.Url);
    try {
      let packages = await api.GetPackagesAsync(
        request.Filter,
        request.Prerelease,
        request.Skip,
        request.Take
      );
      let result: GetPackagesResponse = {
        IsFailure: false,
        Packages: packages.data,
      };
      return result;
    } catch (err: any) {
      console.error("Failed to fetch packages:", request.Url, err);
      let result: GetPackagesResponse = {
        IsFailure: true,
        Error: {
          Message: "Failed to fetch packages",
        },
      };
      return result;
    }
  }
}
