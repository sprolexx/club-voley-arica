import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ═══════════════════════════════════════════════════════════════
//  UTILIDADES Y FUNCIONES EXTERNAS (Fuera del componente para evitar re-renders)
// ═══════════════════════════════════════════════════════════════

function validarRUT(rut) {
  const limpio = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const resto = suma % 11;
  return dv === (resto === 0 ? "0" : resto === 1 ? "K" : String(11 - resto));
}

function calcularEdad(fn) {
  if (!fn) return "–";
  const h = new Date(), n = new Date(fn + "T00:00:00");
  let e = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) e--;
  return e;
}

function formatearFecha(f) {
  if (!f) return "–";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

function formatPeso(n) {
  if (n == null) return "–";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

async function descargarImagen(url, nombreDefault) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = nombreDefault.replace(/\s+/g, '_').toLowerCase(); 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank"); 
  }
}

function getCurrentTrimestre() {
  const h = new Date();
  const meses = [["Ene","Mar"],["Abr","Jun"],["Jul","Sep"],["Oct","Dic"]];
  return `${meses[Math.floor(h.getMonth()/3)][0]}-${meses[Math.floor(h.getMonth()/3)][1]} ${h.getFullYear()}`;
}

function generarTrimestres() {
  const meses = [["Ene","Mar"],["Abr","Jun"],["Jul","Sep"],["Oct","Dic"]];
  const anio = new Date().getFullYear();
  const r = [];
  for (let a = anio + 1; a >= anio - 1; a--)
    for (let i = 3; i >= 0; i--)
      r.push(`${meses[i][0]}-${meses[i][1]} ${a}`);
  return r;
}

// Lógica de Subida de Imagenes movida al Outer Scope
async function uploadSingleImage(file, bucket, originalRut, typeSuffix) {
  if (!file) return null;
  const cleanRut = originalRut.replace(/[.\s-]/g, "");
  const ext = file.name.split(".").pop().toLowerCase();
  const nombre = `${cleanRut}/${typeSuffix}.${ext}`; 
  const { error } = await supabase.storage.from(bucket).upload(nombre, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(nombre);
  return data.publicUrl;
}

async function deleteSingleImage(url, bucket) {
  if (!url) return;
  try {
    const partes = url.split(`/${bucket}/`);
    if (partes.length < 2) return;
    await supabase.storage.from(bucket).remove([partes[1].split("?")[0]]);
  } catch { console.warn("No se pudo eliminar imagen antigua"); }
}

async function uploadSingleFile(file, bucket, folder, profesionalName) {
  if (!file) return null;
  const { error } = await supabase.storage.from(bucket).upload(`${folder}/${profesionalName}`, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(`${folder}/${profesionalName}`);
  return data.publicUrl;
}

// ═══════════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════════
const BUCKET_CARNETS       = "carnets";      
const BUCKET_COMPROBANTES  = "comprobantes"; 
const BUCKET_COMPRAS       = "compras";      

const POSICIONES = ["PU - Punta", "CE - Central", "LB - Líbero", "OP - Opuesto", "A - Armador"];
const TRIMESTRES = generarTrimestres();

const FORM_VACIO = {
  nombre_completo: "", rut: "", fecha_nacimiento: "", direccion: "",
  telefono: "", email_personal: "", posicion: "", altura_cm: "",
  foto_perfil_url: "", carnet_frontal_url: "", carnet_trasero_url: "",
};
const PAGO_FORM_VACIO = {
  periodo: "", monto: "10000", fecha_pago: new Date().toISOString().split("T")[0],
};
const COMPRA_FORM_VACIO = {
  producto: "", monto: "", fecha_compra: new Date().toISOString().split("T")[0],
};

// ═══════════════════════════════════════════════════════════════
//  ICONOS SVG INLINE
// ═══════════════════════════════════════════════════════════════
const Icon = ({ name, className = "w-5 h-5" }) => {
  if (name === "spinner") return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
  if (name === "volleyball") return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2C9 5 9 8 12 12M12 2C15 5 15 8 12 12M2 12C5 9 8 9 12 12M2 12C5 15 8 15 12 12M22 12C19 9 16 9 12 12M22 12C19 15 16 15 12 12" />
    </svg>
  );
  const paths = {
    plus:          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />,
    edit:          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />,
    trash:         <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" />,
    close:         <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
    user:          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    users:         <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
    check:         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />,
    warning:       <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />,
    search:        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    camera:        <><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    eye:           <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
    download:      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    sun:           <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />,
    moon:          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
    banknote:      <><rect x="2" y="7" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/><circle cx="12" cy="14" r="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    receipt:       <><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></>,
    paperclip:     <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />,
    "id-card":     <><rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 15v-1a3 3 0 016 0v1M10 9a2 2 0 100-4 2 2 0 000 4zM15 11h3M15 14h3" /></>,
    "arrow-up":    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />,
    "arrow-down":  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />,
    "chart-bar":   <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    phone:         <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />,
    mail:          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    "chevron-down":<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />,
    "minus-circle":<><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" /></>,
  };
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {paths[name]}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
//  COMPONENTES UI COMPARTIDOS
// ═══════════════════════════════════════════════════════════════
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ animation: "slideUp .3s ease" }}
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold pointer-events-none        ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
      <Icon name={toast.type === "error" ? "warning" : "check"} className="w-4 h-4 flex-shrink-0" />
      {toast.message}
    </div>
  );
}

