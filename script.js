/* ============================================================
   Consulta de Notas — Programación III (UTN FRC)
   Toda la información se lee desde /data/notas-programacion-iii.json
   Ninguna nota está definida en el HTML ni en este archivo.
   ============================================================ */

const RUTA_JSON = "data/notas-programacion-iii.json";
const RUTA_JS_DATOS = "data/notas-programacion-iii.local.js";
const NOTA_APROBACION = 6; // umbral de aprobación (parciales y nota final de cuestionarios)

// Cuestionarios que corresponde evaluar según la comisión
const CUESTIONARIOS_POR_COMISION = {
  "2W1": ["C1 FE", "C2 BE", "C2 FE", "C3 FE", "C4 FE", "C5 FE", "C3 BE", "C6 FE", "C4 BE", "C7 FE", "C5 BE"],
  "2W2": ["C1 BE", "C1 FE", "C2 BE", "C2 FE", "C3 FE", "C4 FE", "C5 FE", "C3 BE", "C6 FE", "C4 BE", "C7 FE", "C5 BE"]
};

let datos = null;

// ---------- Carga del JSON al iniciar la página ----------

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("form-busqueda").addEventListener("submit", (e) => {
    e.preventDefault();
    buscar();
  });

  document.getElementById("btn-nueva-consulta").addEventListener("click", nuevaConsulta);

  try {
    datos = await cargarDatos();
    document.getElementById("materia").textContent = datos.materia;
    document.getElementById("institucion").textContent = datos.institucion;
    document.getElementById("fecha-actualizacion").textContent =
      "Última actualización: " + formatearFecha(datos.fechaActualizacion);
  } catch (err) {
    mostrarMensaje("No se pudo cargar el archivo de datos (" + RUTA_JSON + "). " + err.message, "error");
    document.getElementById("btn-buscar").disabled = true;
  }
});

async function cargarDatos() {
  try {
    const respuesta = await fetch(RUTA_JSON);
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const datosJson = await respuesta.json();
    return normalizarDatos(datosJson);
  } catch (err) {
    return cargarDatosDesdeScript(err);
  }
}

function cargarDatosDesdeScript(errorOriginal) {
  return new Promise((resolve, reject) => {
    if (window.NOTAS_PROGRAMACION_III) {
      resolve(normalizarDatos(window.NOTAS_PROGRAMACION_III));
      return;
    }

    const script = document.createElement("script");
    script.src = RUTA_JS_DATOS;
    script.onload = () => {
      if (window.NOTAS_PROGRAMACION_III) {
        resolve(normalizarDatos(window.NOTAS_PROGRAMACION_III));
      } else {
        reject(new Error("El archivo local no definio los datos."));
      }
    };
    script.onerror = () => reject(errorOriginal);
    document.head.appendChild(script);
  });
}

function normalizarDatos(origen) {
  if (origen.estudiantes) return origen;

  const estudiantes = [];
  Object.keys(origen).forEach((comision) => {
    if (!Array.isArray(origen[comision])) return;

    origen[comision].forEach((est) => {
      estudiantes.push({
        legajo: String(est.legajo),
        apellidoNombre: est.nombre,
        comision: comision.toUpperCase(),
        notaCuestionarios: est.cuest_promedio,
        parciales: {
          primerParcial: est.parcial_1,
          segundoParcial: est.parcial_2
        },
        cuestionarios: est.cuestionarios || {}
      });
    });
  });

  return {
    materia: "Programación III",
    institucion: "UTN FRC",
    fechaActualizacion: "2026-07-02",
    estudiantes
  };
}

// ---------- Búsqueda por legajo ----------

function buscar() {
  const legajo = document.getElementById("input-legajo").value.trim();
  ocultarMensaje();

  if (!datos) return;

  if (legajo === "") {
    mostrarMensaje("Ingresá un número de legajo.", "info");
    return;
  }

  const estudiante = datos.estudiantes.find((e) => e.legajo === legajo);
  if (!estudiante) {
    mostrarMensaje("No se encontró ningún estudiante con el legajo " + legajo + ".", "error");
    return;
  }

  // Legajo válido: se oculta el login y se muestra solo la información del estudiante
  mostrarEstudiante(estudiante);
  document.getElementById("pantalla-login").classList.add("oculto");
  document.getElementById("pantalla-resultado").classList.remove("oculto");
}

function nuevaConsulta() {
  document.getElementById("pantalla-resultado").classList.add("oculto");
  document.getElementById("pantalla-login").classList.remove("oculto");
  const input = document.getElementById("input-legajo");
  input.value = "";
  input.focus();
}

// ---------- Presentación ----------

