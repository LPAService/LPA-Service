import { NextRequest, NextResponse } from "next/server";
import { collectProposalLosses, type ProposalLossCollectionResult } from "@/lib/collector/proposal-losses";
import { selectCounties, UnknownCountiesError } from "@/lib/collector/quotations";
import { hasCronSecret } from "@/lib/sync/auth";
import {
  DailySyncAlreadyRunningError,
  listCollectionRunStatus,
  runDailySync,
  type DailySyncOptions,
  type DailySyncSummary
} from "@/lib/sync/daily";

type SyncRunner = (options?: DailySyncOptions) => Promise<DailySyncSummary>;
type LossesRunner = () => Promise<ProposalLossCollectionResult>;
type StatusLoader = (limit?: number) => ReturnType<typeof listCollectionRunStatus>;

export function createSyncHandler(runSync: SyncRunner = runDailySync) {
  return async function handler(request: NextRequest) {
    if (!hasCronSecret(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    try {
      const countiesParam = request.nextUrl.searchParams.get("counties") ??
        request.nextUrl.searchParams.get("cities");
      const counties = countiesParam ? selectCounties(countiesParam) : undefined;
      return NextResponse.json(await (counties ? runSync({ counties }) : runSync()));
    } catch (error) {
      if (error instanceof UnknownCountiesError) {
        return NextResponse.json(
          { error: error.message, unknown: error.unknown },
          { status: 400 }
        );
      }
      if (error instanceof DailySyncAlreadyRunningError) {
        return NextResponse.json(
          { error: error.message, runId: error.runId, county: error.countyName },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  };
}

export function createLossesHandler(runLosses: LossesRunner = collectProposalLosses) {
  return async function handler(request: NextRequest) {
    if (!hasCronSecret(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    try {
      return NextResponse.json(await runLosses());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  };
}

export function createStatusHandler(loadStatus: StatusLoader = listCollectionRunStatus) {
  return async function handler(request: NextRequest) {
    if (!hasCronSecret(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
    const limit = Number.isInteger(requestedLimit) ? requestedLimit : 10;
    return NextResponse.json({ runs: await loadStatus(limit) });
  };
}
