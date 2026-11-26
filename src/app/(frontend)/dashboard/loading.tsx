// Dashboard skeleton — same frame as AppHeader + AppContent (56px header, 1080 content), no spinners.

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <div className="flex min-h-14 items-center gap-3 border-b border-[#e7e5e4] px-4 md:px-5">
        <div className="skeleton h-5 w-36" />
        <div className="skeleton ml-auto hidden h-[38px] w-[320px] md:block" />
      </div>
      <div className="mx-auto w-full max-w-[1080px] space-y-4 px-4 pt-4 pb-6 md:px-5 md:pt-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-[12px] border border-[#e7e5e4] bg-white p-4">
              <div className="skeleton h-3.5 w-24" />
              <div className="skeleton h-7 w-14" />
            </div>
          ))}
        </div>
        <div className="rounded-[12px] border border-[#e7e5e4] bg-white">
          <div className="border-b border-[#f0eeec] p-4">
            <div className="skeleton h-4 w-40" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[#f0eeec] px-4 py-3.5 last:border-0">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
