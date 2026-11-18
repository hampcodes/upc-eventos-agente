// ===== Elementos =====
const formLogin = document.querySelector("#formulario-login");
const formRegistro = document.querySelector("#formulario-registro");
const botonSalir = document.querySelector("#boton-salir");
const nombreUsuario = document.querySelector("#nombre-usuario");


// ===== Datos =====
const usuariosIniciales = [
  { nombre: "Carlos Ramírez Vega", correo: "organizador@upc.edu.pe", contrasena: "123456", rol: "organizador" },
  { nombre: "Henry Antonio Mendoza Puerta", correo: "alumno@upc.edu.pe", contrasena: "123456", rol: "participante" },
];

const obtenerUsuarios = () => leerDatos("upc_lista_usuarios", usuariosIniciales);

const crearUsuario = (usuario) => {
  const usuarios = obtenerUsuarios();
  usuarios.push(usuario);
  guardarDatos("upc_lista_usuarios", usuarios);
};


// ===== Funciones =====
const iniciarSesion = (e) => {
  e.preventDefault();

  const credenciales = {
    correo: document.querySelector("#correo").value.trim().toLowerCase(),
    contrasena: document.querySelector("#contrasena").value,
  };

  const usuario = obtenerUsuarios().find((u) => u.correo === credenciales.correo && u.contrasena === credenciales.contrasena);

  if (!usuario) {
    document.querySelector("#mensaje-error").innerHTML = "Correo o contraseña incorrectos.";
    return;
  }

  const sesion = {
    nombre: usuario.nombre,
    rol: usuario.rol,
  };
  guardarDatos("upc_sesion_actual", sesion);

  if (usuario.rol === "organizador") {
    location.href = "../organizador/events.html";
  } else {
    location.href = "../participante/explorar.html";
  }
};

const registrarUsuario = (e) => {
  e.preventDefault();

  const usuario = {
    nombre: document.querySelector("#nombre").value.trim(),
    correo: document.querySelector("#correo").value.trim().toLowerCase(),
    contrasena: document.querySelector("#contrasena").value,
    rol: "participante",
  };

  if (obtenerUsuarios().some((u) => u.correo === usuario.correo)) {
    document.querySelector("#mensaje-error").innerHTML = "<span>Ese correo ya está registrado.</span>";
    return;
  }

  crearUsuario(usuario);
  location.href = "login.html";
};

const mostrarUsuario = () => {
  const sesion = leerDatos("upc_sesion_actual", null);
  if (!sesion) return;
  nombreUsuario.innerHTML = `${sesion.nombre} · ${sesion.rol}`;
};

const cerrarSesion = () => {
  localStorage.removeItem("upc_sesion_actual");
  location.href = "../../index.html";
};


// ===== Eventos =====
obtenerUsuarios(); // al cargar la página, los usuarios iniciales ya quedan en localStorage

if (formLogin) {
  formLogin.addEventListener("submit", iniciarSesion);
}

if (formRegistro) {
  formRegistro.addEventListener("submit", registrarUsuario);
}

if (botonSalir) {
  botonSalir.addEventListener("click", cerrarSesion);
  mostrarUsuario();
}
