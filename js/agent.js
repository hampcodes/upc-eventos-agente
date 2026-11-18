// ===== Elementos =====
const ventana = document.querySelector("#ventana-chat");
const mensajes = document.querySelector("#mensajes");
const campo = document.querySelector("#texto-chat");
const botonMicrofono = document.querySelector("#boton-microfono");


// ===== Datos =====
// La clave NO está aquí: la agrega la función de Netlify desde el archivo .env
const urlApi = "/.netlify/functions/chat";
const modelo = "gpt-4o-mini";
const idioma = "es-MX"; // idioma de la voz y del micrófono: "es-MX", "es-ES", "es-PE"...

const instrucciones = `Eres el asistente de UPC Eventos. Responde en español, breve y amable, en texto plano sin Markdown ni asteriscos.
Usa obtener_eventos para consultar los eventos y sus precios; no inventes eventos.
Para comprar: primero pregunta qué evento y cuántas entradas, luego pide confirmación indicando el total en soles ("¿Confirmas X entradas para Y por S/ Z?") y SOLO después de que el usuario diga que sí usa comprar_evento.
Si el usuario pide ver su pago, su compra o el detalle de su entrada, usa ver_detalle_pago.
Si el usuario pide una recomendación (por gustos, presupuesto, campus o fechas), usa recomendar_eventos y elige tú los que mejor encajen con sus gustos según la descripción.
Si un organizador pide crear un evento: pide los datos que falten (título, descripción, fecha, hora, campus, ambiente, capacidad y precio), resume y pide confirmación, y SOLO después de que diga que sí usa crear_evento. Escribe las fechas como AAAA-MM-DD y las horas como HH:MM de 24 horas.
Si un organizador pide ver sus eventos, usa ver_mis_eventos (no obtener_eventos).
Hoy es ${new Date().toISOString().slice(0, 10)}.`;

const campusValidos = ["Monterrico", "San Isidro", "San Miguel", "Villa"];
const mensajeError = "No pude conectar con el asistente.";
const puntos = '<span class="puntos"><span></span><span></span><span></span></span>';

