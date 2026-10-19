export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[#1A1A1F] ${className}`}
    />
  )
}

export function GroupCardSkeleton() {
  return (
    <div className="rounded-md border border-[#2A2A32] bg-[#111113] p-5">
      <Skeleton className="h-5 w-2/3 mb-3" />
      <Skeleton className="h-3 w-1/3 mb-4" />
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="w-7 h-7 rounded-full" />)}
      </div>
    </div>
  )
}

export function ExpenseCardSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#2A2A32]">
      <Skeleton className="w-9 h-9 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-1/2 mb-2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

// Mirrors the group detail page: header, 3 stat tiles, tabs, filter pills, expense list.
// Keep in sync with groups/[id]/page.tsx so the page doesn't jump when data arrives.
export function GroupPageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6" aria-busy="true" aria-label="Loading trip">
      {/* Header: back arrow, title + dates, action buttons */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-5 h-5 rounded-sm shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Skeleton className="w-9 h-9 rounded-sm" />
          <Skeleton className="w-9 h-9 rounded-sm" />
          <Skeleton className="w-16 sm:w-20 h-9 rounded-sm" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-sm border border-[#2A2A32] bg-[#111113] px-2 py-2.5 sm:px-3 sm:py-3">
            <Skeleton className="h-2.5 w-14 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111113] border border-[#2A2A32] rounded-sm p-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={`flex-1 h-9 ${i === 0 ? 'bg-[#2A2A32]' : ''}`} />
        ))}
      </div>

      {/* Filter pills + count */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-48 rounded-sm" />
        <Skeleton className="h-3 w-12" />
      </div>

      {/* Expense list, grouped by date */}
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        {[0, 1, 2].map((i) => <ExpenseCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
