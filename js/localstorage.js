// ===== Funciones =====
const guardarDatos = (clave, lista) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

const leerDatos = (clave, datosIniciales = []) => {
  const texto = localStorage.getItem(clave);
  return texto ? JSON.parse(texto) : datosIniciales;
};
