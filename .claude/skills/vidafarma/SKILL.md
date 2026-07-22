---
name: vidafarma
description: Conocimiento del proyecto VidaFarma (app web de gestión para una farmacia en Cochabamba, Bolivia; dueño Luis/leggia). Úsalo SIEMPRE que Luis pida trabajar en VidaFarma, su farmacia, el repo vidafarma-os, el asistente, los módulos de compras, inventario, pedidos, transferencias, bandeja de facturas XML, reportes, gastos, obligaciones o asistencia, la integración con inventarios365, o cualquier tarea de código de este proyecto. Contiene comandos de verificación, endpoints REALES de 365, reglas que no se deben romper y las lecciones aprendidas a golpes. Consúltalo al inicio de cada sesión.
---

# VidaFarma — Conocimiento del proyecto

App web Node.js/TypeScript (React + tRPC + Drizzle/MySQL) para gestionar una
farmacia con 4 sucursales. Dueño: Luis (GitHub `leggia`). Responder en español.
Se integra con **inventarios365**, el sistema externo de facturación/inventario.

> Documentación completa: `CLAUDE.md` (reglas, endpoints reales, lecciones) y
> `HISTORIAL_PROYECTO.md` (contexto largo). Ante duda, mandan esos dos.

## Entorno y despliegue

- Repo: `github.com/leggia/vidafarma-os` (el viejo `vidafarmacia-osManus` redirige).
- Deploy: push a `main` → Railway automático. MySQL en Railway.
- Token de GitHub: **pedírselo a Luis, nunca inventarlo ni commitearlo.**
  Al mostrar salidas de git, filtrar: `sed 's/ghp_[A-Za-z0-9]*/ghp_***/g'`.
- Subir la versión en `package.json` en cada commit (se ve en el pie del menú).

## Antes de cada push (OBLIGATORIO)

El build de vite falla localmente (falta `@builder.io/vite-plugin-jsx-loc`, solo
existe en Railway); **eso no es un error real**. Verificar así:

```bash
# Servidor completo
npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=/tmp/tb
# Una página del cliente
npx esbuild client/src/pages/X.tsx --bundle --format=esm --jsx=automatic \
  --external:react --external:react-dom --external:@/* --external:wouter \
  --external:sonner --external:lucide-react --external:recharts --outfile=/tmp/x.js
# Tipos (detecta lo que esbuild NO ve, como usar sql sin importarlo)
npx tsc --noEmit          # baseline: 45 errores preexistentes. Si sube, algo nuevo está mal.
npx vitest run            # 28 tests pasando
```

`esbuild` valida sintaxis, **no runtime**. `tsc --noEmit` es obligatorio.

## Reglas que no se rompen

- **NUNCA** `drizzle-kit push --force` (borra las tablas de ventas).
- Columnas/tablas nuevas: sentencia idempotente en el array `migraciones` de
  `server/tablas-gastos.ts` (corre al arrancar, con try/catch).
- El servidor debe **escuchar primero**; cero llamadas a 365 al arrancar.
- `vite.config.ts` también corre en runtime del servidor: nada que pueda lanzar.
- Zod tolerante (nullable/optional) + sanitizar en el handler.
- En `routers.ts` cada procedimiento importa `sql` dinámicamente
  (`const { sql } = await import("drizzle-orm")`).

## inventarios365 — endpoints REALES

**No inventar endpoints ni payloads.** Si algo no está documentado, pedirle a Luis
una captura (F12 → Network → acción → *Copy as cURL*). Ya pasó que un endpoint
inventado devolvía 200 sin registrar nada (transferencias que no se reflejaban).

- Traspaso: `POST /traspaso/registrar` con
  `{tipo_traspaso:"Salida", almacen_origen, almacen_destino, fecha_traspaso, data:[...]}`
  y cada línea `{idarticulo, idalmacen, idalmacendes, codigo, cantidad_traspaso,
  nombre_producto, precio_costo_unid, saldo_stock}`.
- Saldo por almacén: `GET /inventarios/saldostock?idAlmacen=&idArticulo=`
- Verificar traspasos: `GET /list/traspasos?fechaInicio=&fechaFin=`
- Cabecera de venta: `GET /venta/obtenerCabecera?id=` → estado en `venta[0].estado`.
- Ventas: `GET /venta?page=N` (pág. 1 = más reciente) · detalle
  `GET /venta/obtenerDetalles?id=`
- Cajas: `GET /caja?page=&buscar=&criterio=` (trae `saldoFaltante`, `saldoSobrante`).
- Almacenes: `GET /almacen/selectAlmacen` (cacheado 10 min).
- Compras: `POST /ingreso/registrar` · precios `POST /articulo/actualizarPrecios`
  y `POST /articulo/actualizarPrecioVenta`.

