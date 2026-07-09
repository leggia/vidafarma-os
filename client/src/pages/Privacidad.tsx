/**
 * POLÍTICA DE PRIVACIDAD (pública, /privacidad).
 * Cumple dos funciones: transparencia con el cliente (área Legal de SERVICIOS.md)
 * y requisito de Facebook/TikTok para aprobar apps de publicación.
 */
export default function Privacidad() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-5 py-10 text-gray-800">
        <img src="/vidafarma-logo.png" alt="VidaFarma" className="h-10 w-auto mb-6" />
        <h1 className="text-2xl font-black mb-1">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">VidaFarma · Cochabamba, Bolivia · Última actualización: julio 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="font-black text-base mb-2">1. Quiénes somos</h2>
            <p>
              VidaFarma es una farmacia con sucursales en Cochabamba, Bolivia. Esta política
              explica qué datos personales recopilamos cuando usas nuestra tienda en línea y
              nuestros servicios, para qué los usamos y cuáles son tus derechos.
            </p>
          </section>

          <section>
            <h2 className="font-black text-base mb-2">2. Qué datos recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Datos de reserva:</b> tu nombre y número de teléfono, para preparar tu pedido y avisarte cuando esté listo.</li>
              <li><b>Datos de cuenta (opcional):</b> si inicias sesión con Google, tu nombre y correo electrónico, para mostrarte tu historial de reservas y facilitar tus próximas compras.</li>
              <li><b>Historial de compras:</b> los productos que reservas o compras, para tu historial, el programa de puntos y recordatorios útiles de recompra.</li>
              <li><b>Comprobantes de pago:</b> si pagas en línea, la información necesaria para verificar tu pago.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-black text-base mb-2">3. Para qué usamos tus datos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestionar tus reservas y avisarte cuándo recogerlas.</li>
              <li>Acumular y canjear tus puntos del programa de fidelidad.</li>
              <li>Enviarte recordatorios de recompra por WhatsApp, solo cuando sean útiles para ti (puedes pedirnos que no lo hagamos).</li>
              <li>Mejorar nuestro servicio y surtido.</li>
            </ul>
            <p className="mt-2">
              <b>No vendemos ni compartimos tus datos con terceros</b> con fines comerciales.
              Solo usamos proveedores técnicos necesarios para operar (alojamiento del sistema
              y, si pagas en línea, el proveedor de pago).
            </p>
          </section>

          <section>
            <h2 className="font-black text-base mb-2">4. Cuánto tiempo los guardamos</h2>
            <p>
              Conservamos tus datos mientras tengas actividad con nosotros (reservas, puntos)
              y por los plazos que exige la normativa boliviana para registros comerciales.
              Puedes pedir la eliminación de tu cuenta y datos personales en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="font-black text-base mb-2">5. Tus derechos</h2>
            <p>
              Puedes pedirnos ver, corregir o eliminar tus datos personales, y dejar de recibir
              recordatorios, escribiéndonos por WhatsApp o visitando cualquiera de nuestras
              sucursales. Atenderemos tu solicitud a la brevedad.
            </p>
          </section>

          <section>
            <h2 className="font-black text-base mb-2">6. Salud y responsabilidad</h2>
            <p>
              La información de nuestra tienda y publicaciones es de carácter general y no
              reemplaza la consulta con un profesional de salud. Los medicamentos que requieren
              receta se dispensan únicamente en mostrador, con receta válida y criterio de
              nuestro personal farmacéutico regente.
            </p>
          </section>

          <section>
            <h2 className="font-black text-base mb-2">7. Contacto</h2>
            <p>
              Para cualquier consulta sobre esta política o tus datos: visítanos en cualquiera
              de nuestras sucursales en Cochabamba o escríbenos por WhatsApp desde la tienda
              en línea.
            </p>
          </section>
        </div>

        <a href="/tienda" className="inline-block mt-10 text-emerald-700 font-bold text-sm">← Volver a la tienda</a>
      </div>
    </div>
  );
}
