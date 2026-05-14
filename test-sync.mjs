import { inventarios365 } from "./server/inventarios365.ts";

async function testSync() {
  console.log("🔍 Iniciando prueba de sincronización...\n");

  try {
    // 1. Probar login
    console.log("1️⃣ Probando login...");
    await inventarios365.listarAlmacenes();
    console.log("✓ Login exitoso\n");

    // 2. Buscar artículo
    console.log("2️⃣ Buscando artículo 'ACTRON 400'...");
    const articulo = await inventarios365.buscarArticulo("ACTRON 400");
    console.log("Resultado:", articulo, "\n");

    // 3. Buscar proveedor
    console.log("3️⃣ Buscando proveedor 'Bago'...");
    const proveedor = await inventarios365.buscarProveedor("Bago");
    console.log("Resultado:", proveedor, "\n");

    // 4. Registrar compra completa
    console.log("4️⃣ Registrando compra de prueba...");
    const result = await inventarios365.registrarCompra({
      proveedor: "Bago",
      tipoComprobante: "BOLETA",
      numComprobante: "TEST-" + Date.now(),
      almacenNombre: "principal",
      items: [
        {
          nombre: "ACTRON 400",
          cantidad: 10,
          precio: 5.5,
          fechaVencimiento: "2027-12-31",
        },
      ],
      total: 55,
    });
    console.log("✓ Resultado:", result, "\n");

    if (result.success) {
      console.log("✅ SINCRONIZACIÓN EXITOSA");
    } else {
      console.log("❌ SINCRONIZACIÓN FALLIDA:", result.message);
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error(error);
  }
}

testSync();
