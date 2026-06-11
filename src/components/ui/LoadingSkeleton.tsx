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
