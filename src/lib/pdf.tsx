import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Rfi } from "@prisma/client";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  orgName: { fontSize: 10, color: "#64748b" },
  projectName: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  meta: { fontSize: 8, color: "#94a3b8", marginTop: 2 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryBox: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, minWidth: 70 },
  summaryNum: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  summaryLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 2 },
  tHead: { flexDirection: "row", backgroundColor: "#0f172a" },
  tRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  th: { color: "#fff", fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: 5, textTransform: "uppercase" },
  td: { fontSize: 8, padding: 5, color: "#334155" },
  cNum: { width: "9%" }, cSheet: { width: "9%" }, cSubject: { width: "26%" },
  cPriority: { width: "9%" }, cStatus: { width: "10%" }, cSub: { width: "12%" }, cNeed: { width: "12%" }, cAns: { width: "13%" },
  detailPageTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  detailCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 10, marginBottom: 10 },
  detailHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  detailNum: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  detailSubject: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  detailLabel: { fontSize: 7, textTransform: "uppercase", color: "#94a3b8", marginTop: 5 },
  detailText: { fontSize: 8.5, color: "#334155", lineHeight: 1.4 },
  detailImg: { marginTop: 6, maxHeight: 200, objectFit: "contain", borderWidth: 1, borderColor: "#e2e8f0" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

function pad(n: number) { return `RFI-${String(n).padStart(3, "0")}`; }
function fmt(d: Date | null) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }

export function RfiLogDocument({ orgName, projectName, projectNumber, rfis, generatedAt }: {
  orgName: string; projectName: string; projectNumber?: string | null; rfis: Rfi[]; generatedAt: Date;
}) {
  const open = rfis.filter((r) => r.status === "OPEN").length;
  const answered = rfis.filter((r) => r.status === "ANSWERED").length;
  const closed = rfis.filter((r) => r.status === "CLOSED").length;
  const sorted = [...rfis].sort((a, b) => a.number - b.number);

  return (
    <Document title={`${projectName} — RFI Log`}>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.headerRow}><View><Text style={styles.orgName}>{orgName}</Text><Text style={styles.projectName}>{projectName}</Text><Text style={styles.meta}>{projectNumber ? `Project #${projectNumber} · ` : ""}RFI Log · Generated {fmt(generatedAt)}</Text></View></View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}><Text style={styles.summaryNum}>{rfis.length}</Text><Text style={styles.summaryLabel}>Total</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryNum}>{open}</Text><Text style={styles.summaryLabel}>Open</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryNum}>{answered}</Text><Text style={styles.summaryLabel}>Answered</Text></View>
          <View style={styles.summaryBox}><Text style={styles.summaryNum}>{closed}</Text><Text style={styles.summaryLabel}>Closed</Text></View>
        </View>
        <View style={styles.table}>
          <View style={styles.tHead} fixed><Text style={[styles.th, styles.cNum]}>RFI #</Text><Text style={[styles.th, styles.cSheet]}>Sheet</Text><Text style={[styles.th, styles.cSubject]}>Subject</Text><Text style={[styles.th, styles.cPriority]}>Priority</Text><Text style={[styles.th, styles.cStatus]}>Status</Text><Text style={[styles.th, styles.cSub]}>Submitted</Text><Text style={[styles.th, styles.cNeed]}>Needed</Text><Text style={[styles.th, styles.cAns]}>Answered</Text></View>
          {sorted.map((r) => <View style={styles.tRow} key={r.id} wrap={false}><Text style={[styles.td, styles.cNum]}>{pad(r.number)}</Text><Text style={[styles.td, styles.cSheet]}>{r.sheet || "—"}</Text><Text style={[styles.td, styles.cSubject]}>{r.subject}</Text><Text style={[styles.td, styles.cPriority]}>{r.priority}</Text><Text style={[styles.td, styles.cStatus]}>{r.status}</Text><Text style={[styles.td, styles.cSub]}>{fmt(r.dateSubmitted)}</Text><Text style={[styles.td, styles.cNeed]}>{fmt(r.dateNeeded)}</Text><Text style={[styles.td, styles.cAns]}>{fmt(r.dateAnswered)}</Text></View>)}
        </View>
        <Text style={styles.footer} fixed><Text>{orgName} · {projectName}</Text><Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></Text>
      </Page>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.detailPageTitle}>RFI Detail</Text>
        {sorted.map((r) => <View style={styles.detailCard} key={r.id} wrap={false}>
          <View style={styles.detailHead}><Text style={styles.detailNum}>{pad(r.number)}</Text><Text style={styles.meta}>{r.status} · {r.priority}</Text></View>
          <Text style={styles.detailSubject}>{r.subject}</Text>
          <Text style={styles.meta}>{r.sheet || "—"} · {r.location || "—"} · Submitted by {r.submittedBy || "—"} on {fmt(r.dateSubmitted)}</Text>
          <Text style={styles.detailLabel}>Question</Text><Text style={styles.detailText}>{r.question}</Text>
          {r.response ? <><Text style={styles.detailLabel}>Response {r.dateAnswered ? `(${fmt(r.dateAnswered)})` : ""}</Text><Text style={styles.detailText}>{r.response}</Text></> : null}
          {r.imageDataUrl ? <Image src={r.imageDataUrl} style={styles.detailImg} /> : null}
        </View>)}
      </Page>
    </Document>
  );
}

export async function renderRfiLogPdf(props: Parameters<typeof RfiLogDocument>[0]): Promise<Buffer> {
  return renderToBuffer(<RfiLogDocument {...props} />);
}