function mostrarEstudiante(est) {
  // 1) Datos del alumno
  document.getElementById("dato-legajo").textContent = est.legajo;
  document.getElementById("dato-nombre").textContent = est.apellidoNombre;
  document.getElementById("dato-comision").textContent = est.comision;
  document.getElementById("dato-materia").textContent = datos.materia;
  document.getElementById("dato-fecha").textContent = formatearFecha(datos.fechaActualizacion);

  // 2) Notas principales (lista vertical, en orden)
  const p1 = est.parciales ? est.parciales.primerParcial : undefined;
  const p2 = est.parciales ? est.parciales.segundoParcial : undefined;
  const nc = est.notaCuestionarios;

  const listaPrincipales = document.getElementById("lista-notas-principales");
  listaPrincipales.innerHTML = "";
  listaPrincipales.appendChild(filaNota("1.er Parcial", p1, true));
  listaPrincipales.appendChild(filaNota("2.º Parcial", p2, true));
  listaPrincipales.appendChild(filaNota("Cuestionarios", nc, true, true));

  // 3) Detalle de cuestionarios (complementario, según comisión)
  const orden = CUESTIONARIOS_POR_COMISION[est.comision] || [];
  const listaDetalleFe = document.getElementById("lista-cuestionarios-fe");
  const listaDetalleBe = document.getElementById("lista-cuestionarios-be");
  listaDetalleFe.innerHTML = "";
  listaDetalleBe.innerHTML = "";
  orden.forEach((nombre) => {
    const nota = est.cuestionarios ? est.cuestionarios[nombre] : undefined;
    const listaDetalle = nombre.endsWith("BE") ? listaDetalleBe : listaDetalleFe;
    listaDetalle.appendChild(filaNota(nombre, nota, false));
  });
  document.getElementById("detalle-cuestionarios").open = false;

  // 4) Resumen y recomendación
  mostrarResumen(p1, p2, nc);
}

/* Crea una fila de lista: nombre — nota — estado.
   conEstado=true agrega la etiqueta Aprobado/Recupera/Pendiente. */
function filaNota(nombre, nota, conEstado, redondearNota) {
  const li = document.createElement("li");
  li.className = "fila-nota";
  const notaEvaluada = redondearNota ? notaParaEvaluacion(nota) : nota;

  const spanNombre = document.createElement("span");
  spanNombre.className = "nombre";
  spanNombre.textContent = nombre;
  li.appendChild(spanNombre);

  const spanNota = document.createElement("span");
  spanNota.className = "nota";

  if (typeof nota === "number") {
    spanNota.textContent = notaEvaluada;
  } else {
    spanNota.textContent = conEstado ? "Sin cargar" : "Ausente";
    li.classList.add("pendiente");
  }
  li.appendChild(spanNota);

  const spanEstado = document.createElement("span");
  spanEstado.className = "estado";
  if (typeof nota !== "number") {
    if (conEstado) {
      spanEstado.textContent = "Pendiente";
      spanEstado.classList.add("pendiente");
    } else {
      spanEstado.textContent = "";
    }
  } else if (conEstado) {
    if (notaEvaluada >= NOTA_APROBACION) {
      spanEstado.textContent = "Aprobado";
      spanEstado.classList.add("aprobado");
    } else {
      spanEstado.textContent = "Recupera";
      spanEstado.classList.add("recupera");
    }
  } else {
    spanEstado.textContent = "";
  }
  li.appendChild(spanEstado);

  return li;
}

// ---------- Resumen y recomendación académica ----------
// La condición se calcula SOLO a partir de las tres notas principales:
// 1.er Parcial, 2.º Parcial y la nota final de cuestionarios del JSON.
// Los cuestionarios individuales pendientes no bloquean el cálculo.