Almacenes: **1** ALMACEN PRINCIPAL · **2** Almacen Petrolera · **3** Almacen Lanza ·
**4** Almacen Cobol. Sucursales en ventas: "Casa Matriz", "Sucursal Petrolera",
"Sucursal Lanza", "Casa Matriz Cobol" (comparar EXACTO, no con LIKE).

## Estado de ventas (para que los reportes cuadren)

`ventas.estado` es un número en texto: **"1" válida · "0" cancelada · "4" anulada**
(la interfaz de 365 muestra "Cancelado", pero internamente es 0). Usar siempre los
filtros de `server/ventas-comun.ts`: `FILTRO_NO_ANULADA` para `ventas` y
`FILTRO_DETALLE_NO_ANULADA` para `ventas_detalle` (que no tiene columna estado).
Si se agrega un reporte nuevo, aplicarlos o los números no cuadrarán con 365.

La sincronización incremental solo trae ventas nuevas, así que las anulaciones
posteriores no se veían: `refrescarEstadoVentasRecientes()` en `sync-ventas.ts` lee
la cabecera individual y corrige el estado (cron + `/api/admin/refrescar-estados-ventas`).

## Lecciones aprendidas (caras)

- **Verificar en vivo, no confiar en el 200.** 365 puede responder sin error y no
  aplicar nada. Tras un traspaso se comprueba contra `/list/traspasos`; tras ajustar
  inventario se verifica que el producto siga existiendo.
- **Todo o nada.** Si falta un producto o no hay saldo en el origen, se cancela la
  transferencia completa. Nunca dejar operaciones a medias.
- **Nunca buscar sucursal/almacén con `includes()`**: "Casa Matriz" engancha
  "Casa Matriz Cobol" según el orden que devuelva 365. Exacta; parcial solo si es
  inequívoca; si es ambigua, rechazar con mensaje claro.
- **Una sola función por regla.** Si dos lugares validan lo mismo con criterios
  distintos aparecen bugs fantasma (las compras se bloqueaban por esto).
- **Cuidado con N+1 contra 365**: la lista de cajas se paginaba por cada trabajador
  (N×60 peticiones). Traer una vez + caché compartido y filtrar en memoria.
- Al eliminar código duplicado, quedarse con la versión **completa**.
- `onDuplicateKeyUpdate`: el `.set()` debe incluir todos los campos a refrescar.

## Estructura

- `server/routers.ts` — appRouter (asistente, ventas, compras, confirmaciones,
  gastos, asistencia, transferencias, pedidos, bandeja). `adminProcedure` para lo sensible.
- `server/inventarios365.ts` — toda la integración con 365.
- `server/asistente.ts` — herramientas de consulta del asistente.
- `server/ventas-comun.ts` — filtros de ventas anuladas.
- `server/sync-ventas.ts` — sincronización y refresco de estados.
- `server/factura-xml.ts` — lector de factura electrónica XML del SIN.
- `server/bandeja.ts` — bandeja de facturas XML (recibida → emparejada →
  vencimientos_pendientes → validada).
- `server/diferencias-caja.ts` — faltantes/sobrantes de caja y su descuento en inventario.
- `server/pedidos.ts`, `server/obligaciones.ts`, `server/rentabilidad.ts`.
- `client/src/pages/` — Asistente, Compras, NuevaCompra, Inventario, Pedidos,
  Transferencias, NuevaTransferencia, Bandeja, BandejaDetalle, CamaraFactura,
  Reportes, Gastos, Tareas, Asistencia.
- **Patrón visual de listas**: tarjeta con ícono `bg-primary/10`, subtítulo con
  separadores y **detalle desplegable dentro de la tarjeta** (botón ojo + chevron),
  como en `Compras.tsx`. Mantenerlo en toda la app.

## Diagnóstico (GET, requieren sesión admin)

`/api/admin/` + `diag-estados-ventas` · `diag-ventas-dia?fecha=&sucursal=` ·
`diag-comparar-365?fecha=&sucursal=` · `diag-cabeceras?fecha=&sucursal=` ·
`diag-cabecera-cruda?id=` · `diag-caja-cruda` · `diag-almacenes` ·
`diag-transferencias` · `refrescar-estados-ventas` · `capturar-cierres-caja`

## Pendientes

- Verificar que la transferencia se refleje en 365 con el endpoint corregido (v2.70.0).
- Paso C de la bandeja: ingesta automática por correo (Luis crea un Gmail dedicado
  y reenvía ahí las facturas; VidaFarma lo lee vía API de Gmail. Claude solo programa).
- Alinear reportes al criterio devengado (mes del gasto) vs caja (mes del pago).
- Rotar el token de GitHub. Reducir los 45 errores de tipos preexistentes.
