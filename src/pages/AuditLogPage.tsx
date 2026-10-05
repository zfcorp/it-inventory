import React, { useEffect, useState, useCallback } from 'react'
import { Search, Monitor } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { formatDate } from '../utils/constants'
import type { AuditLog } from '../types'

const PAGE_SIZE = 50

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('audit_logs').select('*', { count: 'exact' })
    if (search) q = q.or(`action.ilike.%${search}%,user_name.ilike.%${search}%,asset_id.ilike.%${search}%`)
    q = q.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data, count } = await q
    if (data) setLogs(data as AuditLog[])
    setTotal(count || 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by user, action, asset ID..." className="input pl-9 py-2" />
        </div>
        <span className="text-sm text-gray-500 ml-auto">{total} log entries</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Timestamp</th>
                <th className="table-header">User</th>
                <th className="table-header min-w-60">Action</th>
                <th className="table-header">Asset ID</th>
                <th className="table-header">Previous</th>
                <th className="table-header">New Value</th>
                <th className="table-header">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><LoadingSpinner /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="py-8">
                  <EmptyState title="No audit logs yet" message="Actions will be recorded here" icon={<Monitor size={28} className="text-gray-400" />} />
                </td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell whitespace-nowrap text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString('en-PH')}
                  </td>
                  <td className="table-cell font-medium">{log.user_name}</td>
                  <td className="table-cell">{log.action}</td>
                  <td className="table-cell font-mono text-blue-600">{log.asset_id || '—'}</td>
                  <td className="table-cell text-xs">
                    {log.previous_value ? <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{log.previous_value}</span> : '—'}
                  </td>
                  <td className="table-cell text-xs">
                    {log.new_value ? <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{log.new_value}</span> : '—'}
                  </td>
                  <td className="table-cell text-xs text-gray-500">{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  )
}

export default AuditLogPage
