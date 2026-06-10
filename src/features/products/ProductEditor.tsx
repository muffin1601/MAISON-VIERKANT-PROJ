"use client";

import { useState } from "react";
import type { ProductView } from "@/services/catalogue/catalogue";
import { showToast } from "@/lib/toast";
import { saveProduct, deleteProduct } from "./actions";
import { useRouter } from "next/navigation";

interface EditModel {
  code: string;
  eur: number;
  dims: string;
}

export function ProductEditor({
  product,
  onClose,
}: {
  product: ProductView | null; // null = new
  onClose: () => void;
}) {
  const router = useRouter();
  const [series, setSeries] = useState(product?.series ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.desc ?? "");
  const [eurPrice, setEurPrice] = useState(product?.eurPrice ?? 0);
  const [heroImg, setHeroImg] = useState(product?.imgs[0] ?? "");
  const [gallery, setGallery] = useState<string[]>(product?.imgs.slice(1) ?? []);
  const [finishes, setFinishes] = useState<string[]>(product?.finishes ?? []);
  const [finInput, setFinInput] = useState("");
  const [models, setModels] = useState<EditModel[]>(
    product?.models.map((m) => ({ code: m.code, eur: m.eur, dims: m.dims })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  function addModel() {
    setModels((m) => [...m, { code: "", eur: 0, dims: "" }]);
  }
  function setModel(i: number, patch: Partial<EditModel>) {
    setModels((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addFinish() {
    const v = finInput.trim();
    if (v && !finishes.includes(v)) setFinishes((f) => [...f, v]);
    setFinInput("");
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
        eurPrice,
        heroImg,
        gallery,
        finishes,
        models: models.filter((m) => m.code.trim()),
        stock: 0,
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,24,20,.8)",
        zIndex: 900,
        overflowY: "auto",
        padding: "24px 16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "var(--white)",
          borderRadius: 6,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: "var(--ink)",
            padding: "16px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600, letterSpacing: ".06em" }}>
              {product ? "Edit Product" : "Add Product"}
            </div>
            <div style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: ".12em", marginTop: 2 }}>
              {product?.code ?? "New"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--cream)", fontSize: 22, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <L label="Series">
              <input className="a-input" style={{ margin: 0 }} value={series} onChange={(e) => setSeries(e.target.value)} placeholder="e.g. U Series" />
            </L>
            <L label="Name">
              <input className="a-input" style={{ margin: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. U Series, LEDA" />
            </L>
          </div>
          <L label="Description">
            <textarea className="a-input" rows={2} style={{ margin: 0, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </L>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <L label="Base EUR Price">
              <input className="a-input" type="number" style={{ margin: 0 }} value={eurPrice} onChange={(e) => setEurPrice(parseFloat(e.target.value) || 0)} />
            </L>
            <L label="Hero Image URL">
              <input className="a-input" style={{ margin: 0 }} value={heroImg} onChange={(e) => setHeroImg(e.target.value)} placeholder="https://…" />
            </L>
          </div>

          <L label="Gallery Image URLs (one per line)">
            <textarea
              className="a-input"
              rows={2}
              style={{ margin: 0, resize: "vertical" }}
              value={gallery.join("\n")}
              onChange={(e) => setGallery(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            />
          </L>

          <L label="Finishes / Colours">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {finishes.map((f) => (
                <span
                  key={f}
                  style={{ background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 999, padding: "3px 10px", fontSize: 11 }}
                >
                  {f}{" "}
                  <button
                    onClick={() => setFinishes((x) => x.filter((y) => y !== f))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink4)" }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              className="a-input"
              style={{ width: 200, margin: 0, fontSize: 11, padding: "6px 10px" }}
              placeholder="Add colour… (Enter)"
              value={finInput}
              onChange={(e) => setFinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFinish();
                }
              }}
            />
          </L>

          <L label="Models / Sizes">
            <table className="a-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>EUR</th>
                  <th>Dimensions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {models.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <input className="a-input" style={{ margin: 0, fontSize: 11 }} value={m.code} onChange={(e) => setModel(i, { code: e.target.value })} />
                    </td>
                    <td>
                      <input className="a-input" type="number" style={{ margin: 0, fontSize: 11, width: 90 }} value={m.eur} onChange={(e) => setModel(i, { eur: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td>
                      <input className="a-input" style={{ margin: 0, fontSize: 11 }} value={m.dims} onChange={(e) => setModel(i, { dims: e.target.value })} />
                    </td>
                    <td>
                      <button
                        onClick={() => setModels((x) => x.filter((_, idx) => idx !== i))}
                        style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="a-btn-g" style={{ width: "auto", padding: "6px 14px", fontSize: 11 }} onClick={addModel}>
              + Add Model
            </button>
          </L>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            {product ? (
              <button
                onClick={remove}
                disabled={saving}
                style={{ background: "none", border: "1px solid #c0392b", color: "#c0392b", padding: "9px 18px", fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 3 }}
              >
                Delete Product
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="a-btn-g" style={{ width: "auto", padding: "9px 18px" }} onClick={onClose}>
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{ background: "var(--gold)", border: "none", color: "white", padding: "9px 22px", fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 3, letterSpacing: ".08em" }}
              >
                {saving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="a-label">{label}</label>
      {children}
    </div>
  );
}
