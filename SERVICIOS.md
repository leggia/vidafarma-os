# 🏢 VidaFarma — Arquitectura de Servicios (Company of One)

> **Propósito de este documento.** Definir la estructura completa de VidaFarma como
> una *Company of One*: un negocio que mejora sin inflarse, donde una persona (Luis)
> más un equipo mínimo operan —con ayuda de agentes y automatización— lo que
> normalmente requeriría departamentos enteros.
>
> Este es el **mapa maestro**: cada área de negocio, qué hace, qué la automatiza hoy,
> qué falta, y con qué herramienta se opera. Es un documento vivo.

---

## 0. Filosofía Company of One aplicada a VidaFarma

El principio de Paul Jarvis: **cuestiona el crecimiento por el crecimiento.** En vez
de contratar un equipo de compras, un community manager, un analista y un
programador, VidaFarma usa:

- **Sistemas que acumulan datos** (backend puro, sin IA donde no hace falta).
- **Agentes que interpretan y ejecutan** bajo supervisión humana (el humano aprueba).
- **APIs de los mejores modelos** en vez de infraestructura propia (sin GPU, sin
  servidores 24/7 que mantener — se paga solo lo que se usa).

El resultado: **una farmacia de barrio que compite con cadenas gigantes** en lo que
le importa al cliente (cercanía, rapidez, atención personal), sin su sobrecarga.

Regla de oro transversal: **el agente sugiere, el humano aprueba.** Nada estructural
(precios, dinero, inventario, código en producción) se cambia sin confirmación.

---

## 1. Mapa de áreas de servicio

| # | Área | Qué cubre | Estado |
|---|------|-----------|--------|
| 1 | **Operaciones / Inventario** | Compras, stock, transferencias, vencimientos | 🟢 Operativo |
| 2 | **Ventas / Tienda** | Tienda online, reservas, catálogo, pagos | 🟢 Operativo |
| 3 | **Atención al cliente** | Consultas, reservas, WhatsApp, fidelización | 🟢 Operativo |
| 4 | **Finanzas** | Rentabilidad, gastos, sueldos, reportes | 🟢 Operativo |
| 5 | **Desarrollo (Dev)** | Código, features, mantenimiento de la app | 🟢 Operativo |
| 6 | **Testing / QA** | Verificación, prevención de errores | 🟡 Parcial |
| 7 | **Marketing** | Promociones, recompra, contenido, difusión | 🟡 En diseño |
| 8 | **Inteligencia de negocio** | Análisis, decisiones, competencia | 🟢 Operativo |
| 9 | **Cumplimiento / Legal** | Controlados, recetas, normativa, datos | 🟡 Parcial |

Leyenda: 🟢 operativo · 🟡 parcial o en diseño · 🔴 pendiente.

---

## 2. Área: OPERACIONES / INVENTARIO 🟢

**Qué hace.** Todo lo que entra y se mueve: registrar compras desde facturas,
mantener el stock sincronizado, transferencias entre sucursales, alertas de
vencimiento y de reposición.

**Automatización actual:**
- **Lector de facturas por IA** (foto/PDF → productos, precios, vencimientos). Módulo
  de compras. Aprende de cada emparejamiento manual.
- **Sincronización de ventas** con inventarios365 (fuente de verdad del stock).
- **Asistente — herramientas de inventario:** `stockProducto`, `productosUrgentes`
  (reposición), `pedidoSucursal` (índice de cobertura), `vencimientosProximos`,
  `productosSinRotacion` (capital muerto), `historialCompraProducto`.

**Herramienta de operación:** app web (módulo Compras, Inventario, Transferencias) +
asistente conversacional.

**Responsable:** Luis + regente. **Agente:** asistente (rol admin/regente).

**Pendientes:** migrar lector de facturas de Groq a un modelo de visión vigente.

---

## 3. Área: VENTAS / TIENDA 🟢

**Qué hace.** La farmacia digital de cara al cliente: catálogo, búsqueda, carrito,
reservas, ofertas, pagos.

