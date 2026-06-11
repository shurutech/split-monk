import { formatINR, toRupees } from '@/lib/calculations'

interface Props {
  paise: number
  className?: string
  showSign?: boolean
}

export function AmountDisplay({ paise, className = '', showSign = false }: Props) {
  const isPositive = paise > 0
  const isZero     = paise === 0

  const colorClass = isZero
    ? 'text-[#8E8E9A]'
    : isPositive
      ? 'text-[#34D399]'
      : 'text-[#F87171]'

  const sign = showSign && !isZero ? (isPositive ? '+' : '') : ''
  const formatted = formatINR(Math.abs(paise))

  return (
    <span className={`font-mono ${colorClass} ${className}`}>
      {sign}{paise < 0 ? '-' : ''}{formatted}
    </span>
  )
}
