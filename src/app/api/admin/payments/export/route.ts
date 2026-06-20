import { NextResponse } from "next/server";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { getPaymentSubmissions } from "@/services/admin/paymentQueries";

/** CSV export of all offline payment submissions. Requires payments.read. */
export async function GET() {
  try {
    await requirePermission("payments.read");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  const rows = await getPaymentSubmissions();
  const header = [
    "Order",
    "Order Status",
    "Customer",
    "Email",
    "Amount INR",
    "Order Total INR",
    "Method",
    "Transaction ID",
    "Paid Date",
    "Submitted Date",
    "Submission Status",
    "Reviewed By",
    "Reviewed Date",
    "Rejection Reason",
  ];

  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.orderNumber,
        r.orderStatus,
        r.customer,
        r.email,
        r.amountInr,
        r.orderTotalInr,
        r.method,
        r.transactionId,
        r.paidAt,
        r.submittedAt,
        r.status,
        r.reviewedBy ?? "",
        r.reviewedAt ?? "",
        r.rejectionReason ?? "",
      ]
        .map(esc)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-export.csv"`,
    },
  });
}
