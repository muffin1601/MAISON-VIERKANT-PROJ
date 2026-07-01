import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Path, Line } from "@react-pdf/renderer";

void React;

export interface InvoicePdfItem {
  name: string;
  code: string;
  finish: string;
  qty: number;
  unit: number;
}
export interface InvoicePdfData {
  invoiceNumber: string;
  orderNumber: string;
  date: string;
  customer: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  items: InvoicePdfItem[];
  subtotal: number;
  packaging: number;
  gst: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentId: string;
  paidAt: string;
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
  paidPill: { alignSelf: "flex-end", marginTop: 6, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 2, fontSize: 7, color: "#fff", letterSpacing: 1, backgroundColor: "#2c5c2c" },
  rule: { height: 1.5, backgroundColor: GOLD2, marginTop: 12, marginBottom: 16 },
  cols: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  col: { width: "48%" },
  blockLabel: { fontSize: 7, letterSpacing: 1.5, color: INK4, marginBottom: 4, textTransform: "uppercase" },
  blockLine: { fontSize: 9, color: INK, marginBottom: 2, lineHeight: 1.4 },
  tHead: { flexDirection: "row", backgroundColor: INK, paddingVertical: 7, paddingHorizontal: 8 },
  th: { color: "#f4f0e8", fontSize: 7.5, letterSpacing: 1, fontFamily: "Helvetica-Bold" },
  tRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: CREAM3 },
  tRowAlt: { backgroundColor: "#faf8f4" },
  cProduct: { width: "40%" },
  cFinish: { width: "20%" },
  cQty: { width: "10%", textAlign: "right" },
  cUnit: { width: "15%", textAlign: "right" },
  cLine: { width: "15%", textAlign: "right" },
  cellSub: { fontSize: 7, color: INK4, marginTop: 1 },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 240, justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: INK3 },
  totalValue: { fontSize: 9, color: INK },
  grandRow: { flexDirection: "row", width: 240, justifyContent: "space-between", borderTopWidth: 1, borderTopColor: GOLD2, marginTop: 6, paddingTop: 7 },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: GOLD },
  payBox: { marginTop: 20, padding: 14, backgroundColor: CREAM2, borderRadius: 2 },
  payTitle: { fontSize: 8, letterSpacing: 1.5, color: GOLD, marginBottom: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  payLine: { fontSize: 8, color: INK3, marginBottom: 3 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: CREAM3, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footText: { fontSize: 7, color: INK4 },
});

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

export function InvoicePdf({ d }: { d: InvoicePdfData }) {
  return (
    <Document title={`Invoice ${d.invoiceNumber}`} author="Maison Vierkant India">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brandRow}>
            <Monogram />
            <View style={s.brandText}>
              <Text style={s.brandName}>Maison Vierkant</Text>
              <Text style={s.brandSub}>HANDCRAFTED CLAY · INDIA</Text>
            </View>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>INVOICE</Text>
            <Text style={s.docNo}>{d.invoiceNumber}</Text>
            <Text style={s.docDate}>Order: {d.orderNumber}</Text>
            <Text style={s.docDate}>Date: {d.date}</Text>
            <Text style={s.paidPill}>ADVANCE PAID</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.blockLabel}>From</Text>
            <Text style={[s.blockLine, { fontFamily: "Helvetica-Bold" }]}>Maison Vierkant India</Text>
            <Text style={s.blockLine}>Watcon Pvt. Ltd. · Curated by Watcon</Text>
            <Text style={s.blockLine}>343 Sultanpur, MG Road, New Delhi 110030</Text>
          </View>
          <View style={s.col}>
            <Text style={s.blockLabel}>Bill To</Text>
            <Text style={[s.blockLine, { fontFamily: "Helvetica-Bold" }]}>{d.customer}</Text>
            {d.company ? <Text style={s.blockLine}>{d.company}</Text> : null}
            {d.address ? <Text style={s.blockLine}>{d.address}</Text> : null}
            {d.email ? <Text style={s.blockLine}>{d.email}</Text> : null}
            {d.phone ? <Text style={s.blockLine}>{d.phone}</Text> : null}
            {d.gstin ? <Text style={s.blockLine}>GSTIN: {d.gstin}</Text> : null}
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cProduct]}>PRODUCT</Text>
          <Text style={[s.th, s.cFinish]}>FINISH</Text>
          <Text style={[s.th, s.cQty]}>QTY</Text>
          <Text style={[s.th, s.cUnit]}>UNIT</Text>
          <Text style={[s.th, s.cLine]}>AMOUNT</Text>
        </View>
        {d.items.map((it, i) => (
          <View key={i} style={[s.tRow, ...(i % 2 ? [s.tRowAlt] : [])]} wrap={false}>
            <View style={s.cProduct}>
              <Text>{it.name}</Text>
              {it.code ? <Text style={s.cellSub}>{it.code}</Text> : null}
            </View>
            <Text style={s.cFinish}>{it.finish}</Text>
            <Text style={s.cQty}>{it.qty}</Text>
            <Text style={s.cUnit}>{rupee(it.unit)}</Text>
            <Text style={s.cLine}>{rupee(it.unit * it.qty)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal (ex-GST)</Text>
            <Text style={s.totalValue}>{rupee(d.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Packaging Charges</Text>
            <Text style={s.totalValue}>{rupee(d.packaging)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>GST (18%)</Text>
            <Text style={s.totalValue}>{rupee(d.gst)}</Text>
          </View>
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Total (INR)</Text>
            <Text style={s.grandValue}>{rupee(d.total)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Advance paid</Text>
            <Text style={[s.totalValue, { color: "#2c5c2c" }]}>− {rupee(d.amountPaid)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { fontFamily: "Helvetica-Bold" }]}>Balance due before dispatch</Text>
            <Text style={[s.totalValue, { fontFamily: "Helvetica-Bold" }]}>{rupee(d.balanceDue)}</Text>
          </View>
        </View>

        <View style={s.payBox}>
          <Text style={s.payTitle}>Payment</Text>
          <Text style={s.payLine}>Method: Razorpay (online) · Payment ID: {d.paymentId || "—"}</Text>
          <Text style={s.payLine}>Paid on: {d.paidAt || "—"}</Text>
          <Text style={s.payLine}>
            50% advance received. Balance of {rupee(d.balanceDue)} is payable before dispatch from Ostend, Belgium.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>Maison Vierkant India · Curated by Watcon · GST on invoice</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
