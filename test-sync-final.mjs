import { inventarios365 } from "./server/inventarios365.ts";

async function testSync() {
  console.log("🔍 PRUEBA FINAL DE SINCRONIZACIÓN\n");

  try {
    console.log("1️⃣ Registrando compra con factura Bago...");
    const result = await inventarios365.registrarCompra({
      numComprobante: "TEST-FINAL-" + Date.now(),
      tipoComprobante: "FACTURA",
      almacenNombre: "principal",
      proveedorNombre: "LABORATORIOS BAGO",
      items: [
        {
          nombre: "ACTRON 400 mg x 10 Caps",
          cantidad: 150,
          precio: 15.0,
        },
        {
          nombre: "ACTRON 600 mg x 10 Caps",
          cantidad: 150,
          precio: 18.0,
        },
        {
          nombre: "ASPIRINA TABL 500 MG x 100",
          cantidad: 600,
          precio: 8.0,
        },
      ],
    });

    console.log("\n✅ RESULTADO:");
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Ingreso ID: ${result.ingresoId}`);

    if (!result.success) {
      console.log("\n❌ LA SINCRONIZACIÓN FALLÓ");
      console.log(`   Detalles: ${result.message}`);
    } else {
      console.log("\n✅ LA SINCRONIZACIÓN FUNCIONÓ CORRECTAMENTE");
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testSync();
