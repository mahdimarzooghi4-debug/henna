import { NextRequest } from "next/server";
import { forwardModelArtifactInventory } from "../../../../../../lib/server-model-artifact-inventory";

export function GET(request: NextRequest) {
  return forwardModelArtifactInventory(request);
}
