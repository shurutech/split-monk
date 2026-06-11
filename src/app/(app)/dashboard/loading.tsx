import { GroupCardSkeleton } from '@/components/ui/LoadingSkeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-48 bg-[#1A1A1F] rounded animate-pulse" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <GroupCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
