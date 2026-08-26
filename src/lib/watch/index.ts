import { db } from "@/lib/db";
import { createWatchStore } from "@/lib/watch/store";

export const watchStore = createWatchStore(db);
