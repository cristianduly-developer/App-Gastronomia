import Link from 'next/link'

const FEATURES_BASICO = [
  '🛵 Delivery con link público y QR',
  '💰 Ventas rápidas (mostrador / take away)',
  '📱 Menú digital QR para tus clientes',
  '👥 Clientes con historial',
  '🏧 Control de caja',
  '📊 Dashboard de ventas del día',
  '🍔 Hasta 50 productos',
  '👤 1 colaborador',
]

const FEATURES_PROFESIONAL = [
  '✅ Todo lo del plan Básico',
  '🪑 Mesas y salón con estados en tiempo real',
  '📋 Comandas por mesa con tandas',
  '👨‍🍳 Monitor de cocina en tiempo real',
  '📱 QR de pedido desde la mesa',
  '🍔 Hasta 150 productos',
  '👥 Hasta 3 colaboradores',
]

const FEATURES_PREMIUM = [
  '✅ Todo lo del plan Profesional',
  '🍔 Productos ilimitados',
  '👥 Hasta 6 colaboradores',
  '⭐ Soporte prioritario',
]

const COMO_FUNCIONA = [
  { emoji: '1️⃣', titulo: 'Creá tu cuenta', desc: 'Entrás con Google, completás el nombre de tu negocio y elegís qué módulos usás.' },
  { emoji: '2️⃣', titulo: 'Cargá tu carta', desc: 'Creá categorías y productos con foto y precio. En minutos tenés tu menú listo.' },
  { emoji: '3️⃣', titulo: 'Empezá a vender', desc: 'Abrí la caja, tomá pedidos, gestioná mesas y delivery — todo desde un solo lugar.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-xl">🍽️</div>
          <span className="font-bold text-lg text-white">GastroApp</span>
        </div>
        <Link
          href="/login"
          className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2 rounded-xl text-sm transition"
        >
          Ingresar
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-950 border border-violet-700 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          Para food trucks, rotiserías y restaurantes
        </div>
        <h1 className="text-5xl font-black text-white leading-tight mb-6">
          Gestioná tu negocio<br />
          <span className="text-violet-400">de punta a punta</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Delivery, mesas, cocina, caja y carta digital — todo en una sola app. Sin papeles, sin quilombos.
        </p>
        <Link
          href="/login"
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-4 rounded-2xl text-lg transition"
        >
          Probalo gratis 28 días →
        </Link>
        <p className="text-gray-600 text-sm mt-4">Sin tarjeta de crédito. Cancelás cuando querés.</p>
      </section>

      {/* Módulos */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Todo lo que necesitás</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: '🛵', titulo: 'Delivery', desc: 'Link público con QR para que tus clientes hagan pedidos desde su celu' },
            { emoji: '🪑', titulo: 'Mesas', desc: 'Estado del salón en tiempo real. Abrí y cerrá comandas con un toque' },
            { emoji: '👨‍🍳', titulo: 'Cocina', desc: 'Monitor con los pedidos ordenados por tiempo. Sin papel, sin gritos' },
            { emoji: '📱', titulo: 'Menú QR', desc: 'Carta digital que tus clientes ven desde su celular, siempre actualizada' },
            { emoji: '💰', titulo: 'Ventas rápidas', desc: 'Facturá en segundos sin necesitar mesa. Ideal para mostrador y take away' },
            { emoji: '🏧', titulo: 'Caja', desc: 'Apertura, cierre, gastos y resumen del día. Control total del efectivo' },
            { emoji: '👥', titulo: 'Colaboradores', desc: 'Cajeros, mozos y cocina con acceso según su rol. Sin compartir contraseñas' },
            { emoji: '📊', titulo: 'Dashboard', desc: 'Ventas del día, ticket promedio y mesas ocupadas de un vistazo' },
          ].map(({ emoji, titulo, desc }) => (
            <div key={titulo} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-violet-700 transition">
              <span className="text-3xl mb-3 block">{emoji}</span>
              <h3 className="font-bold text-white mb-1">{titulo}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">¿Cómo empezás?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {COMO_FUNCIONA.map(({ emoji, titulo, desc }) => (
            <div key={titulo} className="text-center">
              <div className="text-5xl mb-4">{emoji}</div>
              <h3 className="font-bold text-white text-lg mb-2">{titulo}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Planes</h2>
        <p className="text-gray-400 text-center mb-12">Elegí según tu negocio. Podés cambiar de plan en cualquier momento.</p>
        <div className="grid md:grid-cols-3 gap-6">

          {/* Básico */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Básico</p>
              <p className="text-4xl font-black text-white">$25.000<span className="text-lg font-normal text-gray-500">/mes</span></p>
              <p className="text-gray-400 text-sm mt-2">Para food trucks, rotiserías y dark kitchens</p>
            </div>
            <ul className="space-y-2.5 mb-8">
              {FEATURES_BASICO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition text-sm">
              Empezar gratis
            </Link>
          </div>

          {/* Profesional */}
          <div className="bg-violet-950 border-2 border-violet-500 rounded-2xl p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              MÁS POPULAR
            </div>
            <div className="mb-6">
              <p className="text-sm text-violet-300 font-medium uppercase tracking-wider mb-1">Profesional</p>
              <p className="text-4xl font-black text-white">$35.000<span className="text-lg font-normal text-violet-300">/mes</span></p>
              <p className="text-violet-300 text-sm mt-2">Para restaurantes pequeños con salón</p>
            </div>
            <ul className="space-y-2.5 mb-8">
              {FEATURES_PROFESIONAL.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-200">
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="block text-center bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition text-sm">
              Empezar gratis
            </Link>
          </div>

          {/* Premium */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="mb-6">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Premium</p>
              <p className="text-4xl font-black text-white">$50.000<span className="text-lg font-normal text-gray-500">/mes</span></p>
              <p className="text-gray-400 text-sm mt-2">Para restaurantes medianos y grandes</p>
            </div>
            <ul className="space-y-2.5 mb-8">
              {FEATURES_PREMIUM.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition text-sm">
              Empezar gratis
            </Link>
          </div>

        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-black text-white mb-4">¿Listo para empezar?</h2>
        <p className="text-gray-400 text-lg mb-8">28 días gratis, sin tarjeta. En 5 minutos tu negocio está funcionando.</p>
        <Link
          href="/login"
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition"
        >
          Crear mi cuenta gratis →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8 text-center text-gray-600 text-sm">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center text-base">🍽️</div>
          <span className="font-bold text-gray-400">GastroApp</span>
        </div>
        <p>Gestión para negocios gastronómicos</p>
      </footer>

    </div>
  )
}
