import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

const Pagination: React.FC<Props> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (total === 0) return null

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= totalPages - 2) return totalPages - 4 + i
    return page - 2 + i
  })

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
      <p className="text-xs text-gray-400 font-medium">
        Showing <span className="text-gray-600 font-semibold">{from}–{to}</span> of{' '}
        <span className="text-gray-600 font-semibold">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-gray-200"
        >
          <ChevronLeft size={15} className="text-gray-500" />
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 text-xs rounded-lg font-semibold transition-all ${
              p === page
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'text-gray-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-transparent hover:border-gray-200"
        >
          <ChevronRight size={15} className="text-gray-500" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
