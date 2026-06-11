'use client'

import { GroupForm } from '@/components/groups/GroupForm'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function NewGroupPage() {
  const router = useRouter()
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[#8E8E9A] hover:text-[#F2F2F7] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl text-[#F2F2F7]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>
          New Trip
        </h1>
      </div>
      <GroupForm />
    </div>
  )
}
