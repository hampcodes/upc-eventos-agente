// ===== Elementos =====
const ventana = document.querySelector("#ventana-chat");
const mensajes = document.querySelector("#mensajes");
const campo = document.querySelector("#texto-chat");
const botonMicrofono = document.querySelector("#boton-microfono");


// ===== Datos =====
// La clave NO está aquí: la agrega la función de Netlify desde el archivo .env
const urlApi = "/.netlify/functions/chat";
const modelo = "gpt-4o-mini";

const instrucciones = `Eres el asistente de UPC Eventos. Responde en español, breve y amable, en texto plano sin Markdown ni asteriscos.
Usa obtener_eventos para consultar los eventos y sus precios; no inventes eventos.
Para comprar: primero pregunta qué evento y cuántas entradas, luego pide confirmación indicando el total en soles ("¿Confirmas X entradas para Y por S/ Z?") y SOLO después de que el usuario diga que sí usa comprar_evento.
Si el usuario pide ver su pago, su compra o el detalle de su entrada, usa ver_detalle_pago.`;
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
];

// Historial de la conversación (para que el agente recuerde el contexto)
const historial = [{ role: "system", content: instrucciones }];


// ===== Herramientas (código real que se ejecuta) =====
const obtenerEventosHerramienta = ({ buscar = "" }) => {
  const texto = buscar.toLowerCase();
  return obtenerEventos()
    .filter((e) => `${e.titulo} ${e.campus} ${e.descripcion}`.toLowerCase().includes(texto))
    .map((e) => ({ id: e.id, titulo: e.titulo, fecha: e.fecha, hora: e.hora, campus: e.campus, ambiente: e.ambiente, precio_soles: e.precio || 0, descripcion: e.descripcion, entradas_disponibles: e.capacidad - entradasVendidas(e.id) }));
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

const herramientas = {
  obtener_eventos: obtenerEventosHerramienta,
  comprar_evento: comprarEventoHerramienta,
  ver_detalle_pago: verDetallePagoHerramienta,
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
  const vozEspanol = voces.find((v) => v.lang.replace("_", "-") === "es-MX") || voces.find((v) => v.lang.startsWith("es"));

  const voz = new SpeechSynthesisUtterance(texto);
  voz.voice = vozEspanol;
  voz.lang = vozEspanol ? vozEspanol.lang : "es-MX";
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
let textoDicho = "";

// Al pulsar el micrófono: empieza a escuchar
const empezarAEscuchar = () => {
  if (reconocedor) return;
  speechSynthesis.cancel(); // el asistente deja de hablar para no escucharse a sí mismo
  textoDicho = "";

  reconocedor = new Reconocimiento();
  reconocedor.lang = "es-MX";
  reconocedor.continuous = true; // sigue escuchando aunque hagas pausas
  reconocedor.onresult = (e) => {
    textoDicho = Array.from(e.results).map((r) => r[0].transcript).join(" ");
  };
  reconocedor.onerror = (e) => {
    if (e.error === "not-allowed") agregarMensaje("Permite el uso del micrófono en el navegador.", "bot");
  };
  reconocedor.onend = () => {
    botonMicrofono.classList.remove("escuchando");
    reconocedor = null;
    if (textoDicho.trim()) enviarPregunta(textoDicho.trim(), true);
  };

  botonMicrofono.classList.add("escuchando");
  reconocedor.start();
};

// Al soltar el micrófono: termina de escuchar y se envía lo dicho
const terminarDeEscuchar = () => {
  if (reconocedor) reconocedor.stop();
};


// ===== Eventos =====
document.querySelector("#boton-chat").addEventListener("click", abrirOCerrarChat);
document.querySelector("#boton-cerrar-chat").addEventListener("click", abrirOCerrarChat);
document.querySelector("#formulario-chat").addEventListener("submit", enviarMensaje);

if (Reconocimiento) {
  botonMicrofono.addEventListener("pointerdown", (e) => {
    botonMicrofono.setPointerCapture(e.pointerId); // recibe el "soltar" aunque el puntero salga del botón
    empezarAEscuchar();
  });
  botonMicrofono.addEventListener("pointerup", terminarDeEscuchar);
  botonMicrofono.addEventListener("pointercancel", terminarDeEscuchar);
  botonMicrofono.addEventListener("contextmenu", (e) => e.preventDefault()); // sin menú al mantener pulsado
} else {
  botonMicrofono.hidden = true; // el navegador no soporta voz
}
