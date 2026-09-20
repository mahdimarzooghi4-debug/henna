import type { SellerFields } from "./seller-draft-preflight";
import {
  sellerFieldLabels, sellerFieldDifferences,
} from "./seller-conflict";

/**
 * This is a THREE-way comparison: the last persisted snapshot seen by THIS
 * tab, the unsaved form, and the newly fetched persisted version after 409.
 * Comparing just mine vs server would quietly replace independent tab edits.
 *
 * Choices are a local, ephemeral editing aid only. A merge never performs a
 * write; the original revision-protected PUT is a separate explicit action.
 */
export type SellerFieldChoice = "mine" | "server" | null;
export type SellerFieldChoices =
  Record<keyof SellerFields, SellerFieldChoice>;

const keys = Object.keys(sellerFieldLabels) as (keyof SellerFields)[];

export function suggestSellerFieldChoices(
  previouslySeen: SellerFields,
  mine: SellerFields,
  current: SellerFields,
): SellerFieldChoices {
  return Object.fromEntries(keys.map((key) => {
    // Equal values do not conflict even if both tabs edited the field.
    if (mine[key] === current[key]) return [key, "server"];
    const changedLocally = mine[key] !== previouslySeen[key];
    const changedRemotely = current[key] !== previouslySeen[key];
    // Non-overlapping changes can be combined without discarding either.
    // If both changed the same field differently, the user MUST decide.
    return [key,
      changedLocally && changedRemotely ? null
        : changedLocally ? "mine" : "server"];
  })) as SellerFieldChoices;
}

export function unresolvedSellerFieldChoices(
  mine: SellerFields,
  current: SellerFields,
  choices: SellerFieldChoices,
): number {
  return sellerFieldDifferences(mine, current)
    .filter(({ key }) => choices[key] === null).length;
}

export function combineSellerDraftFields(
  mine: SellerFields,
  server: { fields: SellerFields; revision: number },
  choices: SellerFieldChoices,
): { fields: SellerFields; revision: number; saved: boolean } | null {
  if (unresolvedSellerFieldChoices(mine, server.fields, choices) !== 0)
    return null;
  const merged = Object.fromEntries(keys.map((key) => [
    key,
    mine[key] === server.fields[key] || choices[key] === "server"
      ? server.fields[key] : mine[key],
  ])) as SellerFields;

  // saved=true is only a UI indication when the chosen result already
  // equals the fresh server snapshot; it cannot be inferred from a 409 alone.
  return {
    fields: merged,
    revision: server.revision,
    saved: sellerFieldDifferences(merged, server.fields).length === 0,
  };
}
