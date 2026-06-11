import { Skeleton } from '@/components/ui/LoadingSkeleton'

export default function GroupLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-px">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  )
}
