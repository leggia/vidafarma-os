import axios from "axios";
import * as cheerio from "cheerio";

const API_URL = "https://vidafarmacia.inventarios365.com";

async function testMinimalPayload() {
  console.log("🔍 PRUEBA CON PAYLOAD MINIMAL\n");

  try {
    // 1. Obtener CSRF token del formulario de login
    console.log("1️⃣ Obteniendo CSRF token...");
    const loginPageRes = await axios.get(`${API_URL}/login`, {
      withCredentials: true,
    });

    const $ = cheerio.load(loginPageRes.data);
    const csrfToken = $('input[name="_token"]').val();
    if (!csrfToken) {
      throw new Error("No se encontró CSRF token");
    }
    console.log(`   ✓ CSRF token obtenido`);

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
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );
    console.log(`   ✓ Login exitoso`);

    // 3. Obtener nuevo CSRF token
    console.log("\n3️⃣ Obteniendo nuevo CSRF token...");
    const mainPageRes = await axios.get(`${API_URL}/main`, {
      withCredentials: true,
    });

    const $main = cheerio.load(mainPageRes.data);
    const newCsrfToken = $main('input[name="_token"]').val();
    console.log(`   ✓ Nuevo CSRF token obtenido`);

    // 4. Probar con payload minimal
    console.log("\n4️⃣ Registrando compra con payload MINIMAL...");

    const minimalPayload = {
      idproveedor: 1,
      idalmacen: 1,
      tipo_comprobante: "FACTURA",
      num_comprobante: "MINIMAL-" + Date.now(),
      impuesto: 0,
      total: 100,
      inventarios: [
        {
          idarticulo: 79,
          idalmacen: 1,
          cantidad: 10,
        },
      ],
    };

    console.log("   Payload:", JSON.stringify(minimalPayload, null, 2));

    const registroRes = await axios.post(
      `${API_URL}/ingreso/registrar`,
      minimalPayload,
      {
        withCredentials: true,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": newCsrfToken,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`\n   Status: ${registroRes.status}`);
    console.log(`   Response: ${JSON.stringify(registroRes.data)}`);

    if (registroRes.status === 200) {
      console.log("\n✅ COMPRA REGISTRADA");
    } else {
      console.log("\n❌ ERROR");
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Data:", error.response.data);
    }
  }

  process.exit(0);
}

testMinimalPayload();
