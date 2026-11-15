import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const totalChunks = 101;
const byteLength = 70299491;

export async function GET() {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= totalChunks) {
        controller.close();
        return;
      }

      try {
        const name = `part-${String(index).padStart(3, "0")}.bin`;
        const bytes = await readFile(join(process.cwd(), "public", "downloads", "seller-8f775b2", name));
        controller.enqueue(bytes);
        index += 1;
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="hana-seller-preview.apk"',
      "Content-Length": String(byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": '"sha256-21dd585c1ec45b481ac3b718d6d745636b833641736c16ea212ff73d330c2ba2"',
    },
  });
}
