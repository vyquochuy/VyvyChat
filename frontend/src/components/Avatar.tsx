import React from 'react'
import { getVectorAvatarUri } from '../utils/avatar'

interface AvatarProps {
  uid: string
  status?: string // 'online' | 'offline' | 'idle'
  sizeClass?: string // default: w-9 h-9
}

export const Avatar: React.FC<AvatarProps> = ({ uid, status, sizeClass = "w-9 h-9" }) => {
  const avatarUri = getVectorAvatarUri(uid || '')

  let statusBg = '';
  if (status === 'online') {
    statusBg = 'bg-green-500 shadow-[0_0_6px_#22c55e]';
  } else if (status === 'idle') {
    statusBg = 'bg-yellow-500 shadow-[0_0_6px_#eab308]';
  } else if (status === 'offline') {
    statusBg = 'bg-zinc-500';
  }

  return (
    <div className={`rounded-full flex-shrink-0 relative border border-[var(--bg-card-border)] ${sizeClass}`}>
      <img
        src={avatarUri}
        alt="avatar"
        className="w-full h-full rounded-full bg-cover object-cover select-none"
        draggable={false}
      />
      {status && statusBg && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[var(--bg-card)] ${statusBg}`}
        />
      )}
    </div>
  )
}
