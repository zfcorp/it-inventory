import React, { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, ChevronDown, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/':            { title: 'Dashboard',   sub: 'Overview of your IT assets' },
  '/inventory':   { title: 'Inventory',   sub: 'Manage all IT equipment' },
  '/employees':   { title: 'Employees',   sub: 'Equipment assignments' },
  '/maintenance': { title: 'Maintenance', sub: 'Repair and service records' },
  '/replacement': { title: 'Replacement', sub: 'Equipment replacement workflow' },
  '/reports':     { title: 'Reports',     sub: 'Generate and export reports' },
  '/audit-log':   { title: 'Audit Log',   sub: 'System activity history' },
  '/users':       { title: 'Users',       sub: 'Manage system access' },
  '/settings':    { title: 'Settings',    sub: 'Branches, departments, categories' },
}

const ROLE_BADGE: Record<string, string> = {
  admin:  'bg-blue-100 text-blue-700',
  staff:  'bg-emerald-100 text-emerald-700',
  viewer: 'bg-gray-100 text-gray-600',
}

const Header: React.FC = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { userProfile, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const base = '/' + pathname.split('/')[1]
  const page = PAGE_TITLES[base] || { title: 'IT Inventory', sub: '' }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login')
  }

  const initial = (userProfile?.full_name || userProfile?.email || 'U')[0].toUpperCase()
  const roleBadge = ROLE_BADGE[userProfile?.role || 'viewer']

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-3.5 flex items-center justify-between no-print flex-shrink-0 sticky top-0 z-30">
      {/* Page title */}
      <div className="lg:block hidden">
        <h1 className="text-lg font-bold text-gray-900 leading-tight">{page.title}</h1>
        <p className="text-xs text-gray-400 font-medium">Zurich Finance Corp — IT Inventory System</p>
      </div>
      <div className="lg:hidden w-10" />

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Bell */}
        <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors group">
          <Bell size={17} className="text-gray-400 group-hover:text-gray-600" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-3 py-2 transition-colors border border-transparent hover:border-gray-200"
          >
            {/* Avatar */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white text-xs font-bold">{initial}</span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold text-gray-800 leading-tight">{userProfile?.full_name || 'User'}</div>
              <div className={`text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-md inline-block ${roleBadge}`}>
                {userProfile?.role || 'viewer'}
              </div>
            </div>
            <ChevronDown size={13} className={`text-gray-400 transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
              {/* User info */}
              <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-slate-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{initial}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userProfile?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-400 truncate">{userProfile?.email}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                {userProfile?.role === 'admin' && (
                  <button
                    onClick={() => { setDropdownOpen(false); navigate('/settings') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <Settings size={15} className="text-gray-400" />
                    Settings
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
