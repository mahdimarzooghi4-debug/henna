import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import {
  MobilePendingCommerceStore,
  type PendingPhotoStore,
  type PendingTextStore,
} from "./pending-commerce.ts";

const pendingKey = "hana.consumer.pending-commerce.v1";
const secureOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function evidenceDirectory(): string {
  if (!FileSystem.documentDirectory)
    throw Error("Document storage unavailable.");
  return FileSystem.documentDirectory + "hana-evidence/";
}

async function ensureEvidenceDirectory() {
  const directory = evidenceDirectory();
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists)
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

function ownedEvidenceUri(uri: string) {
  try { return uri.startsWith(evidenceDirectory()); }
  catch { return false; }
}

const textStore: PendingTextStore = {
  read: () => SecureStore.getItemAsync(pendingKey, secureOptions),
  write: value => SecureStore.setItemAsync(pendingKey, value, secureOptions),
  remove: () => SecureStore.deleteItemAsync(pendingKey, secureOptions),
};

const photoStore: PendingPhotoStore = {
  async readBase64(uri) {
    if (!ownedEvidenceUri(uri)) throw Error("Evidence file is not owned.");
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory ||
        typeof info.size !== "number" || info.size < 12 || info.size > 40000)
      throw Error("Evidence file unavailable.");
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  },
  async remove(uri) {
    if (!ownedEvidenceUri(uri)) return;
    await FileSystem.deleteAsync(uri, { idempotent: true });
  },
  async cleanup(keepUri) {
    const directory = await ensureEvidenceDirectory();
    const names = await FileSystem.readDirectoryAsync(directory);
    await Promise.all(names.map(async name => {
      const uri = directory + name;
      if (uri === keepUri) return;
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }));
  },
};

export const pendingCommerceStore =
  new MobilePendingCommerceStore(textStore, photoStore);

export async function persistIncidentPhoto(
  sourceUri: string,
  id: string,
): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(id))
    throw Error("Evidence file id invalid.");
  const source = await FileSystem.getInfoAsync(sourceUri);
  if (!source.exists || source.isDirectory ||
      typeof source.size !== "number" || source.size < 12 ||
      source.size > 40000)
    throw Error("Evidence file is outside the allowed size.");

  const destination = (await ensureEvidenceDirectory()) +
    id.toLowerCase() + ".jpg";
  await FileSystem.deleteAsync(destination, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  const copied = await FileSystem.getInfoAsync(destination);
  if (!copied.exists || copied.isDirectory ||
      typeof copied.size !== "number" || copied.size !== source.size) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw Error("Evidence file could not be persisted.");
  }
  return destination;
}

export async function deleteTransientIncidentPhoto(uri: string) {
  if (!FileSystem.cacheDirectory || !uri.startsWith(FileSystem.cacheDirectory))
    return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
