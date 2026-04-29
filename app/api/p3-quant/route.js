import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "..", "p3_merged_quant.csv");
    const csv = await readFile(csvPath, "utf8");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load p3_merged_quant.csv",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
