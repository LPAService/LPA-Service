import { describe, expect, it } from "vitest";
import { describeFreshness } from "@/lib/data/freshness";

const now = new Date("2026-09-11T20:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("selo de frescor da coleta", () => {
  it("sem registro de coleta não finge estar em dia", () => {
    expect(describeFreshness({ lastFinishedAt: null, status: null }, now)).toEqual({
      value: "—",
      label: "coleta sem registro",
      stale: true
    });
  });

  it("mostra minutos, horas e dias conforme a distância", () => {
    expect(describeFreshness({ lastFinishedAt: minutesAgo(0), status: "completed" }, now).value).toBe("agora");
    expect(describeFreshness({ lastFinishedAt: minutesAgo(42), status: "completed" }, now).value).toBe("42 min");
    expect(describeFreshness({ lastFinishedAt: minutesAgo(5 * 60), status: "completed" }, now).value).toBe("5h");
    expect(describeFreshness({ lastFinishedAt: minutesAgo(50 * 60), status: "completed" }, now).value).toBe("2d");
  });

  it("marca atraso só depois de 36h: o cron roda 1x por dia", () => {
    // 24h é uma execução normal do dia anterior, não é atraso
    expect(describeFreshness({ lastFinishedAt: minutesAgo(24 * 60), status: "completed" }, now).stale).toBe(false);
    expect(describeFreshness({ lastFinishedAt: minutesAgo(35 * 60), status: "completed" }, now).stale).toBe(false);
    // passou de 36h: alguma execução diária se perdeu
    expect(describeFreshness({ lastFinishedAt: minutesAgo(37 * 60), status: "completed" }, now).stale).toBe(true);
    expect(describeFreshness({ lastFinishedAt: minutesAgo(72 * 60), status: "completed" }, now)).toMatchObject({
      value: "3d",
      label: "coleta atrasada",
      stale: true
    });
  });

  it("execução partial conta como coleta válida: ela gravou o que leu", () => {
    expect(describeFreshness({ lastFinishedAt: minutesAgo(10), status: "partial" }, now).stale).toBe(false);
  });
});
