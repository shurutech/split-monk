import Image from 'next/image'

interface Props {
  user: { displayName: string; photoURL: string; uid: string; email?: string }
  size?: 20 | 24 | 28 | 32 | 40 | 48
}

export function UserAvatar({ user, size = 32 }: Props) {
  const initials = user.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? '?'

  if (user.photoURL) {
    return (
      <Image
        src={user.photoURL}
        alt={user.displayName || 'Avatar'}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className="rounded-full bg-[rgba(124,107,248,0.15)] border border-[rgba(124,107,248,0.25)] flex items-center justify-center text-[#7C6BF8] font-semibold select-none"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}
