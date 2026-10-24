export interface TemplateArtifactInput {
  sourceTemplate: string;
  targetTemplate: string;
  runtimePackage: string;
  materialsPackage: string;
}

export declare const prepareTemplateArtifact: (input: TemplateArtifactInput) => Promise<void>;
