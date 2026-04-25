export function validarRUT(rut) {
  const limpio = rut.replace(/[.\-\s]/g, "").toUpperCase();
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  return dv === (suma % 11 === 0 ? "0" : suma % 11 === 1 ? "K" : String(11 - (suma % 11)));
}

export function calcularEdad(fn) {
  if (!fn) return "–";
  const h = new Date(), n = new Date(fn + "T00:00:00");
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
  return e;
}

export function formatearFecha(f) {
  if (!f) return "–";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPeso(n) {
  if (n == null) return "–";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export async function descargarImagen(url, nombreDefault) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = nombreDefault.replace(/\s+/g, '_').toLowerCase(); 
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch { 
    window.open(url, "_blank"); 
  }
}

export function getCurrentTrimestre() {
  const h = new Date();
  const meses = [["Ene","Mar"],["Abr","Jun"],["Jul","Sep"],["Oct","Dic"]];
  return `${meses[Math.floor(h.getMonth()/3)][0]}-${meses[Math.floor(h.getMonth()/3)][1]} ${h.getFullYear()}`;
}

export function generarTrimestres() {
  const meses = [["Ene","Mar"],["Abr","Jun"],["Jul","Sep"],["Oct","Dic"]];
  const a = new Date().getFullYear();
  const r = [];
  for (let anio = a + 1; anio >= a - 1; anio--)
    for (let i = 3; i >= 0; i--) r.push(`${meses[i][0]}-${meses[i][1]} ${anio}`);
  return r;
}

// Constantes globales
export const BUCKET_CARNETS = "carnets";
export const BUCKET_COMPROBANTES = "comprobantes";
export const BUCKET_COMPRAS = "compras";
export const POSICIONES = ["PU - Punta", "CE - Central", "LB - Líbero", "OP - Opuesto", "A - Armador"];
export const ESTADOS = ["activo", "inactivo", "congelado"];
export const TRIMESTRES = generarTrimestres();

export const FORM_VACIO = { nombre_completo: "", rut: "", fecha_nacimiento: "", direccion: "", telefono: "", email_personal: "", posicion: "", altura_cm: "", estado: "activo" };
export const PAGO_FORM_VACIO = { periodo: "", monto: "10000", fecha_pago: new Date().toISOString().split("T")[0] };
export const COMPRA_FORM_VACIO = { producto: "", monto: "", fecha_compra: new Date().toISOString().split("T")[0] };