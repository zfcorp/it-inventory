import React from 'react'
import type { AssetStatus } from '../../types'
import { STATUS_COLORS } from '../../utils/constants'

interface Props {
  status: AssetStatus
  size?: 'sm' | 'md'
}

const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const colors = STATUS_COLORS[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  const px = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 ${px} rounded-lg font-semibold ${colors.bg} ${colors.text} tracking-wide`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
      {status}
    </span>
  )
}

export default StatusBadge
