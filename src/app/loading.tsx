export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-subtle)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4">
        <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-border)]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-72 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)]"
              key={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
