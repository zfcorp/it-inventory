import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  loading?: boolean
}

const ConfirmDialog: React.FC<Props> = ({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', confirmVariant = 'danger', loading = false
}) => (
  <Modal open={open} onClose={onClose} title="" size="sm">
    <div className="text-center py-2">
      <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
        confirmVariant === 'danger' ? 'bg-red-50' : 'bg-blue-50'
      }`}>
        {confirmVariant === 'danger'
          ? <Trash2 size={26} className="text-red-500" />
          : <AlertTriangle size={26} className="text-blue-500" />
        }
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'} px-6`}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
)

export default ConfirmDialog
