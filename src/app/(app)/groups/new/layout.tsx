import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Trip',
}

export default function NewGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
