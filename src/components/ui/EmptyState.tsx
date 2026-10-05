import React from 'react'
import { Inbox } from 'lucide-react'

interface Props {
  title: string
  message?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

const EmptyState: React.FC<Props> = ({ title, message, action, icon }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center mb-4">
      {icon || <Inbox size={26} className="text-gray-300" />}
    </div>
    <h3 className="text-sm font-bold text-gray-600 mb-1">{title}</h3>
    {message && <p className="text-xs text-gray-400 max-w-xs mb-4 leading-relaxed">{message}</p>}
    {action && <div className="mt-1">{action}</div>}
  </div>
)

export default EmptyState
