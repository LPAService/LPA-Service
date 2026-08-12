export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4">
        <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white"
              key={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