// Herramientas que la IA puede pedir (descripción para la IA)
const herramientasIA = [
  {
    type: "function",
    function: {
      name: "obtener_eventos",
      description: "Devuelve la lista de eventos. Se puede filtrar por texto.",
      parameters: { type: "object", properties: { buscar: { type: "string", description: "Texto opcional a buscar en título, campus o descripción" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "comprar_evento",
      description: "Compra entradas de un evento para el usuario con sesión iniciada. Úsala solo tras confirmación explícita.",
      parameters: {
        type: "object",
        properties: { id: { type: "number", description: "ID del evento" }, cantidad: { type: "number", description: "Número de entradas" } },
        required: ["id", "cantidad"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_detalle_pago",
      description: "Muestra el detalle de pago de las entradas compradas por el usuario con sesión iniciada. Se puede filtrar por nombre de evento.",
      parameters: { type: "object", properties: { evento: { type: "string", description: "Texto opcional del nombre del evento" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "recomendar_eventos",
      description: "Devuelve hasta 5 próximos eventos con entradas disponibles, filtrando por campus, precio máximo o rango de fechas. Elige y recomienda según los gustos del usuario leyendo las descripciones.",
      parameters: {
        type: "object",
        properties: {
          campus: { type: "string", enum: campusValidos },
          precio_maximo: { type: "number", description: "Precio máximo por entrada en soles (0 = solo gratis)" },
          desde: { type: "string", description: "Fecha mínima AAAA-MM-DD" },
          hasta: { type: "string", description: "Fecha máxima AAAA-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_evento",
      description: "Crea un evento nuevo. Solo para organizadores con sesión iniciada. Úsala solo tras confirmación explícita.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descripcion: { type: "string" },
          fecha: { type: "string", description: "AAAA-MM-DD" },
          hora: { type: "string", description: "HH:MM en 24 horas" },
          campus: { type: "string", enum: campusValidos },
          ambiente: { type: "string", description: "Lugar dentro del campus (ej. Auditorio)" },
          capacidad: { type: "number", description: "Número de entradas disponibles" },
          precio: { type: "number", description: "Precio por entrada en soles (0 si es gratis)" },
        },
        required: ["titulo", "descripcion", "fecha", "hora", "campus", "ambiente", "capacidad"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_mis_eventos",
      description: "Lista solo los eventos creados por el organizador con sesión iniciada, con entradas vendidas y disponibles.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// Historial de la conversación (para que el agente recuerde el contexto)
const historial = [{ role: "system", content: instrucciones }];


// ===== Herramientas (código real que se ejecuta) =====
const resumenEvento = (e) => ({ id: e.id, titulo: e.titulo, fecha: e.fecha, hora: e.hora, campus: e.campus, ambiente: e.ambiente, precio_soles: e.precio || 0, descripcion: e.descripcion, entradas_disponibles: e.capacidad - entradasVendidas(e.id) });

const obtenerEventosHerramienta = ({ buscar = "" }) => {
  const texto = buscar.toLowerCase();
  return obtenerEventos()
    .filter((e) => `${e.titulo} ${e.campus} ${e.descripcion}`.toLowerCase().includes(texto))
    .map(resumenEvento);
};

const entradasVendidas = (idEvento) => {
  return leerDatos("upc_compras", []).filter((c) => c.idEvento === idEvento).reduce((suma, c) => suma + c.cantidad, 0);
};

const comprarEventoHerramienta = ({ id, cantidad }) => {
  const sesion = leerDatos("upc_sesion_actual", null);
  if (!sesion) return { error: "El usuario debe iniciar sesión para comprar." };

  const evento = obtenerEventos().find((e) => e.id === id);
  if (!evento) return { error: "Ese evento no existe." };
  if (!Number.isInteger(cantidad) || cantidad < 1) return { error: "Cantidad inválida." };
  if (cantidad > evento.capacidad - entradasVendidas(id)) return { error: "No hay suficientes entradas disponibles." };

  const compras = leerDatos("upc_compras", []);
  const precio = evento.precio || 0;
  const codigo = `UPC-${Date.now().toString().slice(-6)}`;
  compras.push({ codigo, idEvento: id, usuario: sesion.nombre, cantidad, precio, fecha: new Date().toISOString() });
  guardarDatos("upc_compras", compras);
  return { ok: true, codigo, evento: evento.titulo, cantidad, total_soles: precio * cantidad };
};

const verDetallePagoHerramienta = ({ evento = "" }) => {
  const sesion = leerDatos("upc_sesion_actual", null);
  if (!sesion) return { error: "El usuario debe iniciar sesión para ver sus pagos." };

  const eventos = obtenerEventos();
  const pagos = leerDatos("upc_compras", [])
    .filter((c) => c.usuario === sesion.nombre)
    .map((c) => {
      const e = eventos.find((ev) => ev.id === c.idEvento) || {};
      const precio = c.precio || 0;
      return { codigo: c.codigo, evento: e.titulo || "", fecha_evento: e.fecha, cantidad: c.cantidad, precio_unitario_soles: precio, total_soles: precio * c.cantidad, estado: "Pagado", fecha_compra: c.fecha };
    })
    .filter((p) => p.evento.toLowerCase().includes(evento.toLowerCase()));

  return pagos.length ? pagos : { mensaje: "No tienes compras registradas." };
};

const recomendarEventosHerramienta = ({ campus = "", precio_maximo = Infinity, desde = "", hasta = "9999-12-31" }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  return obtenerEventos()
    .filter((e) => e.fecha >= hoy && e.fecha >= desde && e.fecha <= hasta)
    .filter((e) => e.campus.toLowerCase().includes(campus.toLowerCase()))
    .filter((e) => (e.precio || 0) <= precio_maximo)
    .filter((e) => e.capacidad - entradasVendidas(e.id) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5)
    .map(resumenEvento);
};

const crearEventoHerramienta = ({ titulo, descripcion, fecha, hora, campus, ambiente, capacidad, precio = 0 }) => {
  const sesion = leerDatos("upc_sesion_actual", null);
  if (!sesion || sesion.rol !== "organizador") return { error: "Solo un organizador con sesión iniciada puede crear eventos." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return { error: "Fecha (AAAA-MM-DD) u hora (HH:MM) inválida." };
  if (!campusValidos.includes(campus)) return { error: `Campus inválido. Usa: ${campusValidos.join(", ")}.` };
  if (!(capacidad > 0) || precio < 0) return { error: "La capacidad debe ser mayor a 0 y el precio no puede ser negativo." };

  crearEvento({ titulo, imagen: "/img/eventos/campus-aereo.jpg", descripcion, fecha, hora, campus, ambiente, precio, capacidad });
  if (typeof mostrarEventos === "function") mostrarEventos(); // refresca la lista si la página la tiene
  return { ok: true, titulo, fecha, hora, campus, capacidad, precio_soles: precio };
};

const verMisEventosHerramienta = () => {
  const sesion = leerDatos("upc_sesion_actual", null);
  if (!sesion || sesion.rol !== "organizador") return { error: "Solo un organizador con sesión iniciada puede ver sus eventos." };

  const mios = obtenerEventos()
    .filter((e) => e.organizador === sesion.nombre)
    .map((e) => ({ ...resumenEvento(e), entradas_vendidas: entradasVendidas(e.id) }));

  return mios.length ? mios : { mensaje: "Todavía no tienes eventos creados." };
};

const herramientas = {
  obtener_eventos: obtenerEventosHerramienta,
  comprar_evento: comprarEventoHerramienta,
  ver_detalle_pago: verDetallePagoHerramienta,
  recomendar_eventos: recomendarEventosHerramienta,
  crear_evento: crearEventoHerramienta,
  ver_mis_eventos: verMisEventosHerramienta,
};


// ===== Funciones =====
const abrirOCerrarChat = () => {
  ventana.hidden = !ventana.hidden;
};

const agregarMensaje = (texto, autor) => {
  mensajes.innerHTML += `<div class="msg msg-${autor}">${texto}</div>`;
  mensajes.scrollTop = mensajes.scrollHeight;
};

const llamarIA = async () => {
  const respuestaApi = await fetch(urlApi, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelo, messages: historial, tools: herramientasIA }),
  });
  const datos = await respuestaApi.json();
  return datos.choices[0].message;
};

// Bucle del agente: mientras la IA pida herramientas, las ejecutamos y le devolvemos el resultado
const pedirRespuesta = async (pregunta) => {
  historial.push({ role: "user", content: pregunta });

  let mensaje = await llamarIA();
  while (mensaje.tool_calls) {
    historial.push(mensaje);
    for (const llamada of mensaje.tool_calls) {
      const argumentos = JSON.parse(llamada.function.arguments);
      const resultado = herramientas[llamada.function.name](argumentos);
      historial.push({ role: "tool", tool_call_id: llamada.id, content: JSON.stringify(resultado) });
    }
    mensaje = await llamarIA();
  }

  historial.push(mensaje);
  return mensaje.content;
};

const hablar = (texto) => {
  const voces = speechSynthesis.getVoices();
  const vozEspanol = voces.find((v) => v.lang.replace("_", "-") === idioma) || voces.find((v) => v.lang.startsWith("es"));

  const voz = new SpeechSynthesisUtterance(texto);
  voz.voice = vozEspanol;
  voz.lang = vozEspanol ? vozEspanol.lang : idioma;
  speechSynthesis.cancel();
  speechSynthesis.speak(voz);
};

const enviarPregunta = async (pregunta, porVoz = false) => {
  agregarMensaje(pregunta, "user");
  agregarMensaje(puntos, "bot");

  const respuesta = await pedirRespuesta(pregunta).catch(() => mensajeError);

  mensajes.lastElementChild.remove();
  agregarMensaje(respuesta, "bot");
  if (porVoz) hablar(respuesta); // si preguntó con la voz, responde con voz
};

const enviarMensaje = (e) => {
  e.preventDefault();
  const pregunta = campo.value;
  campo.value = "";
  enviarPregunta(pregunta);
};

// ===== Voz =====
speechSynthesis.getVoices(); // el navegador carga las voces en segundo plano
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;

let reconocedor = null;

// Un clic: empieza a escuchar y, al hacer una pausa, envía la pregunta
const escuchar = () => {
  if (reconocedor) return reconocedor.stop(); // segundo clic: termina y envía lo dicho
  speechSynthesis.cancel(); // el asistente deja de hablar para no escucharse a sí mismo

  reconocedor = new Reconocimiento();
  reconocedor.lang = idioma;
  botonMicrofono.classList.add("escuchando");
  reconocedor.onresult = (e) => enviarPregunta(e.results[0][0].transcript, true);
  reconocedor.onerror = (e) => {
    if (e.error === "not-allowed") agregarMensaje("Permite el micrófono: haz clic en el candado de la barra de direcciones, elige Micrófono → Permitir y vuelve a pulsar.", "bot");
  };
  reconocedor.onend = () => {
    botonMicrofono.classList.remove("escuchando");
    reconocedor = null;
  };
  reconocedor.start();
};


// ===== Eventos =====
document.querySelector("#boton-chat").addEventListener("click", abrirOCerrarChat);
document.querySelector("#boton-cerrar-chat").addEventListener("click", abrirOCerrarChat);
document.querySelector("#formulario-chat").addEventListener("submit", enviarMensaje);

if (Reconocimiento) {
  botonMicrofono.addEventListener("click", escuchar);
} else {
  botonMicrofono.hidden = true; // el navegador no soporta voz
}
