'use client'
import { useState } from 'react'

export type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export interface PagoResult {
  metodo1: MetodoPago
  monto1: number
  metodo2?: MetodoPago
  monto2?: number
}

const METODOS: { value: MetodoPago; label: string; emoji: string }[] = [
  { value: 'efectivo',      label: 'Efectivo',      emoji: '💵' },
  { value: 'transferencia', label: 'Transferencia',  emoji: '📲' },
  { value: 'debito',        label: 'Débito',         emoji: '💳' },
  { value: 'credito',       label: 'Crédito',        emoji: '💳' },
]

export const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transf.', debito: 'Débito', credito: 'Crédito',
}

export function labelPago(metodo1: string, metodo2?: string | null): string {
  const l1 = METODO_LABEL[metodo1] ?? metodo1
  if (!metodo2) return l1
  return `${l1} + ${METODO_LABEL[metodo2] ?? metodo2}`
}

interface Props {
  total: number
  onConfirmar: (pago: PagoResult) => void
  onCancelar: () => void
  procesando?: boolean
  titulo?: string
}

export function ModalPago({ total, onConfirmar, onCancelar, procesando, titulo = 'Forma de pago' }: Props) {
  const [combinado, setCombinado] = useState(false)
  const [metodo1, setMetodo1] = useState<MetodoPago>('efectivo')
  const [metodo2, setMetodo2] = useState<MetodoPago>('transferencia')
  const [monto1Str, setMonto1Str] = useState('')

  const monto1 = parseInt(monto1Str.replace(/\D/g, '')) || 0
  const monto2 = total - monto1
  const montoInvalido = monto1 <= 0 || monto1 >= total
  const mismoMetodo = metodo1 === metodo2

  const confirmarSimple = (m: MetodoPago) => {
    onConfirmar({ metodo1: m, monto1: total })
  }

  const confirmarCombinado = () => {
    if (montoInvalido || mismoMetodo) return
    onConfirmar({ metodo1, monto1, metodo2, monto2 })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-white mb-1">{titulo}</h3>
        <p className="text-gray-400 text-sm mb-5">
          Total: <strong className="text-white">${total.toLocaleString()}</strong>
        </p>

        {!combinado ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {METODOS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => confirmarSimple(m.value)}
                  disabled={procesando}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white font-medium text-sm hover:border-violet-500 hover:bg-violet-950 transition disabled:opacity-50 active:scale-95"
                >
                  <span>{m.emoji}</span> {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCombinado(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-gray-600 text-gray-400 text-sm font-medium hover:border-violet-500 hover:text-violet-400 transition"
            >
              ✂️ Combinar dos métodos
            </button>
          </>
        ) : (
          <>
            <div className="space-y-4 mb-5">
              {/* Método 1 + monto */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Primer pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        setMetodo1(m.value)
                        if (m.value === metodo2) {
                          setMetodo2(METODOS.find(x => x.value !== m.value)!.value)
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-medium transition border
                        ${metodo1 === m.value
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={monto1Str}
                    onChange={(e) => setMonto1Str(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Método 2 + resto */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Segundo pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {METODOS.filter(m => m.value !== metodo1).map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetodo2(m.value)}
                      className={`py-2 rounded-xl text-xs font-medium transition border
                        ${metodo2 === m.value
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-gray-900 rounded-xl px-3 py-2">
                  <span className="text-gray-400 text-sm">Resto</span>
                  <span className={`font-bold text-sm ${monto2 < 0 ? 'text-red-400' : monto2 > 0 ? 'text-white' : 'text-gray-500'}`}>
                    {monto2 > 0 ? `$${monto2.toLocaleString()}` : monto2 < 0 ? `−$${Math.abs(monto2).toLocaleString()}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {monto2 < 0 && (
              <p className="text-red-400 text-xs text-center mb-3">El monto supera el total</p>
            )}

            <button
              onClick={confirmarCombinado}
              disabled={procesando || montoInvalido || mismoMetodo}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 text-sm transition mb-2"
            >
              {procesando ? 'Procesando...' : `Confirmar cobro — $${total.toLocaleString()}`}
            </button>
            <button
              onClick={() => { setCombinado(false); setMonto1Str('') }}
              className="w-full py-2 text-gray-500 text-xs hover:text-gray-400 transition"
            >
              ← Un solo método
            </button>
          </>
        )}

        <button onClick={onCancelar} className="w-full py-2 text-gray-600 text-xs mt-1 hover:text-gray-500 transition">
          Cancelar
        </button>
      </div>
    </div>
  )
}