**Automatización actual:**
- **Tienda pública** (`/tienda`): búsqueda dinámica **por principio activo**
  (usa el campo descripción de 365 + diccionario de respaldo), carrito multi-producto,
  reservas con código VF-XXXX, "lo más vendido", categorías.
- **Motor de promociones unificado:** ofertas por producto, cupones (% o Bs) y promos
  automáticas por monto. Todo calculado server-side.
- **Pagos QR enchufables:** arquitectura lista para BNB/OpenBCB (automático por
  webhook) o modo manual (comprobante). Se activa con credenciales.
- **Panel de reservas** para el staff (pendiente/lista/entregada + estado de pago).
- **Filtro de controlados** (nombre + principio activo + diccionario) — no se venden
  psicotrópicos ni estupefacientes online, igual que la competencia.

**Herramienta de operación:** app web (Tienda para clientes, Reservas para staff).

**Responsable:** Luis + vendedoras. **Agente:** asistente para gestionar ofertas.

**Pendientes:** tramitar cuenta empresarial + API de pago QR; PWA instalable completa.

---

## 4. Área: ATENCIÓN AL CLIENTE 🟢

**Qué hace.** La relación con el cliente: resolver consultas, gestionar reservas,
recordar recompras, premiar la fidelidad.

**Automatización actual:**
- **Cuentas de cliente** con Google (historial de reservas, "pedir de nuevo").
- **Programa de puntos** (estilo Chávez Plus+): 1 punto/Bs, vale al llegar a 1000.
  **Unificado por teléfono** — suma en mostrador (365) y online, en la misma cuenta.
- **Recordatorios de recompra** por WhatsApp, calculados por **tasa de consumo**
  (cantidad ÷ días), con registro de contacto para no repetir.
- **WhatsApp** como canal directo (tocable desde reservas y recordatorios).

**Herramienta de operación:** app web (Fidelización, Reservas) + WhatsApp.

**Responsable:** Luis + vendedoras. **Ventaja Company of One:** atención personal que
las cadenas grandes no pueden dar (recordar a doña María su losartán por su nombre).

**Pendientes:** que las vendedoras registren el teléfono del cliente en 365 al
facturar (habilita puntos de mostrador + recordatorios).

---

## 5. Área: FINANZAS 🟢

**Qué hace.** La salud económica: cuánto se gana de verdad, qué se gasta, sueldos,
rentabilidad por sucursal.

**Automatización actual:**
- **Módulo de rentabilidad** (`rentabilidad.ts`, compartido reporte + asistente):
  ganancia por sucursal con sueldos por asistencia, gastos, cobertura de costo.
- **Asistente — herramientas financieras (solo admin):** `gananciaPeriodo` (con
  confiabilidad del costo), `rentabilidadSucursales`, `estadoPagosGastos`,
  `margenProductos`, `compararPeriodos`, `resumenEjecutivo`.
- **Gastos** (módulo dedicado): registro, pago, ocasionales, por sucursal.
- **Acciones con auditoría:** cambiar precio, marcar gasto pagado, registrar gasto
  (con guardrails y confirmación).

**Herramienta de operación:** app web (Reportes, Gastos) + asistente (rol admin).

**Responsable:** Luis (exclusivo — datos sensibles). **Seguridad:** finanzas solo
para admin; jamás visibles a otros roles.

**Pendientes:** proyecciones de flujo de caja; alertas automáticas de margen bajo.

---

## 6. Área: DESARROLLO (Dev) 🟢

**Qué hace.** Construir y mantener la app: nuevas funciones, correcciones, mejoras.

**Automatización actual:**
- **Claude Code** como agente de desarrollo (corre en el PC 24/7 de la Petrolera,
  accesible por Remote Control desde el celular). Ejecuta tareas de código completas.
- **CI/CD:** push a `main` → GitHub Actions → deploy automático a Railway.
- **Skill `vidafarma`** en `.claude/skills/`: da a Claude Code el contexto del proyecto
  (credenciales de recuperación, comandos de build, endpoints reales, lecciones).
- **Documentación viva:** `CLAUDE.md` (reglas de trabajo), `ARQUITECTURA.md`,
  `CONTINGENCIA.md`, `HISTORIAL_PROYECTO.md`, `CHANGELOG.md`.

