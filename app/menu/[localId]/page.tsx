import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

interface Params { params: Promise<{ localId: string }> }

interface Categoria { id: string; nombre: string }
interface Producto { id: string; nombre: string; descripcion: string | null; precio: number; categoria_id: string | null; agotado: boolean }
interface Config { nombre_negocio: string; tipo_negocio: string; telefono: string | null }

// Cliente server-side con service role para leer datos públicos del menú
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function MenuPublicoPage({ params }: Params) {
  const { localId } = await params

  const [{ data: config }, { data: categorias }, { data: productos }] = await Promise.all([
    supabase.from('config_local').select('nombre_negocio, tipo_negocio, telefono').eq('local_id', localId).single(),
    supabase.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
    supabase.from('productos').select('id, nombre, descripcion, precio, categoria_id, agotado').eq('local_id', localId).eq('activo', true).order('nombre'),
  ])

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Menú no encontrado</p>
      </div>
    )
  }

  const cats: Categoria[] = categorias ?? []
  const prods: Producto[] = productos ?? []

  // Productos sin categoría
  const sinCategoria = prods.filter((p) => !p.categoria_id)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-xl">🍽️</div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">{config.nombre_negocio}</h1>
            {config.telefono && (
              <a href={`tel:${config.telefono}`} className="text-xs text-gray-400 hover:text-violet-400 transition">
                📞 {config.telefono}
              </a>
            )}
          </div>
        </div>

        {/* Tabs de categorías */}
        {cats.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <a href="#todos" className="px-3 py-1.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-medium whitespace-nowrap hover:bg-violet-600 hover:text-white transition">
              Todos
            </a>
            {cats.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className="px-3 py-1.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-medium whitespace-nowrap hover:bg-violet-600 hover:text-white transition"
              >
                {c.nombre}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8" id="todos">
        {/* Por categoría */}
        {cats.map((cat) => {
          const prodsCat = prods.filter((p) => p.categoria_id === cat.id)
          if (prodsCat.length === 0) return null
          return (
            <section key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="text-base font-bold text-white mb-3 pb-2 border-b border-gray-800">{cat.nombre}</h2>
              <div className="space-y-2">
                {prodsCat.map((p) => <ProductoCard key={p.id} producto={p} />)}
              </div>
            </section>
          )
        })}

        {/* Sin categoría */}
        {sinCategoria.length > 0 && (
          <section>
            {cats.length > 0 && (
              <h2 className="text-base font-bold text-white mb-3 pb-2 border-b border-gray-800">Otros</h2>
            )}
            <div className="space-y-2">
              {sinCategoria.map((p) => <ProductoCard key={p.id} producto={p} />)}
            </div>
          </section>
        )}

        {prods.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-4xl mb-3">🍽️</p>
            <p>El menú aún no tiene productos</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-700">Powered by GastroApp</p>
      </div>
    </div>
  )
}

function ProductoCard({ producto: p }: { producto: Producto }) {
  return (
    <div className={`flex items-start justify-between gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 ${p.agotado ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{p.nombre}</p>
          {p.agotado && (
            <span className="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded-lg flex-shrink-0">Agotado</span>
          )}
        </div>
        {p.descripcion && (
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{p.descripcion}</p>
        )}
      </div>
      <p className="text-base font-bold text-violet-400 flex-shrink-0">${p.precio.toLocaleString()}</p>
    </div>
  )
}

export async function generateMetadata({ params }: Params) {
  const { localId } = await params
  const { data } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).from('config_local').select('nombre_negocio').eq('local_id', localId).single()

  return {
    title: data?.nombre_negocio ? `Menú — ${data.nombre_negocio}` : 'Menú',
    description: `Consultá nuestra carta en línea`,
  }
}
