import { NextRequest } from "next/server";
import {
  csvRow,
  exportOpportunities,
  OPPORTUNITY_CSV_HEADER,
  opportunityCsvRow
} from "@/lib/export/csv";
import { opportunitySource } from "@/lib/data/source";
import { csvDownloadHeaders, filtersFromSearchParams } from "@/lib/export/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (format !== "csv") {
    return new Response("Formato xlsx ainda não disponível. Use format=csv.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const filters = filtersFromSearchParams(request.nextUrl.searchParams);
  const encoder = new TextEncoder();
  const rows = exportOpportunities(opportunitySource, filters);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${csvRow(OPPORTUNITY_CSV_HEADER)}`));
      try {
        for await (const opportunity of rows) {
          controller.enqueue(encoder.encode(opportunityCsvRow(opportunity)));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: csvDownloadHeaders("oportunidades")
  });
}
