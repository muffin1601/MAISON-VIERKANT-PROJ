"use client";

import { useCallback, useRef, useState } from "react";
import { showToast } from "@/lib/toast";
import { useUpload } from "@/lib/upload/useUpload";
import { renderPdfPages, type RenderedPage } from "@/lib/pdf/renderPdfPages";
import type { ImportFormPatch } from "@/validations/pdfImport";
import { X, FileUp, CloudUpload, Check, ArrowRight, RefreshCw } from "@/components/ui/icons";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type ApplyMode = "replace" | "merge";

type Stage = "pick" | "rendering" | "extracting" | "review" | "applying" | "done" | "error";

const STAGE_LABEL: Record<Stage, string> = {
  pick: "",
  rendering: "Extracting Images…",
  extracting: "Extracting Text & Reading Specifications…",
  review: "Review extracted data",
  applying: "Filling Product Form…",
  done: "Completed",
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
        setErrorMsg(file.size === 0 ? "That PDF is empty." : "PDF exceeds the 50 MB limit.");
        setStage("error");
        return;
      }
      setSourceFile(file);

      // 1 · Render pages client-side (images + OCR source). Non-fatal if it fails.
      setStage("rendering");
      setProgress(0);
      let rendered: RenderedPage[] = [];
      try {
        rendered = await renderPdfPages(file, {
          onProgress: (done, total) => setProgress(Math.round((done / Math.max(1, total)) * 100)),
        });
      } catch (err) {
        rendered = []; // corrupt/locked PDF — let the server try text extraction anyway
        console.warn("PDF page render failed:", err);
      }
      setPages(rendered);
      setRenderFailed(rendered.length === 0);
      setSelected(new Set(rendered.map((p) => p.page)));

      // 2 · Extract + structure on the server.
      setStage("extracting");
      try {
        const body = new FormData();
        body.append("file", file, file.name);
        for (const p of rendered) body.append("pages", p.file, p.file.name);

        const res = await fetch("/api/admin/products/import-pdf", { method: "POST", body });
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
        setErrorMsg("Network error while extracting. Please try again.");
        setStage("error");
      }
    },
    [],
  );

  function onPick(files: FileList | null) {
    const f = files?.[0];
    if (f) void analyze(f);
  }

  function toggle(page: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }

  async function apply(mode: ApplyMode) {
    if (!patch) return;
    setStage("applying");
    setProgress(0);

    // 3 · Upload the admin-selected page rasters through the existing image pipeline.
    const chosen = pages.filter((p) => selected.has(p.page));
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
    showToast("Form populated from PDF.");
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
        style={{ maxWidth: 720, margin: "0 auto", background: "var(--white)", borderRadius: 6, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.5)" }}
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
                  borderRadius: 6, padding: "40px 20px", textAlign: "center", cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                <CloudUpload size={34} strokeWidth={1.2} style={{ color: "var(--gold)", marginBottom: 10 }} />
                <div style={{ fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
                  Drag &amp; drop a product PDF, or click to browse
                </div>
                <div style={{ fontSize: 11, color: "var(--ink4)" }}>
                  Catalogue page or spec sheet · up to 50 MB · multi-page supported
                </div>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--ink4)", lineHeight: 1.7, margin: 0 }}>
                We&apos;ll extract images, text, dimensions, variants, finishes and SEO fields, then let you
                review everything before it fills the form. Nothing is saved until you click Save in the editor.
              </p>
            </>
          )}

          {/* Working stages */}
          {(stage === "rendering" || stage === "extracting" || stage === "applying") && (
            <div style={{ padding: "28px 8px", textAlign: "center" }}>
              <RefreshCw size={26} strokeWidth={1.5} style={{ color: "var(--gold)", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 14, marginBottom: 12 }}>{STAGE_LABEL[stage]}</div>
              <Bar value={stage === "extracting" ? undefined : progress} />
              {stage === "extracting" && (
                <div style={{ fontSize: 10, color: "var(--ink4)", marginTop: 10 }}>Parsing the document — this can take a moment for scanned PDFs (OCR).</div>
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
                <Check size={15} strokeWidth={2} /> Extracted — review before applying
              </div>

              {/* Extracted fields summary */}
              <div style={{ display: "grid", gap: 8, fontSize: 12, color: "var(--ink3)", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 4, padding: 12 }}>
                <Field label="Series / Category" value={patch.series} />
                <Field label="Name" value={patch.name} />
                <Field label="Description" value={patch.description} clamp />
                <Field label="Finishes" value={patch.finishes.join(", ")} />
                <Field label="Models" value={patch.models.map((m) => [m.code, m.dims, m.eur ? `€${m.eur}` : ""].filter(Boolean).join(" · ")).join("  |  ")} />
              </div>

              {/* Page images */}
              {pages.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 6 }}>
                    Images to import ({selected.size}/{pages.length} selected) — click to toggle
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {pages.map((p) => {
                      const on = selected.has(p.page);
                      return (
                        <button key={p.page} onClick={() => toggle(p.page)} style={{ position: "relative", width: 84, height: 110, borderRadius: 4, overflow: "hidden", border: `2px solid ${on ? "var(--gold)" : "var(--cream3)"}`, padding: 0, cursor: "pointer", background: "var(--cream2)" }} aria-pressed={on}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.dataUrl} alt={`Page ${p.page}`} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: on ? 1 : 0.45 }} />
                          {on && (
                            <span style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 3, background: "var(--gold)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                <div style={{ fontSize: 11, color: "var(--ink4)", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 4, padding: "8px 10px" }}>
                  No page images could be rendered from this PDF — add product photos manually after applying.
                </div>
              )}

              {/* Attach the source PDF as a product document */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink3)", cursor: "pointer" }}>
                <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
                Attach the source PDF to this product&apos;s documents
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
              <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 10 }}>Completed — form populated.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnGold: React.CSSProperties = {
  background: "var(--gold)", border: "none", color: "white", padding: "9px 18px", fontSize: 11,
  cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 3, fontWeight: 600,
  letterSpacing: ".06em", display: "inline-flex", alignItems: "center", gap: 7,
};
const btnGhost: React.CSSProperties = {
  background: "none", border: "1px solid var(--cream3)", color: "var(--ink3)", padding: "9px 16px",
  fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 3,
};

function Bar({ value }: { value?: number }) {
  // Indeterminate when value is undefined.
  return (
    <div style={{ height: 6, borderRadius: 4, background: "var(--cream3)", overflow: "hidden", maxWidth: 340, margin: "0 auto" }}>
      <div
        style={{
          height: "100%", background: "var(--gold)", borderRadius: 4,
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
