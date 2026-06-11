import { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="mb-5 w-14 h-14 rounded-full bg-[#1A1A1F] border border-[#2A2A32] flex items-center justify-center text-[#4A4A56]">
          {icon}
        </div>
      )}
      <h3 className="text-[#F2F2F7] font-semibold text-base mb-2">{title}</h3>
      {description && <p className="text-[#8E8E9A] text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