function mostrarResumen(p1, p2, nc) {
  const cont = document.getElementById("condicion");
  const valor = document.getElementById("condicion-valor");
  const motivo = document.getElementById("condicion-motivo");
  const recomendacion = document.getElementById("condicion-recomendacion");
  const listaAprobadas = document.getElementById("lista-aprobadas");
  const listaRecuperar = document.getElementById("lista-recuperar");
  const bloqueAprobadas = document.getElementById("bloque-aprobadas");
  const bloqueRecuperar = document.getElementById("bloque-recuperar");

  cont.className = "condicion";
  valor.classList.remove("oculto");
  motivo.classList.remove("oculto");
  recomendacion.classList.remove("oculto");
  listaAprobadas.innerHTML = "";
  listaRecuperar.innerHTML = "";

  const principales = [
    { nombre: "1.er Parcial", nota: p1 },
    { nombre: "2.º Parcial", nota: p2 },
    { nombre: "Cuestionarios (nota final)", nota: nc }
  ];

  const faltantes = principales.filter((i) => typeof i.nota !== "number");

  // Solo si falta alguna de las tres notas principales
  if (faltantes.length > 0) {
    cont.classList.add("pendiente");
    valor.textContent = "Situación no determinada";
    motivo.textContent =
      "No es posible determinar la condición académica porque aún no se encuentra cargada la siguiente información: " +
      faltantes.map((i) => i.nombre).join(", ") + ".";
    recomendacion.textContent =
      "Recomendación: consultá nuevamente cuando la cátedra publique la totalidad de las notas principales.";
    bloqueAprobadas.classList.add("oculto");
    bloqueRecuperar.classList.add("oculto");
    return;
  }

  const aprobadas = principales.filter((i) => notaEvaluable(i) >= NOTA_APROBACION);
  const recuperar = principales.filter((i) => notaEvaluable(i) < NOTA_APROBACION);

  aprobadas.forEach((i) => listaAprobadas.appendChild(itemInstancia(i, true)));
  recuperar.forEach((i) => listaRecuperar.appendChild(itemInstancia(i, false)));
  bloqueAprobadas.classList.toggle("oculto", aprobadas.length === 0);
  bloqueRecuperar.classList.toggle("oculto", recuperar.length === 0);

  const recuperaP1 = p1 < NOTA_APROBACION;
  const recuperaP2 = p2 < NOTA_APROBACION;
  const recuperaCuest = notaParaEvaluacion(nc) < NOTA_APROBACION;

  if (!recuperaP1 && !recuperaP2 && !recuperaCuest) {
    cont.classList.add("regular");
    valor.textContent = "Regular";
    motivo.textContent =
      "El estudiante cumple con las condiciones requeridas para regularizar " + datos.materia +
      ". Tiene aprobados ambos parciales y la nota final de cuestionarios alcanza el mínimo establecido por la cátedra (" +
      NOTA_APROBACION + ").";
    recomendacion.textContent =
      "Recomendación: no registra instancias pendientes de recuperación. Se recomienda conservar esta información como referencia hasta la validación final en los registros académicos oficiales.";
  } else if (recuperaP1 && recuperaP2) {
    cont.classList.add("libre");
    valor.textContent = "";
    motivo.textContent = "";
    recomendacion.textContent = "";
    valor.classList.add("oculto");
    motivo.classList.add("oculto");
    recomendacion.classList.add("oculto");
  } else if (recuperaCuest && !recuperaP1 && !recuperaP2) {
    cont.classList.add("recupera");
    valor.textContent = "Debe recuperar cuestionarios";
    motivo.textContent =
      "El estudiante tiene aprobados los parciales, pero la nota final de cuestionarios (" + nc +
      ") no alcanza el mínimo requerido (" + NOTA_APROBACION + ") para regularizar la materia.";
    recomendacion.textContent =
      "Recomendación: debe recuperar cuestionarios para alcanzar la condición necesaria. La nota final de cuestionarios cargada por la cátedra es la referencia válida para este cálculo.";
  } else {
    cont.classList.add("recupera");
    valor.textContent = "Debe recuperar";
    const parcialAdeudado = recuperaP1 ? "1.er Parcial" : "2.º Parcial";
    const notaAdeudada = recuperaP1 ? p1 : p2;
    let texto =
      "El estudiante no alcanza la condición de regularidad porque registra una nota inferior a " +
      NOTA_APROBACION + " en el " + parcialAdeudado + " (nota " + notaAdeudada + ").";
    texto += recuperaCuest
      ? " Además, la nota final de cuestionarios (" + nc + ") no alcanza el mínimo requerido."
      : " El resto de las instancias cumple con el mínimo requerido.";
    motivo.textContent = texto;
    let rec = "Recomendación: debe recuperar el teórico correspondiente al " + parcialAdeudado + ".";
    if (recuperaCuest) rec += " También debe recuperar cuestionarios.";
    rec += " La instancia práctica será integradora, según las condiciones definidas por la cátedra.";
    recomendacion.textContent = rec;
  }
}

function itemInstancia(inst, aprobada) {
  const li = document.createElement("li");
  li.textContent = inst.nombre + ": " + inst.nota + (aprobada ? " (aprobado)" : " (nota inferior a " + NOTA_APROBACION + ")");
  return li;
}

// ---------- Utilidades ----------

function notaEvaluable(inst) {
  return inst.nombre === "Cuestionarios (nota final)" ? notaParaEvaluacion(inst.nota) : inst.nota;
}

function notaParaEvaluacion(nota) {
  if (typeof nota !== "number") return nota;
  return Math.round(nota);
}

function formatearFecha(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d + "/" + m + "/" + a;
}

function mostrarMensaje(texto, tipo) {
  const el = document.getElementById("mensaje");
  el.textContent = texto;
  el.className = "mensaje " + tipo;
}

function ocultarMensaje() {
  const el = document.getElementById("mensaje");
  el.className = "mensaje oculto";
}
