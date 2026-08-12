import { createSyncHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = createSyncHandler();
export const POST = GET;
