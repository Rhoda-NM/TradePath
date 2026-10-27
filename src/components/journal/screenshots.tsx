"use client";
import { useState } from "react";
import type { Screenshot } from "@/lib/journal/model";
async function prepareImage(file: File) {
  if (file.size <= 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preparation unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Image preparation failed")),
        "image/jpeg",
        0.85,
      ),
    );
    return new File([blob], "chart.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
export default function Screenshots({
  type,
  parent,
  items,
}: {
  type: "setup" | "trade";
  parent: string;
  items: Screenshot[];
}) {
  const [images, setImages] = useState(items),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <section className="journal-images">
      <h3>Private chart references</h3>
      <p>
        PNG, JPEG or WebP. Large images are resized to 2048 pixels before
        upload. Images stay private to your account.
      </p>
      <div className="screenshot-list">
        {images.map((image) => (
          <a
            key={image.id}
            href={`/api/screenshots?id=${image.id}`}
            target="_blank"
            rel="noreferrer"
            className="button secondary"
          >
            View chart · {Math.round(image.bytes / 1024)} KB
          </a>
        ))}
      </div>
      <label>
        Attach a screenshot
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!navigator.onLine) {
              setMessage("Offline: screenshot has not been uploaded.");
              return;
            }
            if (file.size > 20 * 1024 * 1024) {
              setMessage("Choose an image under 20 MB before compression.");
              return;
            }
            setPending(true);
            setMessage("Preparing image…");
            try {
              const prepared = await prepareImage(file);
              const form = new FormData();
              form.set("type", type);
              form.set("parent", parent);
              form.set("file", prepared);
              const response = await fetch("/api/screenshots", {
                method: "POST",
                body: form,
              });
              const data = await response.json();
              if (!response.ok) {
                setMessage(data.error || "Upload not confirmed.");
                return;
              }
              setImages((existing) => [
                ...existing,
                {
                  id: data.id,
                  parent_type: type,
                  parent_id: parent,
                  content_type: prepared.type,
                  bytes: prepared.size,
                  created_at: new Date().toISOString(),
                },
              ]);
              setMessage("Private screenshot attached.");
            } catch {
              setMessage(
                "Upload not confirmed. Reload to check before uploading again.",
              );
            } finally {
              setPending(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <p role="status">{message}</p>
    </section>
  );
}