**Herramienta de operación:** Claude Code (terminal/celular) + este repo.

**Responsable:** Luis dirige, Claude Code ejecuta. **Modelo:** por API (sin hardware
propio de IA — el camino Company of One).

**Flujo estándar:** describir tarea → Claude Code implementa → verifica compilación →
commit con versión → push → Railway despliega.

**Pendientes:** —

---

## 7. Área: TESTING / QA 🟡

**Qué hace.** Asegurar que lo que se despliega funciona y no rompe lo existente.

**Automatización actual:**
- **Verificación de compilación** obligatoria antes de cada push (esbuild).
- **Heurístico de "usar variable antes de declararla"** (el patrón que causó el crash
  de la tienda): escanea hooks que usan variables declaradas después.
- **Balance de llaves/paréntesis** tras ediciones grandes.
- **Regla:** tras cambios grandes de frontend, abrir la página una vez (los errores de
  inicialización solo aparecen en producción minificada).

**Herramienta de operación:** scripts de verificación + Claude Code.

**Responsable:** Claude Code (automático) + Luis (prueba visual final).

**Pendientes (para pasar a 🟢):**
- Suite de pruebas automatizadas de los endpoints críticos (reservas, puntos, pagos).
- Chequeo pre-push que corra el heurístico + compilación de todos los archivos
  tocados, como filtro estándar.
- Entorno de staging (una rama/deploy de prueba) antes de producción.

---

## 8. Área: MARKETING 🟡

**Qué hace.** Atraer y retener clientes: promociones, difusión, contenido, recompra.

**Automatización actual (base ya construida):**
- **Motor de promociones** (cupones, ofertas, promos por monto) — la herramienta de
  campañas ya existe; se opera por el asistente ("crea un cupón VERANO de 15%").
- **Recordatorios de recompra** — retención automática por WhatsApp.
- **Programa de puntos** — fidelización que incentiva volver.
- **"Lo más vendido"** en la tienda — prueba social que impulsa ventas.

**Diseño propuesto (lo que falta para 🟢):**

Marketing es el área con más oportunidad Company of One. Estructura sugerida, toda
operable por agente + APIs (sin contratar un community manager):

1. **Campañas de promoción** (parcialmente listo)
   - Ya: crear cupones/ofertas por asistente.
   - Falta: calendario de campañas (ej. "oferta de temporada de gripe"), y que el
     asistente sugiera qué poner en oferta según rotación y vencimientos (mover stock
     por vencer con descuento = menos merma + más venta).

2. **Contenido para redes** (nuevo)
   - Un agente que redacte posts para WhatsApp Estado / Facebook: consejos de salud,
     ofertas de la semana, recordatorios de temporada. Con API (Claude/DeepSeek).
   - El humano aprueba y publica. Costo casi nulo.

3. **Segmentación de clientes** (nuevo, aprovecha datos que ya tienes)
   - Con el historial de ventas por teléfono: identificar clientes de crónicos,
     clientes que no vuelven hace X, clientes de alto valor. Campañas dirigidas.

4. **Difusión de la tienda** (nuevo)
   - QR físico en el mostrador → lleva a `/tienda`. Volante con el link.
   - Mensaje post-venta: "Reserva tu próxima compra en línea y gana puntos".

**Herramienta de operación:** asistente (promos) + un futuro "agente de marketing"
(redacción por API) + WhatsApp/redes para publicar.

**Responsable:** Luis aprueba, agente redacta/sugiere.

**Pendientes (orden sugerido):** (1) sugerencias de oferta por rotación/vencimiento,
(2) agente de redacción de contenido, (3) segmentación de clientes, (4) QR de difusión.

---

## 9. Área: INTELIGENCIA DE NEGOCIO 🟢

**Qué hace.** Convertir datos en decisiones: qué se vende, qué conviene, cómo va todo.

**Automatización actual:**
- **Asistente conversacional (Jarvis)** con ~25 herramientas de consulta: ventas,
  ganancias, mejores vendedores, rentabilidad, comparaciones, resumen ejecutivo.
