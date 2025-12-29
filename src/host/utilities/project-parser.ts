import fs from "fs";
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import * as path from "path";

export default class ProjectParser {
  static Parse(projectPath: string, cpmVersions?: Map<string, string> | null): Project {
    let projectContent = fs.readFileSync(projectPath, "utf8");
    let document = new DOMParser().parseFromString(projectContent);
    if (document == undefined) throw `${projectPath} has invalid content`;

    let packagesReferences = xpath.select("//ItemGroup/PackageReference", document) as Node[];
    let project: Project = {
      Path: projectPath,
      Name: path.basename(projectPath),
      Packages: Array(),
    };

    (packagesReferences || []).forEach((p: any) => {
      let version = p.attributes?.getNamedItem("Version");
      const packageId = p.attributes?.getNamedItem("Include").value;
      
      if (cpmVersions) {
        let cpmVersion = cpmVersions.get(packageId) || null;    
        if (cpmVersion) {
          version = cpmVersion;
        }
        // TODO: Log warning when package is not found in Directory.Packages.props
      }

      let projectPackage: ProjectPackage = {
        Id: packageId,
        Version: version,
      };
      project.Packages.push(projectPackage);
    });

    return project;
  }
}
