import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { admin, db, read } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bucket = "catering-documents";
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    if (!(await admin()))
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (Number(req.headers.get("content-length") || 0) > 3.2 * 1024 * 1024)
      return NextResponse.json(
        { error: "Maximum file size is 3 MB." },
        { status: 413 },
      );
    const data = await req.formData(),
      file = data.get("file"),
      kind = data.get("kind");
    if (!(file instanceof File) || !["qr", "receipts"].includes(String(kind)))
      throw Error("Choose a valid file.");
    if (!file.size || file.size > 3 * 1024 * 1024)
      throw Error("Maximum file size is 3 MB.");
    let bytes = Buffer.from(await file.arrayBuffer());
    let ext = "png",
      mime = "image/png";
    if (file.type === "application/pdf" && kind === "receipts") {
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw Error("Invalid PDF document.");
      ext = "pdf";
      mime = "application/pdf";
    } else {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw Error("Use a PNG, JPEG or WebP image; receipts also accept PDF.");
      try {
        bytes = await sharp(bytes, { limitInputPixels: 16000000 })
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
      } catch {
        throw Error(
          "This image could not be read. Choose a valid image under 16 megapixels.",
        );
      }
    }
    const path = `${kind}/${randomUUID()}.${ext}`;
    const { error } = await db()
      .storage.from(bucket)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw Error("Upload failed. Please try again.");
    return NextResponse.json(
      { path, name: file.name.slice(0, 200) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
export async function GET(req: NextRequest) {
  try {
    const qr = req.nextUrl.searchParams.get("qr") === "1";
    let path = "";
    if (qr) {
      path = (await read()).state.settings.qrFile?.path || "";
    } else {
      if (!(await admin()))
        return new NextResponse("Sign in required", { status: 401 });
      path = req.nextUrl.searchParams.get("path") || "";
    }
    if (
      !/^(qr|receipts)\/[a-f0-9-]+\.(png|jpg|webp|pdf)$/.test(path) ||
      (qr && !path.startsWith("qr/"))
    )
      return new NextResponse("Not found", { status: 404 });
    const { data, error } = await db().storage.from(bucket).download(path);
    if (error || !data) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": path.endsWith(".pdf")
          ? 'attachment; filename="receipt.pdf"'
          : "inline",
      },
    });
  } catch {
    return new NextResponse("File unavailable", { status: 503 });
  }
}