- **Análisis de competencia** documentado (Farmacorp, Chávez, Farma Elías): sus
  fortalezas (escala) y debilidades (experiencia) → la estrategia de VidaFarma.
- **`resumenEjecutivo`:** ventas del día, ritmo del mes vs anterior, pagos,
  vencimientos, cajas — la foto del negocio en un mensaje.

**Herramienta de operación:** asistente (rol admin).

**Responsable:** Luis. **Ventaja:** decisiones con datos reales, no intuición.

**Pendientes:** panel de tendencias visual; alertas proactivas ("las ventas de esta
semana bajaron X% vs la pasada").

---

## 10. Área: CUMPLIMIENTO / LEGAL 🟡

**Qué hace.** Operar dentro de la norma: medicamentos controlados, recetas, datos.

**Automatización actual:**
- **Filtro de controlados** en la tienda (psicotrópicos, estupefacientes, precursores
  según normativa Bolivia): no se ofertan online, se atienden en mostrador con receta.
- **Roles y permisos** (deny by default): finanzas solo admin, cliente solo tienda.
- **Auditoría** de acciones sensibles (quién cambió qué precio, qué gasto).
- **Anti-CSRF** en logins, rate limiting, state por BD.

**Herramienta de operación:** backend (reglas) + revisión de Luis/regente.

**Responsable:** Luis + regente (criterio farmacéutico).

**Pendientes (para 🟢):**
- Política de datos del cliente (qué se guarda, por cuánto, consentimiento) visible
  en la tienda.
- Registro de recetas para controlados que sí se venden en mostrador.
- Revisar cumplimiento de facturación electrónica según normativa vigente.

---

## 11. Cómo se conectan las áreas (flujo Company of One)

```
                    ┌─────────────────────────────┐
                    │   LUIS (decide y aprueba)   │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                         │
   ┌──────▼──────┐        ┌────────▼────────┐       ┌────────▼────────┐
   │  ASISTENTE  │        │   CLAUDE CODE   │       │   VENDEDORAS/   │
   │  (Jarvis)   │        │   (desarrollo)  │       │    REGENTE      │
   │ operación + │        │  código + test  │       │  atención +     │
   │ inteligencia│        │  + deploy       │       │  mostrador      │
   └──────┬──────┘        └────────┬────────┘       └────────┬────────┘
          │                        │                         │
   ┌──────▼────────────────────────▼─────────────────────────▼──────┐
   │                    APP VIDAFARMA (Railway)                      │
   │  Tienda · Reservas · Asistente · Compras · Reportes · Fidelidad │
   └──────────────────────────────┬─────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   INVENTARIOS365 (verdad)    │
                    │   ventas · stock · clientes  │
                    └─────────────────────────────┘
```

Los **modelos de IA se consumen por API** (DeepSeek para el asistente, Claude para
desarrollo, Groq/visión para facturas). Sin hardware propio de IA: el camino
Company of One — siempre el mejor modelo, se paga solo lo usado, cero mantenimiento.

---

## 12. Prioridades sugeridas (hoja de ruta)

Ordenadas por impacto sobre esfuerzo, enfoque Company of One:

1. **Marketing — sugerencias de oferta por rotación/vencimiento** (mueve stock por
   vencer, reduce merma, usa datos que ya tienes). Alto impacto, esfuerzo medio.
2. **Testing — chequeo pre-push automatizado** (evita crashes como el de la tienda).
   Impacto en estabilidad, esfuerzo bajo.
3. **Atención — adopción del registro de teléfono en mostrador** (desbloquea puntos
   y recordatorios masivos). Sin código: es hábito de las vendedoras.
4. **Pagos QR automáticos** (tras el trámite bancario). Ya construido, falta activar.
5. **Marketing — agente de contenido** para redes/WhatsApp. Nuevo, alto valor.
6. **Cumplimiento — política de datos** visible en la tienda. Confianza + norma.

---

*Documento vivo. Actualizar conforme evolucionen las áreas. Última revisión: creación
de la estructura de servicios Company of One.*
