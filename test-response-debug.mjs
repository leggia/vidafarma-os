import { inventarios365 } from "./server/inventarios365.ts";

async function testResponse() {
  console.log("🔍 PRUEBA DE RESPUESTA DEL SERVIDOR\n");

  try {
    console.log("1️⃣ Registrando compra...");
    const result = await inventarios365.registrarCompra({
      numComprobante: "DEBUG-" + Date.now(),
      tipoComprobante: "FACTURA",
      almacenNombre: "principal",
      proveedorNombre: "LABORATORIOS BAGO",
      items: [
        {
          nombre: "ACTRON 400 mg x 10 Caps",
          cantidad: 10,
          precio: 15.0,
        },
      ],
    });

    console.log("\n✅ RESULTADO COMPLETO:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testResponse();
