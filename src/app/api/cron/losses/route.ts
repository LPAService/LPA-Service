import { createLossesHandler } from "@/lib/sync/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = createLossesHandler();
export const POST = GET;
