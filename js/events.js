// ===== Elementos =====
const eventos = document.querySelector("#lista-eventos");
const buscador = document.querySelector("#buscador");
const formEvento = document.querySelector("#formulario-evento");
const botonEliminar = document.querySelector("#boton-eliminar");

// Con ?id=3 en la dirección se edita; sin id (valor 0) se crea
const idEvento = Number(new URLSearchParams(location.search).get("id"));


// ===== Datos =====
const eventosIniciales = [
  { id: 1, titulo: "Feria de Carreras UPC", imagen: "/img/eventos/trabajo-grupal.jpg", descripcion: "Empresas aliadas presentan sus prácticas preprofesionales y ofertas laborales. Lleva tu CV, conversa con los reclutadores y participa en mini entrevistas en vivo para conocer qué buscan.", fecha: "2026-11-20", hora: "11:00", campus: "San Isidro", ambiente: "Hall Principal", organizador: "Carlos Ramírez Vega", precio: 0, capacidad: 300 },
  { id: 2, titulo: "Hackathon UPC", imagen: "/img/eventos/computo.jpg", descripcion: "24 horas para construir una solución tecnológica en equipo. Forma tu grupo, elige un reto y presenta tu prototipo ante un jurado de docentes y profesionales. Habrá mentorías, snacks y premios para los mejores proyectos.", fecha: "2026-11-25", hora: "08:00", campus: "Monterrico", ambiente: "Laboratorio de Cómputo", organizador: "Carlos Ramírez Vega", precio: 20, capacidad: 120 },
  { id: 3, titulo: "Torneo de Fútbol Interfacultades", imagen: "/img/eventos/cancha.jpg", descripcion: "Las facultades compiten por la copa del ciclo en una fase de grupos y eliminatorias. Cada equipo debe inscribirse con su delegado. Habrá barras, arbitraje oficial y premiación al final de la jornada.", fecha: "2026-11-28", hora: "15:00", campus: "Villa", ambiente: "Cancha Principal", organizador: "Carlos Ramírez Vega", precio: 10, capacidad: 250 },
  { id: 4, titulo: "Charla de Emprendimiento", imagen: "/img/eventos/charla.jpg", descripcion: "Egresados de la UPC cuentan cómo lanzaron su propio negocio, qué errores cometieron y cómo consiguieron sus primeros clientes. Incluye espacio de preguntas y networking al cierre.", fecha: "2026-12-02", hora: "17:00", campus: "San Miguel", ambiente: "Auditorio", organizador: "Carlos Ramírez Vega", precio: 0, capacidad: 150 },
  { id: 5, titulo: "Festival de Talentos", imagen: "/img/eventos/luces.jpg", descripcion: "Estudiantes de todas las carreras muestran su música, baile, teatro y stand up en una noche abierta a toda la comunidad. Ven a alentar a tus compañeros y descubre nuevos talentos del campus.", fecha: "2026-12-09", hora: "18:00", campus: "Monterrico", ambiente: "Auditorio Principal", organizador: "Carlos Ramírez Vega", precio: 15, capacidad: 500 },
];

const obtenerEventos = () => leerDatos("upc_lista_eventos", eventosIniciales);

const crearEvento = (evento) => {
  const eventos = obtenerEventos();
  const ids = eventos.map((e) => e.id);
  evento.id = Math.max(0, ...ids) + 1;
  evento.organizador = leerDatos("upc_sesion_actual", {}).nombre; // dueño del evento
  eventos.push(evento);
  guardarDatos("upc_lista_eventos", eventos);
};

const editarEvento = (id, evento) => {
  const eventos = obtenerEventos();
  const posicion = eventos.findIndex((e) => e.id === id);
  evento.id = id;
  eventos[posicion] = { ...eventos[posicion], ...evento }; // conserva precio y organizador
  guardarDatos("upc_lista_eventos", eventos);
};

const borrarEvento = (id) => {
  const eventos = obtenerEventos().filter((evento) => evento.id !== id);
  guardarDatos("upc_lista_eventos", eventos);
};


// ===== Funciones =====
const crearHtmlEvento = (evento) => `
  <article class="event-row">
    <div class="event-thumb" style="background-image: url('${evento.imagen}')"></div>
    <div class="event-info">
      <h3>${evento.titulo}</h3>
      <p>${evento.fecha} · ${evento.hora} · ${evento.campus} · ${evento.ambiente}</p>
    </div>
    <div class="event-actions">
      <a href="edit-event.html?id=${evento.id}" class="btn">Editar</a>
      <button type="button" class="btn btn-danger" onclick="eliminarDeLista(${evento.id})">Eliminar</button>
    </div>
  </article>`;
const mostrarEventos = () => {
  const texto = buscador.value.toLowerCase();
  const eventosEncontrados = obtenerEventos().filter((evento) => evento.titulo.toLowerCase().includes(texto));
  eventos.innerHTML = eventosEncontrados.map(crearHtmlEvento).join("");
};

const eliminarDeLista = (id) => {
  if (!confirm("¿Eliminar este evento?")) return;
  borrarEvento(id);
  mostrarEventos();
};

const llenarFormulario = () => {
  const evento = obtenerEventos().find((e) => e.id === idEvento);

  if (!evento) {
    location.href = "events.html";
    return;
  }

  document.querySelector("#titulo").value = evento.titulo;
  document.querySelector("#descripcion").value = evento.descripcion;
  document.querySelector("#fecha").value = evento.fecha;
  document.querySelector("#hora").value = evento.hora;
  document.querySelector("#campus").value = evento.campus;
  document.querySelector("#ambiente").value = evento.ambiente;
  document.querySelector("#capacidad").value = evento.capacidad;
  document.querySelector("#imagen").value = evento.imagen;
};

const guardarEvento = (e) => {
  e.preventDefault();

  const evento = {
    titulo: document.querySelector("#titulo").value,
    descripcion: document.querySelector("#descripcion").value,
    fecha: document.querySelector("#fecha").value,
    hora: document.querySelector("#hora").value,
    campus: document.querySelector("#campus").value,
    ambiente: document.querySelector("#ambiente").value,
    capacidad: Number(document.querySelector("#capacidad").value),
    imagen: document.querySelector("#imagen").value,
  };

  if (idEvento) {
    editarEvento(idEvento, evento);
  } else {
    crearEvento(evento);
  }
  location.href = "events.html";
};

const eliminarDesdeFormulario = () => {
  if (!confirm("¿Eliminar este evento?")) return;
  borrarEvento(idEvento);
  location.href = "events.html";
};


// ===== Eventos =====
if (eventos) {
  buscador.addEventListener("input", mostrarEventos);
  mostrarEventos();
}

if (formEvento) {
  formEvento.addEventListener("submit", guardarEvento);
}

if (botonEliminar) {
  botonEliminar.addEventListener("click", eliminarDesdeFormulario);
  llenarFormulario();
}
