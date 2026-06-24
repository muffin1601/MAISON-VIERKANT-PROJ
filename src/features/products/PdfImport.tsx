"use client";

import { useCallback, useRef, useState } from "react";
import { showToast } from "@/lib/toast";
import { useUpload } from "@/lib/upload/useUpload";
import { extractPdf, ocrPages, type RenderedPage } from "@/lib/pdf/renderPdfPages";
import type { ImportFormPatch } from "@/validations/pdfImport";
import { X, FileUp, CloudUpload, Check, ArrowRight, RefreshCw } from "@/components/ui/icons";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type ApplyMode = "replace" | "merge";

type Stage = "pick" | "rendering" | "extracting" | "review" | "applying" | "done" | "error";

const STAGE_LABEL: Record<Stage, string> = {
  pick: "",
  rendering: "Reading pictures from your PDF…",
  extracting: "Reading the product details…",
  review: "Please check the details below",
  applying: "Filling in the form…",
  done: "All done!",
  error: "",
};

/** A document attachment built from the existing upload flow (source PDF). */
export interface ImportedDoc {
  url: string;
  filename: string;
  kind: string;
  mimeType: string | null;
  sizeBytes: number;
  bucket: string;
  storageKey: string;
}

interface Props {
  /** True when editing a product that already has field data → prompt Replace/Merge/Cancel. */
  hasExistingData: boolean;
  onApply: (patch: ImportFormPatch, imageUrls: string[], docs: ImportedDoc[], mode: ApplyMode) => void;
  onClose: () => void;
}

