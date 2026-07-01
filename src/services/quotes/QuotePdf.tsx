import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Path,
  Line,
} from "@react-pdf/renderer";

void React;

export interface QuotePdfItem {
  name: string;
  code: string;
  variantCode: string;
  finish: string;
  qty: number;
  unit: number;
}
export interface QuotePdfData {
  number: string;
  date: string;
  customer: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  subtotal: number; // ex-GST, pre-discount
  discount: number; // discount amount (0 when none)
  packaging: number; // ₹30,000 × total qty
  gst: number; // 18% of the discounted subtotal
  total: number; // subtotal − discount + packaging + gst
  items: QuotePdfItem[];
}

const INK = "#1a1814";
const GOLD = "#9a7a3a";
const GOLD2 = "#c4a55a";
const INK3 = "#6b6660";
const INK4 = "#a09890";
const CREAM2 = "#f0ece4";
const CREAM3 = "#e0d9ce";

const rupee = (n: number) => "Rs " + Math.round(n).toLocaleString("en-IN");

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 9, color: INK, fontFamily: "Helvetica" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandText: { marginLeft: 12 },
  brandName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 0.5 },
  brandSub: { fontSize: 7, color: GOLD, letterSpacing: 2, marginTop: 3 },
  docMeta: { alignItems: "flex-end" },
  docTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 3 },
  docNo: { fontSize: 9, color: INK, marginTop: 6, fontFamily: "Helvetica-Bold" },
  docDate: { fontSize: 8, color: INK3, marginTop: 2 },

  rule: { height: 1.5, backgroundColor: GOLD2, marginTop: 12, marginBottom: 16 },

  cols: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  col: { width: "48%" },
  blockLabel: { fontSize: 7, letterSpacing: 1.5, color: INK4, marginBottom: 4, textTransform: "uppercase" },
  blockLine: { fontSize: 9, color: INK, marginBottom: 2, lineHeight: 1.4 },

  statusPill: { alignSelf: "flex-start", marginTop: 6, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 2, fontSize: 7, color: "#fff", letterSpacing: 1 },

  tHead: { flexDirection: "row", backgroundColor: INK, paddingVertical: 7, paddingHorizontal: 8 },
  th: { color: "#f4f0e8", fontSize: 7.5, letterSpacing: 1, fontFamily: "Helvetica-Bold" },
  tRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: CREAM3 },
  tRowAlt: { backgroundColor: "#faf8f4" },
  cProduct: { width: "38%" },
  cFinish: { width: "20%" },
  cQty: { width: "10%", textAlign: "right" },
  cUnit: { width: "16%", textAlign: "right" },
  cLine: { width: "16%", textAlign: "right" },
  cellSub: { fontSize: 7, color: INK4, marginTop: 1 },

  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 220, justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: INK3 },
  totalValue: { fontSize: 9, color: INK },
  grandRow: { flexDirection: "row", width: 220, justifyContent: "space-between", borderTopWidth: 1, borderTopColor: GOLD2, marginTop: 6, paddingTop: 7 },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: GOLD },

  terms: { marginTop: 28, padding: 14, backgroundColor: CREAM2, borderRadius: 2 },
  termsTitle: { fontSize: 8, letterSpacing: 1.5, color: GOLD, marginBottom: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  termLine: { fontSize: 7.5, color: INK3, marginBottom: 3, lineHeight: 1.5 },

  footer: { position: "absolute", bottom: 24, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: CREAM3, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footText: { fontSize: 7, color: INK4 },
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#6b6660", SENT: "#1a4a6b", APPROVED: "#2c5c2c",
  REJECTED: "#8b2c2c", EXPIRED: "#6b4a1a", CONVERTED: "#4a2c6b",
};

function Monogram() {
  return (
    <Svg width="42" height="42" viewBox="0 0 64 64">
      <Rect x="10" y="10" width="44" height="44" rx="3" fill="none" stroke={GOLD2} strokeWidth="1.5" />
      <Path
        d="M24 24 h16 a2 2 0 0 1 2 2 v6 a10 10 0 0 1 -10 10 a10 10 0 0 1 -10 -10 v-6 a2 2 0 0 1 2 -2 z"
        fill="none"
        stroke={GOLD}
        strokeWidth="2"
      />
      <Line x1="22" y1="46" x2="42" y2="46" stroke={GOLD2} strokeWidth="2" />
    </Svg>
  );
}

export function QuotePdf({ q }: { q: QuotePdfData }) {
  return (
    <Document title={`Quote ${q.number}`} author="Maison Vierkant India">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brandRow}>
            <Monogram />
            <View style={s.brandText}>
              <Text style={s.brandName}>Maison Vierkant</Text>
              <Text style={s.brandSub}>HANDCRAFTED CLAY · INDIA</Text>
            </View>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>QUOTATION</Text>
            <Text style={s.docNo}>{q.number}</Text>
            <Text style={s.docDate}>Date: {q.date}</Text>
            <Text style={[s.statusPill, { backgroundColor: STATUS_COLOR[q.status] ?? INK3 }]}>{q.status}</Text>
          </View>
        </View>

        <View style={s.rule} />

        {/* From / To */}
        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.blockLabel}>From</Text>
            <Text style={[s.blockLine, { fontFamily: "Helvetica-Bold" }]}>Maison Vierkant India</Text>
            <Text style={s.blockLine}>Watcon Pvt. Ltd. · Curated by Watcon</Text>
            <Text style={s.blockLine}>343 Sultanpur, MG Road, New Delhi</Text>
            <Text style={s.blockLine}>GST: 07XXXXX0000X1Z0</Text>
          </View>
          <View style={s.col}>
            <Text style={s.blockLabel}>Bill To</Text>
            <Text style={[s.blockLine, { fontFamily: "Helvetica-Bold" }]}>{q.customer}</Text>
            {q.company ? <Text style={s.blockLine}>{q.company}</Text> : null}
            {q.email ? <Text style={s.blockLine}>{q.email}</Text> : null}
            {q.phone ? <Text style={s.blockLine}>{q.phone}</Text> : null}
          </View>
        </View>

        {/* Items */}
        <View style={s.tHead}>
          <Text style={[s.th, s.cProduct]}>PRODUCT</Text>
          <Text style={[s.th, s.cFinish]}>FINISH</Text>
          <Text style={[s.th, s.cQty]}>QTY</Text>
          <Text style={[s.th, s.cUnit]}>UNIT</Text>
          <Text style={[s.th, s.cLine]}>AMOUNT</Text>
        </View>
        {q.items.map((it, i) => (
          <View key={i} style={[s.tRow, ...(i % 2 ? [s.tRowAlt] : [])]} wrap={false}>
            <View style={s.cProduct}>
              <Text>{it.name}</Text>
              {it.code || it.variantCode ? (
                <Text style={s.cellSub}>{[it.variantCode || it.code].filter(Boolean).join(" · ")}</Text>
              ) : null}
            </View>
            <Text style={s.cFinish}>{it.finish}</Text>
            <Text style={s.cQty}>{it.qty}</Text>
            <Text style={s.cUnit}>{rupee(it.unit)}</Text>
            <Text style={s.cLine}>{rupee(it.unit * it.qty)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal (ex-GST)</Text>
            <Text style={s.totalValue}>{rupee(q.subtotal)}</Text>
          </View>
          {q.discount > 0 ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Discount</Text>
              <Text style={s.totalValue}>- {rupee(q.discount)}</Text>
            </View>
          ) : null}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Packaging Charges</Text>
            <Text style={s.totalValue}>{rupee(q.packaging)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>GST (18%)</Text>
            <Text style={s.totalValue}>{rupee(q.gst)}</Text>
          </View>
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Total (INR)</Text>
            <Text style={s.grandValue}>{rupee(q.total)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={s.terms}>
          <Text style={s.termsTitle}>Terms &amp; Conditions</Text>
          <Text style={s.termLine}>• Prices are ex-GST, ex-Delhi. Packaging and GST (18%) are shown separately above; transport outside Delhi charged at actual.</Text>
          <Text style={s.termLine}>• Lead time: 10–14 weeks from confirmed order · 50% advance to commence production.</Text>
          <Text style={s.termLine}>• Each piece is handcrafted in Ostend, Belgium — minor variations in colour &amp; form are inherent.</Text>
          <Text style={s.termLine}>• This quotation is valid for 30 days from the date of issue.</Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footText}>Maison Vierkant India · Curated by Watcon</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
