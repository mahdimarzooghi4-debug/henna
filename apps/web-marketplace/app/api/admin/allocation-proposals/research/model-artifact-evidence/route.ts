import { NextRequest } from "next/server";
import { forwardModelArtifactDossier } from "../../../../../../lib/server-model-artifact-dossier";

export function GET(request: NextRequest) {
  return forwardModelArtifactDossier(request);
}