/** Strip extension + separators from a filename → a human title fallback for the product name. */
function nameFromFile(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PdfImport({ hasExistingData, onApply, onClose }: Props) {
  const { upload } = useUpload();

  const [stage, setStage] = useState<Stage>("pick");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [errorMsg, setErrorMsg] = useState("");

  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [renderFailed, setRenderFailed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [patch, setPatch] = useState<ImportFormPatch | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [attachPdf, setAttachPdf] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const busy = stage === "rendering" || stage === "extracting" || stage === "applying";

  const analyze = useCallback(
    async (file: File) => {
      setErrorMsg("");
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg("Please choose a PDF file.");
        setStage("error");
        return;
      }
      if (file.size === 0 || file.size > MAX_PDF_BYTES) {
        setErrorMsg(file.size === 0 ? "That PDF appears to be empty." : "That PDF is too big (the maximum is 50 MB).");
        setStage("error");
        return;
      }
      setSourceFile(file);

      // 1 · Extract text + render page images, entirely in the browser. Non-fatal if it fails.
      setStage("rendering");
      setProgress(0);
      let rendered: RenderedPage[] = [];
      let text = "";
      try {
        const extract = await extractPdf(file, {
          onProgress: (done, total) => setProgress(Math.round((done / Math.max(1, total)) * 100)),
        });
        rendered = extract.pages;
        text = extract.text;
      } catch (err) {
        rendered = [];
        text = "";
        console.warn("PDF processing failed:", err);
      }
      setPages(rendered);
      setRenderFailed(rendered.length === 0);
      // Select all by index (a page can yield several embedded images).
      setSelected(new Set(rendered.map((_, i) => i)));

      // 2 · OCR fallback (client-side) when the PDF has no usable text layer (scanned pages).
      setStage("extracting");
      if (text.trim().length < 40 && rendered.length) {
        const ocr = await ocrPages(rendered, {
          onProgress: (done, total) => setProgress(Math.round((done / Math.max(1, total)) * 100)),
        });
        if (ocr) text = [text, ocr].filter(Boolean).join("\n");
      }

      // 3 · Parse the (small) extracted text on the server — the PDF itself is never uploaded here.
      try {
        const res = await fetch("/api/admin/products/import-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(json?.error?.message ?? "Could not extract data from this PDF.");
          setStage("error");
          return;
        }
        const incoming = json.data.patch as ImportFormPatch;
        // Guarantee a product name: fall back to the file name so the form is never left blank.
        if (!incoming.name.trim()) {
          const derived = nameFromFile(file.name);
          incoming.name = derived;
          if (!incoming.seoTitle.trim()) incoming.seoTitle = derived;
        }
        setPatch(incoming);
        setStage("review");
      } catch {
        setErrorMsg("Something went wrong while reading the PDF. Please try again.");
        setStage("error");
      }
    },
    [],
  );

  function onPick(files: FileList | null) {
    const f = files?.[0];
    if (f) void analyze(f);
  }

  function toggle(index: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function apply(mode: ApplyMode) {
    if (!patch) return;
    setStage("applying");
    setProgress(0);

    // 3 · Upload the admin-selected images through the existing image pipeline.
    const chosen = pages.filter((_, i) => selected.has(i));
    const urls: string[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const asset = await upload(chosen[i].file, "product-image");
      if (asset) urls.push(asset.url);
      setProgress(Math.round(((i + 1) / Math.max(1, chosen.length)) * 100));
    }

    // 4 · Optionally attach the source PDF as a product document (existing document bucket).
    const docs: ImportedDoc[] = [];
    if (attachPdf && sourceFile) {
      const doc = await upload(sourceFile, "document");
      if (doc) {
        docs.push({
          url: doc.url,
          filename: doc.filename,
          kind: "DOCUMENT",
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          bucket: doc.bucket,
          storageKey: doc.key,
        });
      }
    }

    onApply(patch, urls, docs, mode);
    setStage("done");
    showToast("The form has been filled in from your PDF.");
    setTimeout(onClose, 700);
  }

  function reset() {
    setStage("pick");
    setProgress(0);
    setErrorMsg("");
    setPages([]);
    setRenderFailed(false);
    setSelected(new Set());
    setPatch(null);
    setSourceFile(null);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(26,24,20,.78)", zIndex: 950, overflowY: "auto", padding: "24px 16px" }}
      onClick={busy ? undefined : onClose}
    >
      <div
        style={{ maxWidth: 720, margin: "0 auto", background: "var(--white)", borderRadius: 2, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "var(--ink)", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600, letterSpacing: ".06em", display: "flex", alignItems: "center", gap: 8 }}>
              <FileUp size={16} strokeWidth={1.5} /> Import Product From PDF
            </div>
            <div style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: ".12em", marginTop: 2 }}>
              Offline extraction · review before saving
            </div>
          </div>
          <button onClick={busy ? undefined : onClose} disabled={busy} style={{ background: "none", border: "none", color: "var(--cream3)", cursor: busy ? "not-allowed" : "pointer", lineHeight: 1, display: "flex", opacity: busy ? 0.4 : 1 }} aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 16 }}>
          {/* Pick / drop */}
          {stage === "pick" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); onPick(e.dataTransfer.files); }}
                style={{
                  border: `2px dashed ${dragOver ? "var(--gold)" : "var(--cream3)"}`,
                  background: dragOver ? "var(--cream2)" : "transparent",
                  borderRadius: 2, padding: "40px 20px", textAlign: "center", cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                <CloudUpload size={34} strokeWidth={1.2} style={{ color: "var(--gold)", marginBottom: 10 }} />
                <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
                  Drop your product PDF here, or click to choose a file
                </div>
                <div style={{ fontSize: 11, color: "var(--ink4)" }}>
                  One product per file · PDF up to 50 MB
                </div>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
              </div>

              {/* What happens — simple, non-technical */}
              <div style={{ background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 8, fontWeight: 600 }}>
                  How it works
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5, fontSize: 11.5, color: "var(--ink3)", lineHeight: 1.6 }}>
                  <li>Choose your product PDF above.</li>
                  <li>We read the product details and pictures from it automatically.</li>
                  <li>The product form gets filled in for you.</li>
                  <li>You check everything, fix anything if needed, then press <strong>Save</strong>.</li>
                </ol>
                <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 8 }}>
                  Don&apos;t worry — nothing is saved until you press Save, so you can always cancel.
                </div>
              </div>

              {/* Tips in plain language */}
              <div style={{ background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 8, fontWeight: 600 }}>
                  Tips for the best result
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 7, fontSize: 11.5, color: "var(--ink3)", lineHeight: 1.6 }}>
                  <li>
                    <strong>Use a PDF where you can select the text.</strong> Open the PDF and try to highlight
                    a few words with your mouse. If you can highlight them, it will work well. If it&apos;s just
                    a photo or scan of a page, it still works but may be slower and less accurate.
                  </li>
                  <li>
                    <strong>One product per file.</strong> Upload a single product&apos;s sheet or one page at a
                    time. A page with many products mixed together can confuse the details.
                  </li>
                  <li>
                    <strong>The clearer the details, the more boxes we can fill.</strong> PDFs that list things
                    plainly — like <em>Name</em>, <em>Size</em>, <em>Material</em>, <em>Colours</em> and
                    <em> Price</em> — fill in the most fields for you.
                  </li>
                  <li>
                    <strong>Show the product photo clearly</strong> and large on the page. We&apos;ll pull the
                    photos out so you can choose the main picture.
                  </li>
                  <li>
                    <strong>File size:</strong> any PDF up to 50&nbsp;MB works. If you also want to keep a copy of
                    the PDF on the product, keep that file under about 4&nbsp;MB.
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Working stages */}
          {(stage === "rendering" || stage === "extracting" || stage === "applying") && (
            <div style={{ padding: "28px 8px", textAlign: "center" }}>
              <RefreshCw size={26} strokeWidth={1.5} style={{ color: "var(--gold)", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 14, marginBottom: 12 }}>{STAGE_LABEL[stage]}</div>
              <Bar value={stage === "extracting" ? undefined : progress} />
              {stage === "extracting" && (
                <div style={{ fontSize: 10, color: "var(--ink4)", marginTop: 10 }}>This can take a little longer for scanned PDFs. Please wait…</div>
              )}
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Error */}
          {stage === "error" && (
            <div style={{ textAlign: "center", padding: "20px 8px" }}>
              <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 14 }}>{errorMsg || "Something went wrong."}</div>
              <button className="a-btn-o" style={{ width: "auto", padding: "8px 18px", fontSize: 11 }} onClick={reset}>
                Try another PDF
              </button>
            </div>
          )}

          {/* Review */}
          {stage === "review" && patch && (
            <>
              <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, letterSpacing: ".04em", display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={15} strokeWidth={2} /> Here&apos;s what we found — please check it
              </div>

              {/* Extracted fields summary */}
              <div style={{ display: "grid", gap: 8, fontSize: 12, color: "var(--ink3)", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, padding: 12 }}>
                <Field label="Series / Category" value={patch.series} />
                <Field label="Name" value={patch.name} />
                <Field label="Description" value={patch.description} clamp />
                <Field label="Finishes" value={patch.finishes.join(", ")} />
                <Field label="Models" value={patch.models.map((m) => [m.code, m.dims, m.eur ? `€${m.eur}` : ""].filter(Boolean).join(" · ")).join("  |  ")} />
              </div>

              {/* Images — embedded product photos (preferred) + full-page fallbacks */}
              {pages.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 6 }}>
                    Choose which pictures to use ({selected.size} of {pages.length} chosen). Tap a picture to
                    add or remove it. The first one becomes the main photo.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {pages.map((p, i) => {
                      const on = selected.has(i);
                      const isPhoto = p.kind === "embedded";
                      return (
                        <button key={`${p.page}-${p.kind}-${i}`} onClick={() => toggle(i)} style={{ position: "relative", width: 84, height: 110, borderRadius: 2, overflow: "hidden", border: `2px solid ${on ? "var(--gold)" : "var(--cream3)"}`, padding: 0, cursor: "pointer", background: "var(--cream2)" }} aria-pressed={on}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.dataUrl} alt={isPhoto ? `Photo from page ${p.page}` : `Page ${p.page}`} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: on ? 1 : 0.45 }} />
                          <span style={{ position: "absolute", bottom: 3, left: 3, fontSize: 8, letterSpacing: ".06em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 2, color: "#fff", background: isPhoto ? "rgba(46,125,50,.92)" : "rgba(26,24,20,.78)" }}>
                            {isPhoto ? "Photo" : `Page ${p.page}`}
                          </span>
                          {on && (
                            <span style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 2, background: "var(--gold)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {renderFailed && (
                <div style={{ fontSize: 11, color: "var(--ink4)", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, padding: "8px 10px" }}>
                  We couldn&apos;t find any pictures in this PDF — you can add product photos yourself after.
                </div>
              )}

              {/* Attach the source PDF as a product document */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink3)", cursor: "pointer" }}>
                <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
Also keep a copy of this PDF on the product (under Documents)
              </label>

              {/* Apply actions */}
              <div style={{ borderTop: "1px solid var(--cream3)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <button className="a-btn-o" style={{ width: "auto", padding: "8px 16px", fontSize: 10 }} onClick={reset}>
                  Choose different PDF
                </button>
                {hasExistingData ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--ink4)" }}>Imported data detected —</span>
                    <button onClick={onClose} style={btnGhost}>Cancel</button>
                    <button onClick={() => apply("merge")} style={btnGhost}>Merge With Existing</button>
                    <button onClick={() => apply("replace")} style={btnGold}>Replace Existing <ArrowRight size={13} strokeWidth={1.5} /></button>
                  </div>
                ) : (
                  <button onClick={() => apply("replace")} style={btnGold}>
                    Apply to form <ArrowRight size={14} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </>
          )}

          {stage === "done" && (
            <div style={{ textAlign: "center", padding: "26px 8px" }}>
              <Check size={30} strokeWidth={2} style={{ color: "var(--gold)" }} />
              <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 10 }}>All done! The form has been filled in.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnGold: React.CSSProperties = {
  background: "var(--gold)", border: "none", color: "white", padding: "9px 18px", fontSize: 11,
  cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 2, fontWeight: 600,
  letterSpacing: ".06em", display: "inline-flex", alignItems: "center", gap: 7,
};
const btnGhost: React.CSSProperties = {
  background: "none", border: "1px solid var(--cream3)", color: "var(--ink3)", padding: "9px 16px",
  fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 2,
};

function Bar({ value }: { value?: number }) {
  // Indeterminate when value is undefined.
  return (
    <div style={{ height: 6, borderRadius: 2, background: "var(--cream3)", overflow: "hidden", maxWidth: 340, margin: "0 auto" }}>
      <div
        style={{
          height: "100%", background: "var(--gold)", borderRadius: 2,
          width: value === undefined ? "40%" : `${value}%`,
          animation: value === undefined ? "indet 1.1s ease-in-out infinite" : undefined,
          transition: value === undefined ? undefined : "width .2s",
        }}
      />
      {value === undefined && <style>{`@keyframes indet{0%{margin-left:-40%}100%{margin-left:100%}}`}</style>}
    </div>
  );
}

function Field({ label, value, clamp }: { label: string; value: string; clamp?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "baseline" }}>
      <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink4)" }}>{label}</span>
      <span style={{ color: value ? "var(--ink)" : "var(--ink4)", whiteSpace: clamp ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: clamp ? "-webkit-box" as const : "block", WebkitLineClamp: clamp ? 3 : undefined, WebkitBoxOrient: clamp ? "vertical" as const : undefined }}>
        {value || "—"}
      </span>
    </div>
  );
}
