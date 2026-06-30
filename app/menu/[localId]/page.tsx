import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

interface Params { params: Promise<{ localId: string }> }

interface Categoria { id: string; nombre: string }
interface Producto {
  id: string; nombre: string; descripcion: string | null
  precio: number; categoria_id: string | null; agotado: boolean; imagen_url: string | null
}
interface Config {
  nombre_negocio: string; tipo_negocio: string; telefono: string | null; logo_url: string | null
}

const TIPO_LABELS: Record<string, string> = {
  food_truck: 'Food Truck', rotiseria: 'Rotisería', pizzeria: 'Pizzería',
  restaurante: 'Restaurante', cafeteria: 'Cafetería', otro: 'Gastronomía',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function MenuPublicoPage({ params }: Params) {
  const { localId } = await params

  const [{ data: config }, { data: categorias }, { data: productos }] = await Promise.all([
    supabase.from('config_local').select('nombre_negocio, tipo_negocio, telefono, logo_url').eq('local_id', localId).single(),
    supabase.from('categorias').select('*').eq('local_id', localId).eq('activo', true).order('nombre'),
    supabase.from('productos').select('id, nombre, descripcion, precio, categoria_id, agotado, imagen_url').eq('local_id', localId).eq('activo', true).order('nombre'),
  ])

  if (!config) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <p className="text-gray-500">Menú no encontrado</p>
      </div>
    )
  }

  const cats: Categoria[] = categorias ?? []
  const prods: Producto[] = productos ?? []

  const tipoLabel = TIPO_LABELS[config.tipo_negocio] ?? 'Gastronomía'
  const waLink = config.telefono ? `https://wa.me/549${config.telefono.replace(/\D/g, '')}` : null

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#1e1e1e] sticky top-0 z-10">
        {/* Top: logo + info */}
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-[#252525] flex items-center justify-center">
              {config.logo_url
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={config.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
                : <span className="text-2xl">🍽️</span>
              }
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-tight">{config.nombre_negocio}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs text-gray-400">{tipoLabel}</span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          {(config.telefono || waLink) && (
            <div className="flex gap-2 mt-3">
              {config.telefono && (
                <a href={`tel:${config.telefono}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1e1e1e] hover:bg-[#252525] rounded-xl py-2.5 text-xs font-medium text-white transition">
                  📞 Llamar
                </a>
              )}
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1e1e1e] hover:bg-[#252525] rounded-xl py-2.5 text-xs font-medium text-white transition">
                  💬 WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        {/* Categorías */}
        {cats.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <a href="#todos"
              className="px-4 py-2 rounded-xl bg-[#1e1e1e] text-gray-400 text-xs font-medium whitespace-nowrap hover:bg-orange-500 hover:text-white transition">
              Todos
            </a>
            {cats.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`}
                className="px-4 py-2 rounded-xl bg-[#1e1e1e] text-gray-400 text-xs font-medium whitespace-nowrap hover:bg-orange-500 hover:text-white transition">
                {c.nombre}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-8 pb-10" id="todos">
        {cats.map((cat) => {
          const prodsCat = prods.filter((p) => p.categoria_id === cat.id)
          if (prodsCat.length === 0) return null
          return (
            <section key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{cat.nombre}</h2>
              <div className="space-y-3">
                {prodsCat.map((p) => <CartaCard key={p.id} prod={p} />)}
              </div>
            </section>
          )
        })}

        {(() => {
          const sinCat = prods.filter((p) => !p.categoria_id)
          if (sinCat.length === 0) return null
          return (
            <section>
              {cats.length > 0 && <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Otros</h2>}
              <div className="space-y-3">{sinCat.map((p) => <CartaCard key={p.id} prod={p} />)}</div>
            </section>
          )
        })()}

        {prods.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-4xl mb-3">🍽️</p>
            <p>El menú aún no tiene productos</p>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-[#333]">Powered by GastroApp · Soluciones MDP</p>
      </div>
    </div>
  )
}

function CartaCard({ prod }: { prod: Producto }) {
  return (
    <div className={`flex gap-3 bg-[#181818] border border-[#252525] rounded-2xl overflow-hidden ${prod.agotado ? 'opacity-50' : ''}`}>
      {/* Imagen */}
      <div className="relative w-[90px] flex-shrink-0 bg-[#252525]">
        {prod.imagen_url
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-cover" />
          : <div className="w-full h-full min-h-[90px] flex items-center justify-center text-3xl opacity-20">🍽️</div>
        }
        {prod.agotado && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-[10px] font-bold text-red-300 bg-red-950/80 border border-red-800 px-2 py-0.5 rounded-md">AGOTADO</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col justify-between">
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{prod.nombre}</p>
          {prod.descripcion && (
            <p className="text-xs text-[#777] mt-0.5 leading-snug line-clamp-2">{prod.descripcion}</p>
          )}
        </div>
        <p className="text-base font-bold text-orange-500 mt-2">${prod.precio.toLocaleString()}</p>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Params) {
  const { localId } = await params
  const { data } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).from('config_local').select('nombre_negocio, tipo_negocio').eq('local_id', localId).single()

  const tipo = { food_truck: 'Food Truck', rotiseria: 'Rotisería', pizzeria: 'Pizzería', restaurante: 'Restaurante', cafeteria: 'Cafetería', otro: 'Gastronomía' }[data?.tipo_negocio ?? ''] ?? 'Gastronomía'

  return {
    title: data?.nombre_negocio ? `${data.nombre_negocio} — Carta` : 'Carta digital',
    description: data?.nombre_negocio ? `Consultá la carta de ${data.nombre_negocio} — ${tipo}` : 'Carta digital',
  }
}
