// ===== Funciones =====
const guardarDatos = (clave, lista) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

// La primera vez que se lee una clave, se guardan sus datos iniciales en localStorage
const leerDatos = (clave, datosIniciales = []) => {
  if (!localStorage.getItem(clave) && datosIniciales !== null) guardarDatos(clave, datosIniciales);
  return JSON.parse(localStorage.getItem(clave));
};
