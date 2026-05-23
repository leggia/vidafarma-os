import { inventarios365 } from "./server/inventarios365.ts";

// Payload que envía la interfaz web (según Luis)
const payloadWeb = {
  "idproveedor": 0,
  "idalmacen": 1,
  "tipo_comprobante": "FACTURA",
  "num_comprobante": "2323",
  "impuesto": 0.18,
  "total": 21,
  "data": [
    {
      "idarticulo": 4785,
      "idalmacen": 1,
      "codigo": "MIC533",
      "articulo": "COTRIMOXAZOL Jbe 100ml 240mg (saphi)",
      "precio": "21.0000",
      "precio_paquete": "21.0000",
      "precio_venta": "28.0000",
      "unidad_x_paquete": 1,
      "fecha_vencimiento": "2026-05-19",
      "cantidad": 1
    }
  ]
};

console.log("📋 PAYLOAD QUE ENVÍA LA INTERFAZ WEB:");
console.log(JSON.stringify(payloadWeb, null, 2));

// Ahora voy a capturar exactamente qué envía mi código
console.log("\n🔍 ANALIZANDO TIPOS DE DATOS:");
console.log("- precio (web):", typeof payloadWeb.data[0].precio, "=", payloadWeb.data[0].precio);
console.log("- precio_paquete (web):", typeof payloadWeb.data[0].precio_paquete, "=", payloadWeb.data[0].precio_paquete);
console.log("- precio_venta (web):", typeof payloadWeb.data[0].precio_venta, "=", payloadWeb.data[0].precio_venta);
console.log("- unidad_x_paquete (web):", typeof payloadWeb.data[0].unidad_x_paquete, "=", payloadWeb.data[0].unidad_x_paquete);
console.log("- fecha_vencimiento (web):", typeof payloadWeb.data[0].fecha_vencimiento, "=", payloadWeb.data[0].fecha_vencimiento);
console.log("- cantidad (web):", typeof payloadWeb.data[0].cantidad, "=", payloadWeb.data[0].cantidad);

console.log("\n⚠️ DIFERENCIAS CLAVE:");
console.log("1. idproveedor: 0 (web) vs 1 (mi código)");
console.log("2. precio: STRING (web) vs NUMBER (mi código)");
console.log("3. precio_paquete: STRING (web) vs NUMBER (mi código)");
console.log("4. precio_venta: STRING (web) vs NUMBER (mi código)");
