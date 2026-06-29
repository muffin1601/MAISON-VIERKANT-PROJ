"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductView, DocumentView } from "@/services/catalogue/catalogue";
import { calcINR, type PricingConfig } from "@/services/pricing/PricingService";
import { showToast } from "@/lib/toast";
import { useUpload, deleteAsset } from "@/lib/upload/useUpload";
import {
  X, FileText, Upload, ImagePlus, Plus, Trash2, CloudUpload, ArrowRight, Download, FileUp,
} from "@/components/ui/icons";
import { saveProduct, deleteProduct } from "./actions";
import { PdfImport, type ApplyMode } from "./PdfImport";
import type { ImportFormPatch } from "@/validations/pdfImport";

interface EditModel {
  code: string;
  eur: number;
  dims: string;
}
type DocItem = DocumentView;

const PRESET_COLOURS = [
  "Natural Clay", "White", "Ivory", "Terracotta Red", "Bordeaux Red", "Deep Blue",
  "Anthracite", "Cork", "Nordic White", "Dark Green", "Taupe Grey",
];

const MAX_GALLERY = 8;

export function ProductEditor({
  product,
  pricing,
  onClose,
}: {
  product: ProductView | null; // null = new
  pricing: PricingConfig;
  onClose: () => void;
}) {
  const router = useRouter();
  const { upload, uploading } = useUpload();

  const [series, setSeries] = useState(product?.series ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.desc ?? "");
  const [heroImg, setHeroImg] = useState(product?.imgs[0] ?? "");
  const [gallery, setGallery] = useState<string[]>(product?.imgs.slice(1) ?? []);
  const [drawings, setDrawings] = useState<string[]>(product?.drawings ?? []);
  const [documents, setDocuments] = useState<DocItem[]>(product?.documents ?? []);
  const [status, setStatus] = useState(product?.status ?? "ACTIVE");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [finishes, setFinishes] = useState<string[]>(product?.finishes ?? []);
  const [finInput, setFinInput] = useState("");
  const [models, setModels] = useState<EditModel[]>(
    product?.models.map((m) => ({ code: m.code, eur: m.eur, dims: m.dims })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const heroFile = useRef<HTMLInputElement>(null);
  const galleryFile = useRef<HTMLInputElement>(null);
  const drawingsFile = useRef<HTMLInputElement>(null);
  const documentsFile = useRef<HTMLInputElement>(null);

  function addModel() {
    setModels((m) => [...m, { code: "", eur: 0, dims: "" }]);
  }
  function setModel(i: number, patch: Partial<EditModel>) {
    setModels((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addFinish(value?: string) {
    const v = (value ?? finInput).trim();
    if (v && !finishes.includes(v)) setFinishes((f) => [...f, v]);
    setFinInput("");
  }
  function toggleFinish(v: string) {
    setFinishes((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));
  }

  async function onHero(files: FileList | null) {
    if (!files?.[0]) return;
    const a = await upload(files[0], "product-image");
    if (a) setHeroImg(a.url);
  }
  async function onGallery(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_GALLERY - gallery.length;
    if (room <= 0) {
      showToast(`Maximum ${MAX_GALLERY} photos`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    const urls: string[] = [];
    for (const f of picked) {
      const a = await upload(f, "product-image");
      if (a) urls.push(a.url);
    }
    if (urls.length) setGallery((g) => [...g, ...urls]);
  }
  async function onDrawings(files: FileList | null) {
    if (!files?.length) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const a = await upload(f, "drawing");
      if (a) urls.push(a.url);
    }
    if (urls.length) setDrawings((d) => [...d, ...urls]);
  }
  async function onDocuments(files: FileList | null) {
    if (!files?.length) return;
    const added: DocItem[] = [];
    for (const f of Array.from(files)) {
      const a = await upload(f, "document");
      if (a) {
        added.push({
          url: a.url,
          filename: a.filename,
          kind: "DOCUMENT",
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          bucket: a.bucket,
          storageKey: a.key,
        });
      }
    }
    if (added.length) setDocuments((d) => [...d, ...added]);
  }
  async function removeDocument(i: number) {
    const doc = documents[i];
    setDocuments((d) => d.filter((_, x) => x !== i));
    if (doc.bucket && doc.storageKey) void deleteAsset(doc.bucket, doc.storageKey);
  }

  // True when the form already holds content → PdfImport offers Replace/Merge/Skip.
  const hasExistingData = Boolean(
    series.trim() || name.trim() || description.trim() ||
    heroImg || gallery.length || finishes.length || models.length,
  );

  /**
   * Apply an extracted PDF patch onto the form.
   *   replace — overwrite each field that the import provides a value for.
   *   merge   — only fill empty fields; append new unique list items (finishes/models).
   * Image URLs are uploaded already (via the existing upload flow) and slotted into hero/gallery.
   */
  function applyImport(patch: ImportFormPatch, imageUrls: string[], docs: DocItem[], mode: ApplyMode) {
    const put = (val: string, cur: string, set: (v: string) => void) => {
      if (!val) return;
      if (mode === "replace" || !cur.trim()) set(val);
    };
    put(patch.series, series, setSeries);
    put(patch.name, name, setName);
    put(patch.description, description, setDescription);

    if (patch.finishes.length) {
      setFinishes((cur) =>
        mode === "replace" ? Array.from(new Set(patch.finishes)) : Array.from(new Set([...cur, ...patch.finishes])),
      );
    }
    if (patch.models.length) {
      const incoming: EditModel[] = patch.models.map((m) => ({ code: m.code, eur: m.eur, dims: m.dims }));
      setModels((cur) => {
        if (mode === "replace" || cur.length === 0) return incoming;
        const seen = new Set(cur.map((m) => m.code.trim().toLowerCase()));
        return [...cur, ...incoming.filter((m) => !m.code || !seen.has(m.code.trim().toLowerCase()))];
      });
    }

    // Images: first becomes hero (if replacing or none set), rest extend the gallery.
    if (imageUrls.length) {
      const [first, ...rest] = imageUrls;
      let overflow = rest;
      if (mode === "replace" || !heroImg) {
        setHeroImg(first);
      } else {
        overflow = imageUrls; // keep existing hero; all imported go to gallery
      }
      if (overflow.length) {
        setGallery((g) => {
          const base = mode === "replace" ? [] : g;
          return [...base, ...overflow].slice(0, MAX_GALLERY);
        });
      } else if (mode === "replace") {
        setGallery([]);
      }
    }

    // Source PDF (and any other extracted docs) → existing documents list, de-duplicated by URL.
    if (docs.length) {
      setDocuments((cur) => {
        const have = new Set(cur.map((d) => d.url));
        return [...cur, ...docs.filter((d) => !have.has(d.url))];
      });
    }
  }

  async function save() {
    if (!series.trim() || !name.trim()) {
      showToast("Series and name are required.");
      return;
    }
    setSaving(true);
    try {
      await saveProduct({
        id: product?.id,
        series,
        name,
        description,
        eurPrice: models[0]?.eur ?? 0,
        status: status as "ACTIVE" | "DRAFT" | "ARCHIVED",
        featured,
        heroImg,
        gallery,
        drawings,
        documents,
        finishes,
        models: models.filter((m) => m.code.trim()),
      });
      showToast(product ? "Product updated." : "Product created.");
      onClose();
      router.refresh();
    } catch {
      showToast("Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!product) return;
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteProduct(product.id);
      showToast("Product deleted.");
      onClose();
      router.refresh();
    } catch {
      showToast("Could not delete product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(26,24,20,.8)", zIndex: 900, overflowY: "auto", padding: "24px 16px" }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: 800, margin: "0 auto", background: "var(--white)", borderRadius: 2, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "var(--ink)", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600, letterSpacing: ".06em" }}>
              {product ? "Edit Product" : "Add Product"}
            </div>
            <div style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: ".12em", marginTop: 2 }}>
              {product?.code ?? "New"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--cream3)", cursor: "pointer", lineHeight: 1, display: "flex" }} aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Editor body */}
        {(
          <div style={{ padding: 22, display: "grid", gap: 18 }}>
            {/* AI import — populate the form from a product PDF */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--ink4)", lineHeight: 1.6 }}>
                Have a catalogue page or spec sheet with clear, selectable text? Auto-fill name,
                series, description, dimensions, models and finishes — and pick product images.
              </div>
              <button
                type="button"
                className="a-btn-o"
                style={{ width: "auto", padding: "8px 16px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
                onClick={() => setShowImport(true)}
              >
                <FileUp size={13} strokeWidth={1.5} /> Import From PDF
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="a-field" style={{ margin: 0 }}>
                <label className="a-label">Series / Category *</label>
                <input className="a-input" style={{ margin: 0 }} value={series} onChange={(e) => setSeries(e.target.value)} placeholder="e.g. U Series, 2025 Collection" />
              </div>
              <div className="a-field" style={{ margin: 0 }}>
                <label className="a-label">Product Name *</label>
                <input className="a-input" style={{ margin: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ARON, LEDA" />
              </div>
            </div>

            <div className="a-field" style={{ margin: 0 }}>
              <label className="a-label">Description (shown to customers)</label>
              <textarea className="a-input" rows={2} style={{ margin: 0, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short evocative description…" />
            </div>

            {/* Status / featured / SEO */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "end" }}>
              <div className="a-field" style={{ margin: 0 }}>
                <label className="a-label">Status</label>
                <select className="a-input" style={{ margin: 0 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ACTIVE">Active (visible on site)</option>
                  <option value="DRAFT">Draft (hidden)</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink3)", cursor: "pointer", paddingBottom: 8 }}>
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                Featured product
              </label>
            </div>
            {/* 1 · Hero */}
            <div>
              <label className="a-label">1 · Hero / Main Product Image</label>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div
                  onClick={() => heroFile.current?.click()}
                  style={{ width: 120, height: 90, background: "var(--cream2)", border: "2px dashed var(--cream3)", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--ink4)", cursor: "pointer", flexShrink: 0, overflow: "hidden", position: "relative" }}
                >
                  {heroImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroImg} alt="Hero" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    "Click to upload"
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <button className="a-btn-o" style={{ width: "auto", padding: "7px 14px", fontSize: 10, marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => heroFile.current?.click()} disabled={uploading}>
                    <Upload size={13} strokeWidth={1.5} /> {heroImg ? "Replace Image" : "Upload Image"}
                  </button>
                  {heroImg && (
                    <button className="a-btn-o" style={{ width: "auto", padding: "7px 14px", fontSize: 10, marginBottom: 6, marginLeft: 6 }} onClick={() => setHeroImg("")}>
                      Remove
                    </button>
                  )}
                  <div style={{ fontSize: 10, color: "var(--ink4)", lineHeight: 1.7 }}>Main product card photo. JPG/PNG/WEBP/SVG.</div>
                  <input ref={heroFile} type="file" accept=".jpg,.jpeg,.png,.webp,.svg" hidden onChange={(e) => { void onHero(e.target.files); e.target.value = ""; }} />
                </div>
              </div>
            </div>

            {/* 2 · Gallery */}
            <div>
              <label className="a-label">2 · In-Use / Lifestyle Pictures</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {gallery.map((url, i) => (
                  <Thumb key={`${url}-${i}`} url={url} onRemove={() => setGallery((g) => g.filter((_, x) => x !== i))} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button className="a-btn-o" style={{ width: "auto", padding: "7px 14px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => galleryFile.current?.click()} disabled={uploading}>
                  <ImagePlus size={13} strokeWidth={1.5} /> Add Photos
                </button>
                <input ref={galleryFile} type="file" accept=".jpg,.jpeg,.png,.webp,.svg" multiple hidden onChange={(e) => { void onGallery(e.target.files); e.target.value = ""; }} />
                <span style={{ fontSize: 10, color: "var(--ink4)" }}>Up to {MAX_GALLERY} photos shown in product detail page. ({gallery.length}/{MAX_GALLERY})</span>
              </div>
            </div>

            {/* 3 · Models */}
            <div>
              <label className="a-label">3 · Models / Sizes with EUR Price</label>
              <div style={{ border: "1px solid var(--cream3)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--ink)" }}>
                      <Th>Model Code</Th>
                      <Th>Dimensions</Th>
                      <Th align="right">EUR (admin only)</Th>
                      <Th align="right">INR preview</Th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--cream3)" }}>
                        <td style={{ padding: 6 }}>
                          <input className="a-input" style={{ margin: 0, fontSize: 11 }} value={m.code} onChange={(e) => setModel(i, { code: e.target.value })} />
                        </td>
                        <td style={{ padding: 6 }}>
                          <input className="a-input" style={{ margin: 0, fontSize: 11 }} value={m.dims} onChange={(e) => setModel(i, { dims: e.target.value })} />
                        </td>
                        <td style={{ padding: 6 }}>
                          <input className="a-input" type="number" style={{ margin: 0, fontSize: 11, width: 90, textAlign: "right" }} value={m.eur} onChange={(e) => setModel(i, { eur: parseFloat(e.target.value) || 0 })} />
                        </td>
                        <td style={{ padding: 6, textAlign: "right", fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap" }}>
                          {m.eur > 0 ? `₹${calcINR(m.eur, pricing).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => setModels((x) => x.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", display: "inline-flex" }} aria-label="Remove model">
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {models.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 14, textAlign: "center", fontSize: 11, color: "var(--ink4)" }}>No models yet — add at least one size.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button className="a-btn-o" style={{ width: "auto", padding: "7px 14px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={addModel}>
                <Plus size={13} strokeWidth={1.5} /> Add Size / Model
              </button>
            </div>

            {/* 4 · Drawings */}
            <div>
              <label className="a-label">4 · Technical Drawings / Line Art</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {drawings.map((url, i) => (
                  <DrawingChip key={`${url}-${i}`} url={url} onRemove={() => setDrawings((d) => d.filter((_, x) => x !== i))} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button className="a-btn-o" style={{ width: "auto", padding: "7px 14px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => drawingsFile.current?.click()} disabled={uploading}>
                  <CloudUpload size={13} strokeWidth={1.5} /> Upload Drawings
                </button>
                <input ref={drawingsFile} type="file" accept=".jpg,.jpeg,.png,.webp,.svg,.pdf" multiple hidden onChange={(e) => { void onDrawings(e.target.files); e.target.value = ""; }} />
                <span style={{ fontSize: 10, color: "var(--ink4)" }}>Technical line drawings. PNG / SVG / PDF.</span>
              </div>
            </div>

            {/* 5 · Documents & Attachments */}
            <div>
              <label className="a-label">5 · Product Documents & Attachments</label>
              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                {documents.map((doc, i) => (
                  <DocRow key={`${doc.url}-${i}`} doc={doc} onRemove={() => removeDocument(i)} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button className="a-btn-o" style={{ width: "auto", padding: "7px 14px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => documentsFile.current?.click()} disabled={uploading}>
                  <CloudUpload size={13} strokeWidth={1.5} /> Upload Documents
                </button>
                <input ref={documentsFile} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple hidden onChange={(e) => { void onDocuments(e.target.files); e.target.value = ""; }} />
                <span style={{ fontSize: 10, color: "var(--ink4)" }}>Brochures, catalogues, spec/tech sheets. PDF / DOC / XLS.</span>
              </div>
            </div>

            {/* 6 · Colours */}
            <div>
              <label className="a-label">6 · Available Colours / Finishes</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {finishes.map((f) => (
                  <span key={f} style={{ background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 999, padding: "3px 10px", fontSize: 11 }}>
                    {f}{" "}
                    <button onClick={() => toggleFinish(f)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink4)", display: "inline-flex", verticalAlign: "middle" }} aria-label={`Remove ${f}`}><X size={11} strokeWidth={2} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="a-input"
                  style={{ width: 160, margin: 0, fontSize: 11, padding: "6px 10px" }}
                  placeholder="Add colour…"
                  value={finInput}
                  onChange={(e) => setFinInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFinish(); } }}
                />
                <button className="a-btn-o" style={{ width: "auto", padding: "6px 12px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => addFinish()}><Plus size={12} strokeWidth={1.5} /> Add</button>
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c}
                    className="pm-preset-btn"
                    onClick={() => toggleFinish(c)}
                    style={finishes.includes(c) ? { background: "var(--ink)", color: "var(--cream)", borderColor: "var(--ink)" } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Save row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--cream3)", paddingTop: 14, gap: 10 }}>
              {product ? (
                <button onClick={remove} disabled={saving} style={{ background: "none", border: "1px solid var(--danger)", color: "var(--danger)", padding: "9px 18px", fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 2, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Trash2 size={14} strokeWidth={1.5} /> Delete Product
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={{ background: "none", border: "1px solid var(--cream3)", color: "var(--ink3)", padding: "9px 18px", fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 2 }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving || uploading} style={{ background: "var(--gold)", border: "none", color: "white", padding: "9px 22px", fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 2, fontWeight: 600, letterSpacing: ".06em", opacity: saving || uploading ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  {saving ? "Saving…" : "Save & Update Website"}
                  {!saving && <ArrowRight size={14} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {showImport && (
      <PdfImport
        hasExistingData={hasExistingData}
        onApply={applyImport}
        onClose={() => setShowImport(false)}
      />
    )}
    </>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "7px 10px", fontSize: 9, letterSpacing: ".1em", color: "rgba(248,245,240,.7)", textAlign: align, fontWeight: 400 }}>
      {children}
    </th>
  );
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function DocRow({ doc, onRemove }: { doc: DocItem; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2 }}>
      <FileText size={18} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.filename}</div>
        <div style={{ fontSize: 9, color: "var(--ink4)", letterSpacing: ".04em" }}>
          {(doc.mimeType ?? "file").replace("application/", "").toUpperCase()} {doc.sizeBytes ? `· ${fmtSize(doc.sizeBytes)}` : ""}
        </div>
      </div>
      <a href={doc.url} target="_blank" rel="noreferrer" title="Preview / download" style={{ color: "var(--ink3)", display: "inline-flex" }}>
        <Download size={15} strokeWidth={1.5} />
      </a>
      <button onClick={onRemove} aria-label="Remove document" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", display: "inline-flex" }}>
        <Trash2 size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Thumb({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div style={{ position: "relative", width: 72, height: 72, borderRadius: 2, overflow: "hidden", border: "1px solid var(--cream3)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <button onClick={onRemove} aria-label="Remove" style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 2, border: "none", cursor: "pointer", color: "#fff", background: "rgba(139,44,44,.9)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={12} strokeWidth={2} /></button>
    </div>
  );
}

function DrawingChip({ url, onRemove }: { url: string; onRemove: () => void }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  const fname = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "file").slice(0, 22);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "6px 26px 6px 8px", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, fontSize: 10, color: "var(--ink3)" }}>
      {isPdf ? (
        <FileText size={18} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 2 }} />
      )}
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--ink3)", textDecoration: "none" }}>{fname}</a>
      <button onClick={onRemove} aria-label="Remove" style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 2, border: "none", cursor: "pointer", color: "#fff", background: "rgba(139,44,44,.9)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={12} strokeWidth={2} /></button>
    </div>
  );
}
