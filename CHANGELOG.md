# Changelog — VidaFarma OS

Formato: [Semantic Versioning](https://semver.org/)

## [1.0.2] — 2026-05-25

### Mejorado
- Threshold de matching subido a 0.80 — solo registra automáticamente coincidencias de alta confianza
- Productos con score 0.50-0.79 van al panel de confirmación con sugerencia visible
- Panel muestra sugerencia del sistema con % de similitud y botón Confirmar
- Score incluido en resultado de búsqueda para control preciso
- Proveedor no encontrado ya no bloquea búsqueda de productos

---

## [1.0.1] — 2026-05-25

### Corregido
- Fecha de vencimiento ahora se envía correctamente a inventarios365 (YYYY-MM-DD → MM/YYYY)
- Panel de productos no encontrados siempre visible cuando hay productos sin emparejar
- Mensaje claro cuando la compra no se registra por falta de emparejamientos
- Búsqueda de productos sin filtro de proveedor cuando el proveedor no existe en sistema
- idproveedor ya no hardcodeado a 1 cuando proveedor no se encuentra

---

## [1.0.0] — 2026-05-24

### Añadido
- Sistema de autenticación local (reemplaza OAuth de Manus)
- Extracción de datos de facturas con IA (Groq / Llama 4 Scout)
- Soporte para imágenes JPG/PNG y PDFs
- Sincronización automática con inventarios365.com
- Cache de 4715 productos en MySQL para matching rápido
- Sistema de confirmaciones aprendidas por proveedor
- Panel de productos no encontrados con búsqueda y creación
- Extracción automática de fechas de vencimiento (columna VCTO)
- Limpieza de códigos numéricos en nombres de productos
- Sincronización automática de almacenes al iniciar
- CI/CD con GitHub Actions + Railway
- Health check endpoint `/api/health`
- Auto-migración de base de datos en producción

### Técnico
- Migrado de archivos JSON a MySQL para persistencia
- Eliminada dependencia de Manus OAuth SDK
- Variables de entorno centralizadas y tipadas
- Versionado semántico