function DeleteModal({ player, onConfirm, onCancel }) {
  if (!player) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div style={{ animation: "fadeIn .2s ease" }}
        className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 w-full max-sm:w-[90vw] max-w-sm shadow-2xl transition-colors duration-300">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-5">
          <Icon name="trash" className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">¿Eliminar jugador?</h3>
        <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-7">
          Se eliminará a <span className="font-semibold text-slate-900 dark:text-white">{player.nombre_completo}</span> y todos sus registros.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium transition-colors">
            Cancelar
          </button>
          <button onClick={() => onConfirm(player)}
            className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors">
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageUploadField({ label, preview, onChange, error, hint = "Seleccionar imagen", compact = false }) {
  const ref = useRef(null);
  const h = compact ? "h-24" : "h-36";
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 transition-colors">
          {label}
        </label>
      )}
      <div onClick={() => ref.current?.click()}
        className={`relative w-full ${h} rounded-xl overflow-hidden border-2 border-dashed cursor-pointer group transition-colors duration-300          ${error ? "border-red-500" : "border-slate-300 dark:border-slate-700 hover:border-amber-500"}`}>
        {preview ? (
          <>
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Icon name="camera" className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50">
            <Icon name="camera" className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors" />
            <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors text-center px-2">{hint}</span>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{error}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SECCIÓN PAGOS (Dentro del Modal del Jugador)
// ═══════════════════════════════════════════════════════════════
function PagosSection({ jugadorId, playerName, pagos, pagosLoading, onSavePago }) {
  const comprobanteRef = useRef(null);
  const [showForm, setShowForm]       = useState(false);
  const [pagoForm, setPagoForm]       = useState(PAGO_FORM_VACIO);
  const [pagoFile, setPagoFile]       = useState(null);
  const [pagoPreview, setPagoPreview] = useState(null);
  const [pagoErrors, setPagoErrors]   = useState({});
  const [saving, setSaving]           = useState(false);

  function abrirForm() {
    setPagoForm({ ...PAGO_FORM_VACIO, periodo: getCurrentTrimestre() });
    setPagoFile(null); setPagoPreview(null); setPagoErrors({});
    setShowForm(true);
  }

  function cambiar(f, v) {
    setPagoForm(p => ({ ...p, [f]: v }));
    setPagoErrors(p => ({ ...p, [f]: undefined }));
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPagoErrors(p => ({ ...p, comprobante: "Solo imágenes" })); return; }
    if (file.size > 8 * 1024 * 1024) { setPagoErrors(p => ({ ...p, comprobante: "Máx. 8 MB" })); return; }
    setPagoFile(file); setPagoPreview(URL.createObjectURL(file));
    setPagoErrors(p => ({ ...p, comprobante: undefined }));
  }

  function validar() {
    const e = {};
    if (!pagoForm.periodo.trim()) e.periodo = "Requerido";
    const n = parseInt(pagoForm.monto, 10);
    if (!pagoForm.monto || isNaN(n) || n <= 0) e.monto = "Monto inválido";
    if (!pagoForm.fecha_pago) e.fecha_pago = "Requerido";
    setPagoErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validar()) return;
    setSaving(true);
    const nombreDescarga = `Voucher_${playerName}_${pagoForm.periodo}.jpg`;
    const ok = await onSavePago(jugadorId, pagoForm, pagoFile, nombreDescarga);
    setSaving(false);
    if (ok) { setShowForm(false); setPagoFile(null); setPagoPreview(null); }
  }

  const iCls = (f) =>
    `w-full bg-slate-100 dark:bg-slate-800/80 border ${pagoErrors[f] ? "border-red-500" : "border-slate-300 dark:border-slate-700"}    rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors`;

  return (
    <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="banknote" className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Historial de pagos</p>
          {pagos.length > 0 && (
            <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">{pagos.length}</span>
          )}
        </div>
        {!showForm && (
          <button onClick={abrirForm}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
            <Icon name="plus" className="w-3.5 h-3.5" /> Registrar pago
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ animation: "fadeIn .2s ease" }}
          className="mb-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 transition-colors duration-300">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Icon name="receipt" className="w-4 h-4" /> Nuevo pago
            </p>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
          <form id="pago-form-detail" onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Período *</label>
              <input type="text" className={iCls("periodo")} placeholder="Ej: Abr-Jun 2026"
                value={pagoForm.periodo} onChange={e => cambiar("periodo", e.target.value)} />
              {pagoErrors.periodo && <p className="text-red-500 text-xs mt-1">{pagoErrors.periodo}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Monto (CLP) *</label>
                <input type="number" className={iCls("monto")} placeholder="10000" min="1"
                  value={pagoForm.monto} onChange={e => cambiar("monto", e.target.value)} />
                {pagoErrors.monto && <p className="text-red-500 text-xs mt-1">{pagoErrors.monto}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Fecha *</label>
                <input type="date" className={iCls("fecha_pago")} value={pagoForm.fecha_pago}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e => cambiar("fecha_pago", e.target.value)} style={{ colorScheme: "dark" }} />
                {pagoErrors.fecha_pago && <p className="text-red-500 text-xs mt-1">{pagoErrors.fecha_pago}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Comprobante <span className="normal-case font-normal">(opcional)</span>
              </label>
              <div onClick={() => comprobanteRef.current?.click()}
                className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 cursor-pointer group transition-colors duration-300                  ${pagoErrors.comprobante ? "border-red-400" : "border-slate-300 dark:border-slate-700 hover:border-amber-500"}`}>
                {pagoPreview ? (
                  <>
                    <img src={pagoPreview} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Imagen seleccionada</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/10 transition-colors">
                      <Icon name="paperclip" className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Subir foto del voucher · JPG, PNG
                    </p>
                  </>
                )}
              </div>
              {pagoErrors.comprobante && <p className="text-red-500 text-xs mt-1">{pagoErrors.comprobante}</p>}
              <input ref={comprobanteRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-xs font-semibold transition-colors">
                Cancelar
              </button>
              <button type="submit" form="pago-form-detail" disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors">
                {saving ? <><Icon name="spinner" className="w-3.5 h-3.5" /> Guardando...</> : <><Icon name="check" className="w-3.5 h-3.5" /> Confirmar</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {pagosLoading ? (
        <div className="flex items-center justify-center py-5 gap-2">
          <Icon name="spinner" className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-slate-400">Cargando…</span>
        </div>
      ) : pagos.length === 0 ? (
        <div className="py-5 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl transition-colors">
          <Icon name="banknote" className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto mb-1.5" />
          <p className="text-slate-400 dark:text-slate-500 text-xs">Sin pagos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pagos.map(pago => (
            <div key={pago.id}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl gap-3 transition-colors duration-300">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{pago.periodo}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatPeso(pago.monto)}</span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatearFecha(pago.fecha_pago)}</span>
                </div>
              </div>
              {pago.comprobante_url ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 font-semibold bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200 dark:border-sky-500/20 px-2.5 py-1 rounded-lg transition-colors">
                    <Icon name="eye" className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ver</span>
                  </a>
                  <button onClick={() => descargarImagen(pago.comprobante_url, `Comprobante_${playerName}_${pago.periodo}.jpg`)}
                    className="p-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <Icon name="download" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-600 italic flex-shrink-0">Sin voucher</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL DETALLES DEL JUGADOR
// ═══════════════════════════════════════════════════════════════
function PlayerDetailsModal({ player, onClose, onEdit, onDelete, pagos, pagosLoading, onSavePago }) {
  if (!player) return null;
  const fotoPerfil   = player.foto_perfil_url   || player.foto_url || null;
  const carnetFrente = player.carnet_frontal_url || null;
  const carnetDorso  = player.carnet_trasero_url || null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div style={{ animation: "fadeIn .2s ease" }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-sm:w-[95vw] max-w-md shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-colors duration-300">
        {/* Cabecera */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0 transition-colors duration-300">
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 transition-colors">
            <Icon name="user" className="w-4 h-4 text-amber-500" /> Detalle del jugador
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <Icon name="close" />
          </button>
        </div>
        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1 p-6 max-sm:p-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          
          {/* ── FOTO DE PERFIL ── */}
          <div className="w-full h-52 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-5 transition-colors duration-300">
            {fotoPerfil
              ? <img src={fotoPerfil} alt={player.nombre_completo} className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 gap-2"><Icon name="camera" className="w-10 h-10" /><span className="text-xs">Sin foto de perfil</span></div>}
          </div>

          {/* ── DATOS PRINCIPALES ── */}
          <div className="space-y-4 max-sm:space-y-3 mb-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Nombre completo</p>
              <p className="text-slate-900 dark:text-white font-bold text-xl transition-colors">{player.nombre_completo}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">RUT</p>
                <p className="text-amber-600 dark:text-amber-400 font-mono text-sm">{player.rut}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Edad</p>
                <p className="text-slate-900 dark:text-white font-semibold text-sm transition-colors">{calcularEdad(player.fecha_nacimiento)} años</p>
              </div>
            </div>

            {/* Posición + Altura */}
            {(player.posicion || player.altura_cm) && (
              <div className="grid grid-cols-2 gap-3">
                {player.posicion && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Posición</p>
                    <p className="text-slate-900 dark:text-white font-semibold text-sm transition-colors">{player.posicion}</p>
                  </div>
                )}
                {player.altura_cm && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Altura</p>
                    <p className="text-slate-900 dark:text-white font-semibold text-sm transition-colors">{player.altura_cm} cm</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Fecha de nacimiento</p>
              <p className="text-slate-700 dark:text-slate-300 text-sm transition-colors">{formatearFecha(player.fecha_nacimiento)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Dirección</p>
              <p className="text-slate-700 dark:text-slate-300 text-sm transition-colors">{player.direccion || "–"}</p>
            </div>

            {/* Contacto */}
            {(player.telefono || player.email_personal) && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                {player.telefono && (
                  <a href={`tel:${player.telefono}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                    <Icon name="phone" className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    {player.telefono}
                  </a>
                )}
                {player.email_personal && (
                  <a href={`mailto:${player.email_personal}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                    <Icon name="mail" className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    {player.email_personal}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── DOCUMENTACIÓN: Carnets ── */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 mb-1 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="id-card" className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Documentación</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Carnet Frontal", url: carnetFrente, suffix: "frontal" },
                { label: "Carnet Trasero", url: carnetDorso, suffix: "trasero" },
              ].map(({ label, url, suffix }) => (
                <div key={suffix}>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 transition-colors">{label}</p>
                  {url ? (
                    <>
                      <div className="h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-1.5 transition-colors">
                        <img src={url} alt={label} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-500/10 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 transition-colors min-w-[60px]">
                          <Icon name="eye" className="w-3 h-3" /> <span className="max-sm:hidden">Ver</span>
                        </a>
                        <button
                          onClick={() => descargarImagen(url, `${player.nombre_completo}_carnet_${suffix}.jpg`)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-700 transition-colors min-w-[80px]">
                          <Icon name="download" className="w-3 h-3" /> <span className="max-sm:hidden">Bajar</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="h-24 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center transition-colors">
                      <p className="text-xs text-slate-400 dark:text-slate-600">Sin imagen</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── HISTORIAL DE PAGOS ── */}
          <PagosSection
            jugadorId={player.id}
            playerName={player.nombre_completo}
            pagos={pagos}
            pagosLoading={pagosLoading}
            onSavePago={onSavePago}
          />
        </div>

        {/* Footer acciones */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0 transition-colors duration-300">
          <button onClick={() => { onClose(); onEdit(player); }}
            className="flex flex-col items-center justify-center py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-white text-xs font-semibold transition-colors">
            <Icon name="edit" className="w-4 h-4 mb-1 text-slate-400" /> Editar
          </button>
          {fotoPerfil ? (
            <button onClick={() => descargarImagen(fotoPerfil, `Perfil_${player.nombre_completo}.jpg`)}
              className="flex flex-col items-center justify-center py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-sky-600 dark:text-sky-400 text-xs font-semibold transition-colors">
              <Icon name="download" className="w-4 h-4 mb-1" /> <span className="max-sm:hidden">Bajar</span> Perfil
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center py-2.5 opacity-40 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 text-xs font-semibold">
              <Icon name="download" className="w-4 h-4 mb-1" /> Sin foto
            </div>
          )}
          <button onClick={() => { onClose(); onDelete(player); }}
            className="flex flex-col items-center justify-center py-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold transition-colors">
            <Icon name="trash" className="w-4 h-4 mb-1" /> Borrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PANEL FORMULARIO JUGADOR (Con 3 fotos)
// ═══════════════════════════════════════════════════════════════
function PlayerFormPanel({
  show, editingId, form, setForm, errors, setErrors,
  previews, onPhotoChange, onSubmit, onClose, submitting,
}) {
  const inputCls = (f) =>
    `w-full bg-slate-50 dark:bg-slate-900 border ${errors[f] ? "border-red-500" : "border-slate-300 dark:border-slate-700"}    rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors duration-300`;
  
  const selectCls = (f) =>
    `w-full bg-slate-50 dark:bg-slate-900 border ${errors[f] ? "border-red-500" : "border-slate-300 dark:border-slate-700"}    rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors duration-300 appearance-none`;

  const cambiar = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: undefined })); };
  const rutOk = form.rut.length >= 8 && validarRUT(form.rut);

  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 dark:bg-black/65 backdrop-blur-sm transition-all duration-300 ${show ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${show ? "translate-x-0" : "translate-x-full"}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 transition-colors duration-300">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white transition-colors">{editingId ? "Editar jugador" : "Agregar jugador"}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">Completa todos los campos requeridos</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <Icon name="close" />
          </button>
        </div>

        {/* Formulario scrollable */}
        <form id="jugador-form" onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 max-sm:px-4 space-y-6" style={{ scrollbarWidth: "thin" }}>
          
          {/* ── SECCIÓN: Foto de Perfil ── */}
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center flex-shrink-0">1</span>
              Foto de perfil *
            </p>
            <ImageUploadField
              preview={previews.perfil}
              onChange={e => onPhotoChange("perfil", e)}
              error={errors.foto_perfil}
              hint="Foto del jugador (rostro)"
            />
          </div>

          {/* ── SECCIÓN: Carnets ── */}
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center flex-shrink-0">2</span>
              Carnet de identidad
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ImageUploadField
                label="Frontal"
                preview={previews.frontal}
                onChange={e => onPhotoChange("frontal", e)}
                error={errors.carnet_frontal}
                hint="Lado frontal"
                compact
              />
              <ImageUploadField
                label="Trasero"
                preview={previews.trasero}
                onChange={e => onPhotoChange("trasero", e)}
                error={errors.carnet_trasero}
                hint="Lado trasero"
                compact
              />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 transition-colors" />

          {/* ── SECCIÓN: Datos personales ── */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center flex-shrink-0">3</span>
              Datos personales
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Nombre completo *</label>
              <input type="text" className={inputCls("nombre_completo")} placeholder="Ej: Valentina González Rojas"
                value={form.nombre_completo} onChange={e => cambiar("nombre_completo", e.target.value)} />
              {errors.nombre_completo && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.nombre_completo}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">RUT *</label>
              <input type="text" className={inputCls("rut")} placeholder="Ej: 12.345.678-9"
                value={form.rut} maxLength={12} onChange={e => cambiar("rut", e.target.value.replace(/[^0-9kK]/g, ""))} />
              {errors.rut
                ? <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.rut}</p>
                : rutOk && <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">✓ RUT válido</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Posición</label>
                <div className="relative">
                  <select className={selectCls("posicion")} value={form.posicion} onChange={e => cambiar("posicion", e.target.value)}>
                    <option value="">– Seleccionar –</option>
                    {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <Icon name="chevron-down" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Altura (cm)</label>
                <input type="number" className={inputCls("altura_cm")} placeholder="Ej: 175"
                  min="100" max="250" value={form.altura_cm} onChange={e => cambiar("altura_cm", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Fecha de nacimiento *</label>
              <input type="date" className={inputCls("fecha_nacimiento")} value={form.fecha_nacimiento}
                max={new Date().toISOString().split("T")[0]} onChange={e => cambiar("fecha_nacimiento", e.target.value)}
                style={{ colorScheme: "dark" }} />
              {errors.fecha_nacimiento && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.fecha_nacimiento}</p>}
            </div>
          </div>

          {/* ── SECCIÓN: Contacto ── */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center flex-shrink-0">4</span>
              Contacto
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Dirección *</label>
              <input type="text" className={inputCls("direccion")} placeholder="Ej: Av. Los Héroes 1234, Arica"
                value={form.direccion} onChange={e => cambiar("direccion", e.target.value)} />
              {errors.direccion && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.direccion}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Teléfono</label>
                <input type="text" className={inputCls("telefono")} placeholder="+56 9 1234 5678"
                  value={form.telefono} onChange={e => cambiar("telefono", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide transition-colors">Email</label>
                <input type="email" className={inputCls("email_personal")} placeholder="correo@email.com"
                  value={form.email_personal} onChange={e => cambiar("email_personal", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="h-2" />
        </form>

        {/* Footer submit */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 transition-colors duration-300">
          <button type="submit" form="jugador-form" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-colors">
            {submitting
              ? <><Icon name="spinner" className="w-4 h-4" /> Guardando...</>
              : <><Icon name="check" className="w-4 h-4" /> {editingId ? "Guardar cambios" : "Agregar jugador"}</>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL PAGO RÁPIDO (Finanzas)
// ═══════════════════════════════════════════════════════════════
function QuickPayModal({ player, trimestre, onSave, onClose }) {
  const comprobanteRef = useRef(null);
  const [form, setForm]       = useState({ ...PAGO_FORM_VACIO, periodo: trimestre });
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);

  if (!player) return null;

  const cambiar = (f, v) => { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: undefined })); };

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErrors(p => ({ ...p, comp: "Solo imágenes" })); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  function validar() {
    const e = {};
    if (!form.periodo.trim()) e.periodo = "Requerido";
    const n = parseInt(form.monto, 10);
    if (isNaN(n) || n <= 0) e.monto = "Monto inválido";
    if (!form.fecha_pago) e.fecha_pago = "Requerido";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validar()) return;
    setSaving(true);
    // Agregamos el nombre profesional para la descarga del comprobante
    const nombreDescarga = `Voucher_${player.nombre_completo}_${form.periodo}.jpg`;
    const ok = await onSave(player.id, form, file, nombreDescarga);
    setSaving(false);
    if (ok) onClose();
  }

  const iCls = (f) =>
    `w-full bg-slate-100 dark:bg-slate-800 border ${errors[f] ? "border-red-500" : "border-slate-300 dark:border-slate-700"}    rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div style={{ animation: "fadeIn .2s ease" }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-sm max-sm:max-w-full shadow-2xl transition-colors duration-300">
        <div className="flex items-center justify-between p-5 max-sm:p-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base transition-colors">Registrar pago</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{player.nombre_completo}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><Icon name="close" /></button>
        </div>
        <form id="quick-pay-form" onSubmit={handleSubmit} className="p-5 max-sm:p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Período *</label>
            <input type="text" className={iCls("periodo")} placeholder="Ej: Abr-Jun 2026"
              value={form.periodo} onChange={e => cambiar("periodo", e.target.value)} />
            {errors.periodo && <p className="text-red-500 text-xs mt-1">{errors.periodo}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Monto (CLP) *</label>
              <input type="number" className={iCls("monto")} min="1" placeholder="10000"
                value={form.monto} onChange={e => cambiar("monto", e.target.value)} />
              {errors.monto && <p className="text-red-500 text-xs mt-1">{errors.monto}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Fecha *</label>
              <input type="date" className={iCls("fecha_pago")} value={form.fecha_pago}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => cambiar("fecha_pago", e.target.value)} style={{ colorScheme: "dark" }} />
              {errors.fecha_pago && <p className="text-red-500 text-xs mt-1">{errors.fecha_pago}</p>}
            </div>
          </div>
          {/* Comprobante */}
          <div onClick={() => comprobanteRef.current?.click()}
            className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-xl cursor-pointer group transition-colors">
            {preview
              ? <img src={preview} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              : <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/10 transition-colors">
                  <Icon name="paperclip" className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                </div>}
            <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate flex-1">
              {preview ? "✓ Imagen seleccionada" : "Adjuntar comprobante (opcional)"}
            </p>
          </div>
          <input ref={comprobanteRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </form>
        <div className="px-5 max-sm:px-4 pb-5 max-sm:pb-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 max-sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium text-sm transition-colors">
            Cancelar
          </button>
          <button type="submit" form="quick-pay-form" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 max-sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-bold text-sm transition-colors">
            {saving ? <><Icon name="spinner" className="w-4 h-4" /> Guardando...</> : <><Icon name="check" className="w-4 h-4" /> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  VISTA DE FINANZAS
// ═══════════════════════════════════════════════════════════════
function FinanceView({
  players,
  trimestre, setTrimestre,
  pagosTrimestre, comprasTrimestre,
  loadingFinanzas,
  onSavePago, onSaveCompra, onDeleteCompra,
  onQuickPay,
}) {
  const [tab, setTab]                       = useState("jugadores");
  const [showCompraForm, setShowCompraForm] = useState(false);
  const [compraForm, setCompraForm]         = useState(COMPRA_FORM_VACIO);
  const [compraFile, setCompraFile]         = useState(null);
  const [compraPreview, setCompraPreview]   = useState(null);
  const [compraErrors, setCompraErrors]     = useState({});
  const [savingCompra, setSavingCompra]     = useState(false);
  const voucherRef                          = useRef(null);

  const totalIngresos = pagosTrimestre.reduce((s, p) => s + (p.monto || 0), 0);
  const totalEgresos  = comprasTrimestre.reduce((s, c) => s + (c.monto || 0), 0);
  const balance       = totalIngresos - totalEgresos;

  const pagoMap = {};
  pagosTrimestre.forEach(p => { if (!pagoMap[p.jugador_id]) pagoMap[p.jugador_id] = p; });

  const movimientos = [
    ...pagosTrimestre.map(p => ({
      tipo: "ingreso", id: `pago-${p.id}`, fecha: p.fecha_pago,
      descripcion: `${players.find(j => j.id === p.jugador_id)?.nombre_completo ?? "Jugador"} · ${p.periodo}`,
      monto: p.monto, url: p.comprobante_url,
    })),
    ...comprasTrimestre.map(c => ({
      tipo: "egreso", id: `compra-${c.id}`, fecha: c.fecha_compra,
      descripcion: c.producto,
      monto: c.monto, url: c.comprobante_url,
    })),
  ].sort((a, b) => b.fecha?.localeCompare(a.fecha ?? "") ?? 0);

  const cambiarCompra = (f, v) => { setCompraForm(p => ({ ...p, [f]: v })); setCompraErrors(p => ({ ...p, [f]: undefined })); };

  function handleVoucher(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setCompraErrors(p => ({ ...p, voucher: "Solo imágenes" })); return; }
    if (file.size > 8 * 1024 * 1024) { setCompraErrors(p => ({ ...p, voucher: "Máx. 8 MB" })); return; }
    setCompraFile(file); setCompraPreview(URL.createObjectURL(file));
    setCompraErrors(p => ({ ...p, voucher: undefined }));
  }

  function validarCompra() {
    const e = {};
    if (!compraForm.producto.trim()) e.producto = "Requerido";
    const n = parseInt(compraForm.monto, 10);
    if (!compraForm.monto || isNaN(n) || n <= 0) e.monto = "Monto inválido";
    if (!compraForm.fecha_compra) e.fecha_compra = "Requerido";
    setCompraErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmitCompra(e) {
    e.preventDefault();
    if (!validarCompra()) return;
    setSavingCompra(true);
    // Agregamos el nombre profesional para la descarga del voucher de compra
    const nombreDescarga = `Voucher_Compra_${compraForm.producto.replace(/\s+/g, '_')}_${trimestre}.jpg`;
    const ok = await onSaveCompra({ ...compraForm, trimestre_referencia: trimestre }, compraFile, nombreDescarga);
    setSavingCompra(false);
    if (ok) {
      setCompraForm(COMPRA_FORM_VACIO); setCompraFile(null); setCompraPreview(null);
      setShowCompraForm(false);
    }
  }

  const iCls = (f) =>
    `w-full bg-slate-100 dark:bg-slate-800/80 border ${compraErrors[f] ? "border-red-500" : "border-slate-300 dark:border-slate-700"}    rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors`;

  const tabBtn = (key, label, icon) => (
    <button key={key} onClick={() => setTab(key)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200        ${tab === key          ? "bg-amber-500 text-slate-950 shadow-sm"          : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-700"}`}>
      <Icon name={icon} className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-shrink-0">Trimestre:</label>
        <div className="relative">
          <select value={trimestre} onChange={e => setTrimestre(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 pr-9 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm transition-colors cursor-pointer">
            {TRIMESTRES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Icon name="chevron-down" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 max-sm:grid-cols-1 max-sm:gap-2">
        {[
          { label: "Ingresos",  value: totalIngresos, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", icon: "arrow-up" },
          { label: "Egresos",   value: totalEgresos,  color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",             icon: "arrow-down" },
          { label: "Balance",   value: balance,       color: balance >= 0 ? "text-sky-600 dark:text-sky-400" : "text-red-600 dark:text-red-400",            bg: "bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20", icon: "chart-bar" },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-2xl p-4 max-sm:p-3 transition-colors duration-300`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name={c.icon} className={`w-3.5 h-3.5 ${c.color}`} />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors tracking-wide">{c.label}</p>
            </div>
            <p className={`font-display text-3xl max-sm:text-2xl leading-none ${c.color}`}>
              {formatPeso(c.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabBtn("jugadores",   "Jugadores",   "users")}
        {tabBtn("compras",     "Compras",      "receipt")}
        {tabBtn("movimientos", "Movimientos",  "banknote")}
      </div>

      {loadingFinanzas ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Icon name="spinner" className="w-7 h-7 text-amber-500" />
          <span className="text-slate-500 text-sm">Cargando finanzas…</span>
        </div>
      ) : (
        <>
          {/* TAB: JUGADORES */}
          {tab === "jugadores" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
              <div className="px-4 max-sm:px-3 py-3 max-sm:py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider max-sm:text-[10px]">Estado de pagos</p>
                  <span className="text-xs max-sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
                    {pagosTrimestre.length}/{players.length} pagados
                  </span>
                </div>
              </div>
              {players.length === 0 ? (
                <p className="text-center text-slate-400 py-10 max-sm:py-6 text-sm">Sin jugadores registrados</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 transition-colors">
                  {players.map(player => {
                    const pago = pagoMap[player.id];
                    return (
                      <div key={player.id} className="flex items-center gap-3 px-4 py-3 max-sm:px-3 max-sm:py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0 transition-colors">
                          {(player.foto_perfil_url || player.foto_url)
                            ? <img src={player.foto_perfil_url || player.foto_url} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Icon name="user" className="w-4 h-4 text-slate-400" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate transition-colors max-sm:text-xs">{player.nombre_completo}</p>
                          {player.posicion && <p className="text-xs text-slate-400 dark:text-slate-500 max-sm:text-[10px] truncate">{player.posicion}</p>}
                        </div>
                        {pago ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg max-sm:px-2 max-sm:py-0.5">
                              <Icon name="check" className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 max-sm:w-3 max-sm:h-3" />
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 max-sm:text-[10px]">{formatPeso(pago.monto)}</span>
                            </div>
                            {pago.comprobante_url && (
                              <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors max-sm:p-1">
                                <Icon name="eye" className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => onQuickPay(player)}
                            className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-slate-950 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs max-sm:text-[10px] font-bold transition-all flex-shrink-0 max-sm:px-2 max-sm:py-1">
                            <Icon name="plus" className="w-3 h-3" /> Registrar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: COMPRAS */}
          {tab === "compras" && (
            <div className="space-y-4">
              {!showCompraForm && (
                <button onClick={() => { setCompraForm({ ...COMPRA_FORM_VACIO }); setShowCompraForm(true); }}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm max-sm:px-3 max-sm:py-2 max-sm:text-xs max-sm:w-full max-sm:justify-center">
                  <Icon name="plus" className="w-4 h-4" /> Registrar egreso
                </button>
              )}
              {showCompraForm && (
                <div style={{ animation: "fadeIn .2s ease" }}
                  className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-5 max-sm:p-4 transition-colors duration-300">
                  <div className="flex items-center justify-between mb-4 max-sm:mb-3">
                    <p className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                      <Icon name="minus-circle" className="w-4 h-4" /> Nuevo egreso
                    </p>
                    <button type="button" onClick={() => setShowCompraForm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <Icon name="close" className="w-4 h-4" />
                    </button>
                  </div>
                  <form id="compra-form" onSubmit={handleSubmitCompra} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Descripción / Producto *</label>
                      <input type="text" className={iCls("producto")} placeholder="Ej: Balones de entrenamiento"
                        value={compraForm.producto} onChange={e => cambiarCompra("producto", e.target.value)} />
                      {compraErrors.producto && <p className="text-red-500 text-xs mt-1">{compraErrors.producto}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Monto Total (CLP) *</label>
                        <input type="number" className={iCls("monto")} placeholder="45000" min="1"
                          value={compraForm.monto} onChange={e => cambiarCompra("monto", e.target.value)} />
                        {compraErrors.monto && <p className="text-red-500 text-xs mt-1">{compraErrors.monto}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Fecha *</label>
                        <input type="date" className={iCls("fecha_compra")} value={compraForm.fecha_compra}
                          max={new Date().toISOString().split("T")[0]}
                          onChange={e => cambiarCompra("fecha_compra", e.target.value)} style={{ colorScheme: "dark" }} />
                        {compraErrors.fecha_compra && <p className="text-red-500 text-xs mt-1">{compraErrors.fecha_compra}</p>}
                      </div>
                    </div>
                    <div onClick={() => voucherRef.current?.click()}
                      className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 rounded-xl cursor-pointer group transition-colors">
                      {compraPreview
                        ? <img src={compraPreview} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 dark:group-hover:bg-red-500/10 transition-colors">
                            <Icon name="paperclip" className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                          </div>}
                      <p className="text-xs text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex-1 truncate max-sm:text-[10px]">
                        {compraPreview ? "✓ Voucher seleccionado" : "Adjuntar voucher de compra (opcional)"}
                      </p>
                    </div>
                    {compraErrors.voucher && <p className="text-red-500 text-xs max-sm:text-[10px]">{compraErrors.voucher}</p>}
                    <input ref={voucherRef} type="file" accept="image/*" className="hidden" onChange={handleVoucher} />
                    <div className="flex gap-2 pt-1 max-sm:flex-col-reverse">
                      <button type="button" onClick={() => setShowCompraForm(false)}
                        className="flex-1 py-2.5 max-sm:py-2.5 max-sm:w-full max-sm:text-xs max-sm:justify-center rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-semibold transition-colors">
                        Cancelar
                      </button>
                      <button type="submit" form="compra-form" disabled={savingCompra}
                        className="flex-1 flex items-center justify-center gap-2 max-sm:text-xs max-sm:py-2.5 max-sm:w-full max-sm:justify-center py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-bold transition-colors">
                        {savingCompra ? <><Icon name="spinner" className="w-4 h-4" /> Guardando...</> : <><Icon name="check" className="w-4 h-4" /> Registrar egreso</>}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {comprasTrimestre.length === 0 && !showCompraForm ? (
                <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl transition-colors">
                  <Icon name="receipt" className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 max-sm:w-6 max-sm:h-6 max-sm:mb-1.5" />
                  <p className="text-slate-400 dark:text-slate-500 text-sm max-sm:text-xs">Sin egresos registrados para {trimestre}</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
                  {comprasTrimestre.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-3 px-4 max-sm:px-3 py-3 max-sm:py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${i > 0 ? "border-t border-slate-100 dark:border-slate-800/60" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon name="arrow-down" className="w-4 h-4 text-red-600 dark:text-red-400 max-sm:w-3 max-sm:h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm max-sm:text-xs font-semibold text-slate-800 dark:text-white truncate transition-colors">{c.producto}</p>
                        <p className="text-xs max-sm:text-[10px] text-slate-400 dark:text-slate-500">{formatearFecha(c.fecha_compra)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-red-600 dark:text-red-400 max-sm:text-xs">{formatPeso(c.monto)}</span>
                        {c.comprobante_url && (
                          <a href={c.comprobante_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 max-sm:p-1 bg-slate-100 dark:bg-slate-700/60 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                            <Icon name="eye" className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3" />
                          </a>
                        )}
                        <button onClick={() => onDeleteCompra(c.id)}
                          className="p-1.5 max-sm:p-1 bg-slate-100 dark:bg-slate-700/60 hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                          <Icon name="trash" className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MOVIMIENTOS */}
          {tab === "movimientos" && (
            <div>
              {movimientos.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl transition-colors">
                  <Icon name="banknote" className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3 max-sm:w-8 max-sm:h-8 max-sm:mb-2.5" />
                  <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm max-sm:text-xs">Sin movimientos en {trimestre}</p>
                  <p className="text-slate-400 dark:text-slate-600 text-xs mt-1 max-sm:mt-0.5">Registra pagos o egresos para verlos aquí</p>
                </div>
              ) : (
                <div className="space-y-2 max-sm:space-y-1.5">
                  {movimientos.map(mov => (
                    <div key={mov.id}
                      className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 shadow-sm max-sm:p-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0                        ${mov.tipo === "ingreso" ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-red-100 dark:bg-red-500/20"} max-sm:w-8 max-sm:h-8`}>
                        <Icon name={mov.tipo === "ingreso" ? "arrow-up" : "arrow-down"}
                          className={`w-5 h-5 ${mov.tipo === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} max-sm:w-4 max-sm:h-4`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate transition-colors max-sm:text-xs max-sm:leading-tight">{mov.descripcion}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 max-sm:text-[10px] max-sm:mt-0">{formatearFecha(mov.fecha)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-sm font-bold ${mov.tipo === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} max-sm:text-xs max-sm:leading-none`}>
                          {mov.tipo === "ingreso" ? "+" : "-"}{formatPeso(mov.monto)}
                        </span>
                        {mov.url && (
                          <a href={mov.url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors max-sm:p-1 max-sm:rounded-md">
                            <Icon name="eye" className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [currentView, setCurrentView] = useState("plantel"); // "plantel" | "finanzas"
  const [isDarkMode, setIsDarkMode]   = useState(true);
  const [toast, setToast]             = useState(null);

  // Jugadores State
  const [players, setPlayers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [showForm, setShowForm]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [errors, setErrors]               = useState({});
  const [submitting, setSubmitting]       = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Imágenes State (3 archivos separados para el formulario)
  const [photoFiles, setPhotoFiles]       = useState({ perfil: null, frontal: null, trasero: null });
  const [photoPreviews, setPhotoPreviews] = useState({ perfil: null, frontal: null, trasero: null });

  // Finanzas State
  const [trimestre, setTrimestre]               = useState(getCurrentTrimestre());
  const [pagosTrimestre, setPagosTrimestre]     = useState([]);
  const [comprasTrimestre, setComprasTrimestre] = useState([]);
  const [loadingFinanzas, setLoadingFinanzas]   = useState(false);
  const [quickPayPlayer, setQuickPayPlayer]     = useState(null);
  
  // Pagos State (Modal Detalle Jugador)
  const [pagosJugadorModal, setPagosJugadorModal] = useState([]);
  const [loadingPagosModal, setLoadingPagosModal] = useState(false);

  // -- Utilidades --
  function mostrarToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // -- Fetch Data --
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("jugadores").select("*").order("created_at", { ascending: false });
    if (!error) setPlayers(data ?? []);
    else mostrarToast("Error al cargar jugadores", "error");
    setLoading(false);
  }, []);

  const fetchFinanzas = useCallback(async (periodo) => {
    setLoadingFinanzas(true);
    const [resPagos, resCompras] = await Promise.all([
      supabase.from("pagos").select("*").eq("periodo", periodo),
      supabase.from("compras").select("*").eq("trimestre_referencia", periodo)
    ]);
    if (!resPagos.error) setPagosTrimestre(resPagos.data ?? []);
    if (!resCompras.error) setComprasTrimestre(resCompras.data ?? []);
    setLoadingFinanzas(false);
  }, []);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { fetchFinanzas(trimestre); }, [trimestre, fetchFinanzas]);

  const fetchPagosJugador = useCallback(async (jugadorId) => {
    if (!jugadorId) { setPagosJugadorModal([]); return; }
    setLoadingPagosModal(true);
    const { data, error } = await supabase.from("pagos").select("*").eq("jugador_id", jugadorId).order("fecha_pago", { ascending: false });
    if (!error) setPagosJugadorModal(data ?? []);
    setLoadingPagosModal(false);
  }, []);

  useEffect(() => { fetchPagosJugador(viewingPlayer?.id); }, [viewingPlayer, fetchPagosJugador]);

  // -- CRUD Jugadores --
  function abrirNuevo() {
    setForm(FORM_VACIO); setEditingId(null); setErrors({});
    setPhotoFiles({ perfil: null, frontal: null, trasero: null });
    setPhotoPreviews({ perfil: null, frontal: null, trasero: null });
    setShowForm(true);
  }

  function abrirEdicion(p) {
    setForm({ ...p, altura_cm: p.altura_cm ?? "" }); setEditingId(p.id); setErrors({});
    setPhotoFiles({ perfil: null, frontal: null, trasero: null });
    setPhotoPreviews({
      perfil: p.foto_perfil_url || p.foto_url || null,
      frontal: p.carnet_frontal_url || null,
      trasero: p.carnet_trasero_url || null
    });
    setShowForm(true);
  }

  function cerrarForm() { setShowForm(false); }

  function handlePhotoChange(tipo, e) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        setErrors(p => ({ ...p, [`foto_${tipo}`]: "Máx. 5 MB" })); 
        return; 
      }
      setPhotoFiles(prev => ({ ...prev, [tipo]: file }));
      setPhotoPreviews(prev => ({ ...prev, [tipo]: URL.createObjectURL(file) }));
      setErrors(p => ({ ...p, [`foto_${tipo}`]: undefined, [`carnet_${tipo}`]: undefined }));
    }
  }

  function validarFormJugador() {
    const e = {};
    if (!form.nombre_completo.trim()) e.nombre_completo = "Requerido";
    if (!form.rut.trim() || !validarRUT(form.rut)) e.rut = "RUT inválido";
    if (!form.fecha_nacimiento) e.fecha_nacimiento = "Requerido";
    if (!form.direccion.trim()) e.direccion = "Requerido";
    if (!editingId && !photoFiles.perfil && !photoPreviews.perfil) e.foto_perfil = "Sube foto";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSaveJugador(e) {
    e.preventDefault();
    if (!validarFormJugador()) return;
    setSubmitting(true);
    try {
      const payload = { 
        nombre_completo: form.nombre_completo.trim(), 
        rut: form.rut.trim(), 
        fecha_nacimiento: form.fecha_nacimiento, 
        direccion: form.direccion.trim(),
        posicion: form.posicion || null, 
        telefono: form.telefono || null,
        email_personal: form.email_personal || null,
        altura_cm: form.altura_cm ? parseInt(form.altura_cm, 10) : null,
        foto_perfil_url: form.foto_perfil_url || form.foto_url || null,
        carnet_frontal_url: form.carnet_frontal_url || null,
        carnet_trasero_url: form.carnet_trasero_url || null,
      };

      const subidas = [];

      if (photoFiles.perfil) {
        subidas.push(uploadSingleImage(photoFiles.perfil, BUCKET_CARNETS, form.rut, "perfil")
          .then(url => payload.foto_perfil_url = url));
      }
      if (photoFiles.frontal) {
        subidas.push(uploadSingleImage(photoFiles.frontal, BUCKET_CARNETS, form.rut, "carnet_frontal")
          .then(url => payload.carnet_frontal_url = url));
      }
      if (photoFiles.trasero) {
        subidas.push(uploadSingleImage(photoFiles.trasero, BUCKET_CARNETS, form.rut, "carnet_trasero")
          .then(url => payload.carnet_trasero_url = url));
      }

      await Promise.all(subidas);

      if (payload.foto_url) payload.foto_url = null;

      if (editingId) {
        const { error } = await supabase.from("jugadores").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jugadores").insert([payload]);
        if (error) throw error;
      }

      await fetchPlayers();
      cerrarForm();
      mostrarToast(editingId ? "Actualizado" : "Agregado");
    } catch (err) { mostrarToast(err.message || "Error al guardar", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleDeleteJugador(player) {
    try {
      const cleanRut = player.rut.replace(/[.\s-]/g, "");
      const { data: listData } = await supabase.storage.from(BUCKET_CARNETS).list(cleanRut);
      
      if (listData && listData.length > 0) {
        await supabase.storage.from(BUCKET_CARNETS).remove(listData.map(f => `${cleanRut}/${f.name}`));
      }
      
      const { error } = await supabase.from("jugadores").delete().eq("id", player.id);
      if (error) throw error;
      setPlayers(prev => prev.filter(p => p.id !== player.id));
      mostrarToast("Jugador eliminado");
      setViewingPlayer(null);
    } catch { mostrarToast("Error al eliminar", "error"); }
    setDeleteConfirm(null);
  }

  // -- CRUD Finanzas --
  async function handleSavePago(jugadorId, pagoForm, file, profesionalName) {
    try {
      let comprobante_url = null;
      if (file) comprobante_url = await uploadSingleFile(file, BUCKET_COMPROBANTES, jugadorId, profesionalName);

      const payload = {
        jugador_id: jugadorId, periodo: pagoForm.periodo.trim(),
        monto: parseInt(pagoForm.monto, 10), fecha_pago: pagoForm.fecha_pago, comprobante_url,
      };

      const { error } = await supabase.from("pagos").insert([payload]);
      if (error) throw error;

      fetchFinanzas(trimestre);
      if (viewingPlayer && viewingPlayer.id === jugadorId) fetchPagosJugador(jugadorId);
      mostrarToast("Pago registrado");
      return true;
    } catch (err) { mostrarToast(err.message || "Error al registrar", "error"); return false; }
  }

  async function handleSaveCompra(compraData, file, profesionalName) {
    try {
      let comprobante_url = null;
      if (file) comprobante_url = await uploadSingleFile(file, BUCKET_COMPRAS, trimestre, profesionalName);

      const payload = {
        producto: compraData.producto.trim(), monto: parseInt(compraData.monto, 10),
        fecha_compra: compraData.fecha_compra, trimestre_referencia: compraData.trimestre_referencia,
        comprobante_url,
      };

      const { error } = await supabase.from("compras").insert([payload]);
      if (error) throw error;

      fetchFinanzas(trimestre);
      mostrarToast("Egreso registrado");
      return true;
    } catch (err) { mostrarToast(err.message || "Error al registrar", "error"); return false; }
  }

  async function handleDeleteCompra(id) {
    try {
      const { error } = await supabase.from("compras").delete().eq("id", id);
      if (error) throw error;
      fetchFinanzas(trimestre);
      mostrarToast("Egreso eliminado");
    } catch { mostrarToast("Error al eliminar", "error"); }
  }

  const jugadoresFiltrados = players.filter(p =>
    search.toLowerCase().split(" ").every(v => p.nombre_completo.toLowerCase().includes(v) || p.rut.toLowerCase().includes(v))
  );
  const promEdad = players.length ? Math.round(players.reduce((acc, p) => acc + (Number(calcularEdad(p.fecha_nacimiento)) || 0), 0) / players.length) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; transition: background 0.3s; }
        h1, h2, h3, h4, .font-display { font-family: 'Poppins', sans-serif; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(.98) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(.5) brightness(1.1); cursor: pointer; }
      `}</style>

      <div className={isDarkMode ? "dark" : ""}>
        <div className="min-h-screen bg-[#FDFDFE] dark:bg-[#030611] text-[#1F2937] dark:text-[#E5E7EB] transition-colors duration-500 pb-20 max-sm:pb-16 tracking-tight">
          
          <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#030611]/95 backdrop-blur-xl border-b border-[#E5E7EB] dark:border-[#1E293B] transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between h-auto sm:h-16 gap-3 py-3 sm:py-0 max-sm:py-2">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between max-sm:gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#1E40AF] flex items-center justify-center shadow-md">
                    <Icon name="volleyball" className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-display text-2xl font-extrabold text-[#000000] dark:text-white transition-colors tracking-tight max-sm:text-xl">
                    Club Voley Arica
                  </span>
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="sm:hidden p-2 rounded-xl bg-[#F3F4F6] dark:bg-[#0B1120] text-[#1E40AF]">
                  <Icon name={isDarkMode ? "sun" : "moon"} className="w-5 h-5" />
                </button>
              </div>

              {/* Main Nav Tabs - Sharp blue active */}
              <div className="flex bg-[#F3F4F6] dark:bg-[#0B1120] p-1 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] w-full sm:w-auto max-sm:p-0.5">
                {[
                  { key: "plantel", label: "Plantel", icon: "users" },
                  { key: "finanzas", label: "Finanzas", icon: "chart-bar" },
                ].map(view => (
                  <button key={view.key} onClick={() => setCurrentView(view.key)}
                    className={`flex-1 sm:flex-none flex items-center gap-1.5 px-6 max-sm:px-4 py-2 max-sm:py-1.5 rounded-lg text-sm font-bold transition-all duration-300 tracking-tight
                      ${currentView === view.key
                        ? "bg-[#1E40AF] text-white shadow-xl"
                        : "text-[#6B7280] hover:text-[#111827] dark:hover:text-white"}`}>
                    <Icon name={view.icon} className="w-4 h-4" />
                    {view.label}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl bg-[#F3F4F6] dark:bg-[#0B1120] text-[#1E40AF] hover:scale-105 transition-transform duration-200">
                  <Icon name={isDarkMode ? "sun" : "moon"} className="w-5 h-5" />
                </button>
                <button onClick={abrirNuevo} className="flex items-center gap-2 bg-[#1E40AF] hover:bg-[#1C3FAA] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-98 tracking-tight">
                  <Icon name="plus" className="w-4 h-4" /> Nuevo jugador
                </button>
              </div>
            </div>
          </header>

          {/* VISTA: PLANTEL - Crisp text, sharp accent */}
          {currentView === "plantel" && (
            <main style={{ animation: "fadeIn .35s ease" }} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 max-sm:py-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between max-sm:mb-5 max-sm:gap-3">
                <div className="flex gap-3 text-sm font-semibold flex-wrap w-full sm:w-auto max-sm:gap-2">
                  <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 rounded-xl text-[#6B7280] dark:text-[#9CA3AF] shadow-sm max-sm:px-3 max-sm:py-1.5 max-sm:text-xs">
                    Plantel: <span className="text-[#111827] dark:text-white font-bold">{players.length}</span>
                  </div>
                  <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 rounded-xl text-[#6B7280] dark:text-[#9CA3AF] shadow-sm max-sm:px-3 max-sm:py-1.5 max-sm:text-xs">
                    Edad prom.: <span className="text-[#111827] dark:text-white font-bold">{players.length ? `${promEdad} años` : "–"}</span>
                  </div>
                </div>
                <div className="relative w-full sm:w-80 shadow-md">
                  <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar RUT o nombre..."
                    className="w-full bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl pl-10 pr-4 py-3 text-sm focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/15 outline-none text-[#111827] dark:text-white transition-all" />
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Icon name="spinner" className="w-9 h-9 text-[#1E40AF]" /><p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Cargando plantel...</p>
                </div>
              ) : jugadoresFiltrados.length === 0 ? (
                <div className="text-center py-20 border border-[#E5E7EB] dark:border-[#1E293B] border-dashed rounded-3xl bg-white/50 dark:bg-[#0B1120]/30 shadow-inner">
                  <Icon name="users" className="w-12 h-12 text-[#E5E7EB] dark:text-[#1E293B] mx-auto mb-4" />
                  <p className="text-[#111827] dark:text-white font-bold mb-2 text-lg">{search ? "No se encontraron jugadores" : "El plantel está vacío"}</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl overflow-hidden shadow-xl transition-colors duration-300">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#E5E7EB] dark:border-[#1E293B] text-[10px] font-extrabold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider bg-[#F9FAFB] dark:bg-[#030611] max-sm:p-3 max-sm:gap-2 max-sm:hidden">
                    <div className="col-span-6 sm:col-span-5">Jugador</div>
                    <div className="hidden sm:block col-span-3">Contacto / RUT</div>
                    <div className="hidden sm:block col-span-2">Edad</div>
                    <div className="col-span-6 sm:col-span-2 text-right">Acciones</div>
                  </div>
                  <div className="divide-y divide-[#F3F4F6] dark:divide-[#1E293B]">
                    {jugadoresFiltrados.map((player) => (
                      <div key={player.id} onClick={() => setViewingPlayer(player)}
                        className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#F9FAFB] dark:hover:bg-[#030611] transition-colors cursor-pointer group max-sm:p-3 max-sm:gap-2">
                        <div className="col-span-6 sm:col-span-5 flex items-center gap-3.5 max-sm:gap-3">
                          <div className="w-11 h-11 rounded-full bg-[#F3F4F6] dark:bg-[#030611] overflow-hidden flex-shrink-0 shadow-md">
                            {(player.foto_perfil_url || player.foto_url) ? <img src={player.foto_perfil_url || player.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="user" className="w-5 h-5 text-[#9CA3AF]" /></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-[#111827] dark:text-white truncate group-hover:text-[#1E40AF] transition-colors duration-200 max-sm:text-xs">{player.nombre_completo}</p>
                            {player.posicion && <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate leading-tight max-sm:text-[10px]">{player.posicion}</p>}
                          </div>
                        </div>
                        <div className="hidden sm:block col-span-3 text-[#1F2937] dark:text-[#D1D5DB] font-mono text-sm max-sm:text-xs">
                          {player.rut}
                          {player.telefono && <p className="text-[10px] mt-0.5 font-sans text-[#1E40AF] dark:text-[#3B82F6] font-medium">{player.telefono}</p>}
                        </div>
                        <div className="hidden sm:block col-span-2 text-[#1F2937] dark:text-[#D1D5DB] text-sm max-sm:text-xs">{calcularEdad(player.fecha_nacimiento)} años</div>
                        <div className="col-span-6 sm:col-span-2 flex justify-end">
                          <button className="text-[#1E40AF] dark:text-[#3B82F6] hover:text-[#1C3FAA] dark:hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors duration-200 max-sm:text-xs max-sm:font-bold">
                            Ver Perfil →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </main>
          )}

          {/* VISTA: FINANZAS */}
          {currentView === "finanzas" && (
            <div style={{ animation: "fadeIn .35s ease" }}>
              <FinanceView
                players={players}
                trimestre={trimestre} setTrimestre={setTrimestre}
                pagosTrimestre={pagosTrimestre} comprasTrimestre={comprasTrimestre}
                loadingFinanzas={loadingFinanzas}
                onSavePago={handleSavePago} onSaveCompra={handleSaveCompra} onDeleteCompra={handleDeleteCompra}
                onQuickPay={setQuickPayPlayer}
              />
            </div>
          )}

          {/* Botón flotante Mobile */}
          {currentView === "plantel" && (
            <button onClick={abrirNuevo} className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#1E40AF] text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-transform active:scale-95">
              <Icon name="plus" className="w-6 h-6" />
            </button>
          )}

          <PlayerFormPanel show={showForm} editingId={editingId} form={form} setForm={setForm} errors={errors} setErrors={setErrors} previews={photoPreviews} onPhotoChange={handlePhotoChange} onSubmit={handleSaveJugador} onClose={cerrarForm} submitting={submitting} />
          <PlayerDetailsModal player={viewingPlayer} onClose={() => setViewingPlayer(null)} onEdit={abrirEdicion} onDelete={setDeleteConfirm} pagos={pagosJugadorModal} pagosLoading={loadingPagosModal} onSavePago={handleSavePago} />
          <QuickPayModal player={quickPayPlayer} trimestre={trimestre} onClose={() => setQuickPayPlayer(null)} onSave={handleSavePago} />
          <DeleteModal player={deleteConfirm} onConfirm={handleDeleteJugador} onCancel={() => setDeleteConfirm(null)} />
          <Toast toast={toast} />
        </div>
      </div>
    </>
  );
}