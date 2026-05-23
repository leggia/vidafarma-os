import axios from "axios";

const API_URL = "https://vidafarmacia.inventarios365.com";

async function testCompletePurchase() {
  console.log("🔍 PRUEBA COMPLETA DE COMPRA CON FACTURA BAGO\n");

  try {
    // 1. Obtener CSRF token
    console.log("1️⃣ Obteniendo CSRF token...");
    const loginPageRes = await axios.get(`${API_URL}/login`, {
      withCredentials: true,
      validateStatus: () => true,
    });

    const htmlData = typeof loginPageRes.data === 'string' ? loginPageRes.data : JSON.stringify(loginPageRes.data);
    const csrfMatch = htmlData.match(/name="_token"\s+value="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error("No se encontró CSRF token en la página de login");
    }
    const csrfToken = csrfMatch[1];
    console.log(`   ✓ CSRF token: ${csrfToken.substring(0, 20)}...`);

    // 2. Hacer login
    console.log("\n2️⃣ Haciendo login...");
    const loginRes = await axios.post(
      `${API_URL}/login`,
      {
        email: "superadmin@vidafarmacia.com",
        password: "superadmin",
        _token: csrfToken,
      },
      {
        withCredentials: true,
        validateStatus: () => true,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    if (loginRes.status !== 200 && loginRes.status !== 302) {
      console.log(`   ❌ Login falló con status ${loginRes.status}`);
      console.log(`   Response: ${JSON.stringify(loginRes.data).substring(0, 200)}`);
      throw new Error("Login failed");
    }
    console.log("   ✓ Login exitoso");

    // 3. Obtener nuevo CSRF token después del login
    console.log("\n3️⃣ Obteniendo nuevo CSRF token después del login...");
    const mainPageRes = await axios.get(`${API_URL}/main`, {
      withCredentials: true,
      validateStatus: () => true,
    });

    const mainHtmlData = typeof mainPageRes.data === 'string' ? mainPageRes.data : JSON.stringify(mainPageRes.data);
    const newCsrfMatch = mainHtmlData.match(/name="_token"\s+value="([^"]+)"/);
    const newCsrfToken = newCsrfMatch ? newCsrfMatch[1] : csrfToken;
    console.log(`   ✓ Nuevo CSRF token: ${newCsrfToken.substring(0, 20)}...`);

    // 4. Registrar compra con datos de la factura Bago
    console.log("\n4️⃣ Registrando compra con factura Bago...");

    const compraData = {
      idproveedor: 1,
      idalmacen: 1,
      tipo_comprobante: "FACTURA",
      num_comprobante: "139167",
      impuesto: 0.18,
      total: 1708.0,
      inventarios: [
        {
          idarticulo: 4769,
          idalmacen: 1,
          codigo: "ACTRON-400",
          articulo: "ACTRON 400 mg x 10 Caps",
          precio: 15.0,
          precio_paquete: 150.0,
          precio_venta: 20.0,
          unidad_x_paquete: 10,
          fecha_vencimiento: "2027-12-31",
          cantidad: 150,
        },
        {
          idarticulo: 4770,
          idalmacen: 1,
          codigo: "ACTRON-600",
          articulo: "ACTRON 600 mg x 10 Caps",
          precio: 18.0,
          precio_paquete: 180.0,
          precio_venta: 25.0,
          unidad_x_paquete: 10,
          fecha_vencimiento: "2027-12-31",
          cantidad: 150,
        },
        {
          idarticulo: 4771,
          idalmacen: 1,
          codigo: "ASPIRINA-500",
          articulo: "ASPIRINA TABL 500 MG x 100",
          precio: 8.0,
          precio_paquete: 800.0,
          precio_venta: 10.0,
          unidad_x_paquete: 100,
          fecha_vencimiento: "2027-06-30",
          cantidad: 600,
        },
      ],
    };

    const registroRes = await axios.post(
      `${API_URL}/ingreso/registrar`,
      compraData,
      {
        withCredentials: true,
        validateStatus: () => true,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": newCsrfToken,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`   Status: ${registroRes.status}`);
    console.log(`   Response: ${JSON.stringify(registroRes.data)}`);

    if (registroRes.status === 200) {
      console.log("\n✅ COMPRA REGISTRADA EXITOSAMENTE");
      console.log(`   ID: ${registroRes.data?.id || "N/A"}`);
      console.log(`   Message: ${registroRes.data?.message || "N/A"}`);
    } else {
      console.log("\n❌ ERROR AL REGISTRAR COMPRA");
      console.log(`   Status: ${registroRes.status}`);
      console.log(`   Response: ${JSON.stringify(registroRes.data)}`);
    }

    // 5. Verificar en la lista de compras
    console.log("\n5️⃣ Verificando en la lista de compras...");
    const comprasListRes = await axios.get(
      `${API_URL}/ingreso/listar?buscar=139167`,
      {
        withCredentials: true,
        validateStatus: () => true,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    if (comprasListRes.status === 200) {
      const compras = comprasListRes.data;
      if (Array.isArray(compras) && compras.length > 0) {
        console.log("   ✅ COMPRA ENCONTRADA EN LA LISTA");
        console.log(`   Número: ${compras[0].num_comprobante}`);
        console.log(`   Total: ${compras[0].total}`);
      } else {
        console.log("   ❌ COMPRA NO ENCONTRADA EN LA LISTA");
      }
    } else {
      console.log(`   ❌ Error al obtener lista: ${comprasListRes.status}`);
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Data:", error.response.data);
    }
  }
}

testCompletePurchase();
