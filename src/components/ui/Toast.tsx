import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast { id: string; type: ToastType; message: string }
interface ToastContextValue { toast: (type: ToastType, message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

const config = {
  success: { icon: CheckCircle, bg: 'bg-emerald-500',  bar: 'bg-emerald-400' },
  error:   { icon: XCircle,     bg: 'bg-red-500',      bar: 'bg-red-400' },
  warning: { icon: AlertCircle, bg: 'bg-amber-500',    bar: 'bg-amber-400' },
  info:    { icon: Info,        bg: 'bg-blue-500',     bar: 'bg-blue-400' },
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-72 no-print">
        {toasts.map(t => {
          const { icon: Icon, bg } = config[t.type]
          return (
            <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-white animate-slide-right ${bg}`}>
              <Icon size={16} className="flex-shrink-0 opacity-90" />
              <p className="text-sm font-medium flex-1 leading-tight">{t.message}</p>
              <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
