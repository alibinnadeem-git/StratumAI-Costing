import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { RfqLineItem } from "@prisma/client";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  orgName: { fontSize: 10, color: "#64748b" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  meta: { fontSize: 8, color: "#94a3b8", marginTop: 2 },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#2563eb", color: "#2563eb", fontFamily: "Helvetica-Bold", fontSize: 9, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3 },
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 14 },
  infoBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8 },
  infoLabel: { fontSize: 7, textTransform: "uppercase", color: "#94a3b8", marginBottom: 2 },
  infoValue: { fontSize: 9, color: "#1e293b" },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 2, marginTop: 6 },
  tHead: { flexDirection: "row", backgroundColor: "#0f172a" },
  tRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  th: { color: "#fff", fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: 6, textTransform: "uppercase" },
  td: { fontSize: 8.5, padding: 6, color: "#334155" },
  cLine: { width: "8%" }, cDesc: { width: "52%" }, cQty: { width: "13%" }, cUnit: { width: "12%" }, cNotes: { width: "15%" },
  notes: { marginTop: 16, fontSize: 8.5, color: "#475569", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

function fmtDate(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function RfqDocument({ orgName, projectName, rfqNumber, title, dueDate, notes, supplierName, lineItems }: {
  orgName: string; projectName: string; rfqNumber: number; title: string;
  dueDate: Date | null; notes: string | null; supplierName?: string; lineItems: RfqLineItem[];
}) {
  return (
    <Document title={`RFQ-${rfqNumber} — ${title}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}><View><Text style={styles.orgName}>{orgName}</Text><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{projectName} · Request for Quote</Text></View><Text style={styles.badge}>RFQ-{String(rfqNumber).padStart(3, "0")}</Text></View>
        <View style={styles.infoRow}>
          {supplierName && <View style={styles.infoBox}><Text style={styles.infoLabel}>Supplier</Text><Text style={styles.infoValue}>{supplierName}</Text></View>}
          <View style={styles.infoBox}><Text style={styles.infoLabel}>Quote due</Text><Text style={styles.infoValue}>{fmtDate(dueDate)}</Text></View>
          <View style={styles.infoBox}><Text style={styles.infoLabel}>Date issued</Text><Text style={styles.infoValue}>{fmtDate(new Date())}</Text></View>
        </View>
        <View style={styles.table}>
          <View style={styles.tHead}><Text style={[styles.th, styles.cLine]}>Line</Text><Text style={[styles.th, styles.cDesc]}>Description</Text><Text style={[styles.th, styles.cQty]}>Qty</Text><Text style={[styles.th, styles.cUnit]}>Unit</Text><Text style={[styles.th, styles.cNotes]}>Notes</Text></View>
          {lineItems.map((li, i) => <View style={styles.tRow} key={li.id} wrap={false}><Text style={[styles.td, styles.cLine]}>{i + 1}</Text><Text style={[styles.td, styles.cDesc]}>{li.description}</Text><Text style={[styles.td, styles.cQty]}>{li.quantity}</Text><Text style={[styles.td, styles.cUnit]}>{li.unit}</Text><Text style={[styles.td, styles.cNotes]}>{li.notes || "—"}</Text></View>)}
        </View>
        {notes && <View style={styles.notes}><Text style={styles.infoLabel}>Notes</Text><Text>{notes}</Text></View>}
        <Text style={styles.footer} fixed><Text>{orgName} · {projectName}</Text><Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></Text>
      </Page>
    </Document>
  );
}

export async function renderRfqPdf(props: Parameters<typeof RfqDocument>[0]): Promise<Buffer> {
  return renderToBuffer(<RfqDocument {...props} />);
}
