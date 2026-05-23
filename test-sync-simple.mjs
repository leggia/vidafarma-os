import { Inventarios365Service } from "./server/inventarios365.ts";

async function testSync() {
  console.log("🔍 PRUEBA DE SINCRONIZACIÓN SIMPLE\n");

  const service = new Inventarios365Service();

  try {
    console.log("1️⃣ Registrando compra...");
    const result = await service.registrarCompra({
      numComprobante: "TEST-SIMPLE-001",
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
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
  }
}

testSync();
