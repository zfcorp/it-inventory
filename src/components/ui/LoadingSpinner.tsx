import React from 'react'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-3', lg: 'w-12 h-12 border-4' }

const LoadingSpinner: React.FC<Props> = ({ size = 'md', message }) => (
  <div className="flex flex-col items-center justify-center gap-3">
    <div className={`${sizes[size]} border-blue-100 border-t-blue-500 rounded-full animate-spin`} />
    {message && <p className="text-xs font-medium text-gray-400">{message}</p>}
  </div>
)

export default LoadingSpinner
