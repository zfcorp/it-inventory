import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, Wrench, RefreshCw,
  BarChart2, UserCog, Settings, Monitor, Menu, X, ChevronRight,
  Laptop, Printer, Network, Layers, Tv, Smartphone, Tablet,
  Mouse, ChevronDown
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// Inventory sub-tabs — matches the excel tabs from the spec
const INVENTORY_TABS = [
  { label: 'Laptops',             tab: 'laptops',    icon: Laptop },
  { label: 'PC',                  tab: 'pc',         icon: Monitor },
  { label: 'Printers',            tab: 'printers',   icon: Printer },
  { label: 'Routers',             tab: 'routers',    icon: Network },
  { label: 'HUB Switches',        tab: 'switches',   icon: Layers },
  { label: 'Monitors',            tab: 'monitors',   icon: Tv },
  { label: 'Peripherals',         tab: 'peripherals',icon: Mouse },
  { label: 'Working Cellphones',  tab: 'phones',     icon: Smartphone },
  { label: 'Replaced Cellphones', tab: 'replaced-phones', icon: Smartphone },
  { label: 'Tablets',             tab: 'tablets',    icon: Tablet },
]

const navItems = [
  { to: '/',            label: 'Dashboard',   icon: LayoutDashboard, roles: ['admin','staff','viewer'], expandable: false },
  { to: '/inventory',   label: 'Inventory',   icon: Package,         roles: ['admin','staff','viewer'], expandable: true  },
  { to: '/employees',   label: 'Employees',   icon: Users,           roles: ['admin','staff','viewer'], expandable: false },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench,          roles: ['admin','staff','viewer'], expandable: false },
  { to: '/replacement', label: 'Replacement', icon: RefreshCw,       roles: ['admin','staff','viewer'], expandable: false },
  { to: '/reports',     label: 'Reports',     icon: BarChart2,       roles: ['admin','staff','viewer'], expandable: false },
  { to: '/audit-log',   label: 'Audit Log',   icon: Monitor,         roles: ['admin'],                  expandable: false },
  { to: '/users',       label: 'Users',       icon: UserCog,         roles: ['admin'],                  expandable: false },
  { to: '/settings',    label: 'Settings',    icon: Settings,        roles: ['admin'],                  expandable: false },
]

const Sidebar: React.FC = () => {
  const { userProfile } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(
    location.pathname.startsWith('/inventory')
  )

  const role = userProfile?.role || 'viewer'
  const visible = navItems.filter(n => n.roles.includes(role))

  const isInventoryActive = location.pathname.startsWith('/inventory')
  const currentTab = new URLSearchParams(location.search).get('tab') || ''

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}>
        <div className="relative flex-shrink-0">
          <img src="/logo.png.png" alt="Zurich Logo" className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 shadow-lg" />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-bold text-sm leading-tight tracking-tight">Zurich Finance Corp</div>
            <div className="text-slate-500 text-xs font-medium">IT Inventory System</div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-3" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto sidebar-scroll pb-3">
        {!collapsed && (
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest px-3 pb-2 pt-1">Navigation</p>
        )}

        {visible.map(item => {
          if (item.expandable) {
            // Inventory expandable item
            return (
              <div key={item.to}>
                <button
                  onClick={() => {
                    if (!collapsed) setInventoryOpen(o => !o)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                    isInventoryActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  {isInventoryActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full opacity-70" />
                  )}
                  <item.icon size={17} className={`flex-shrink-0 ${isInventoryActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 tracking-tight text-left">{item.label}</span>
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${inventoryOpen ? 'rotate-180' : ''} ${isInventoryActive ? 'text-white/70' : 'text-slate-600'}`}
                      />
                    </>
                  )}
                </button>

                {/* Sub-items */}
                {!collapsed && inventoryOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-slate-700/60 space-y-0.5">
                    {/* All inventory link */}
                    <NavLink
                      to="/inventory"
                      end
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        isInventoryActive && !currentTab
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <Package size={13} />
                      All Inventory
                    </NavLink>

                    {INVENTORY_TABS.map(t => (
                      <NavLink
                        key={t.tab}
                        to={`/inventory?tab=${t.tab}`}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                          currentTab === t.tab
                            ? 'text-blue-400 bg-blue-500/10'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <t.icon size={13} />
                        {t.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          // Regular nav item
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full opacity-70" />
                  )}
                  <item.icon size={17} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  {!collapsed && <span className="flex-1 tracking-tight">{item.label}</span>}
                  {!collapsed && isActive && <ChevronRight size={13} className="text-white/60" />}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 text-white p-2 rounded-xl shadow-lg border border-slate-700"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      <aside className={`relative hidden lg:flex flex-col bg-slate-900 border-r border-slate-800/80 transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-[68px]' : 'w-60'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-slate-950/40 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full">
          <SidebarContent />
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-slate-700 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg border border-slate-600 transition-all z-20"
        >
          <ChevronRight size={11} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>
    </>
  )
}

export default Sidebar
