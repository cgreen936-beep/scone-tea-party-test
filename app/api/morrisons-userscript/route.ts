import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const file = path.join(process.cwd(), "scripts", "morrisons-trolley-helper.user.js");
  const source = await readFile(file, "utf8");
  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
