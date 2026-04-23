import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ═══════════════════════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════════════════════

function validarRUT(rut) {
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
  const resto = suma % 11;
  const dvEsperado = resto === 0 ? "0" : resto === 1 ? "K" : String(11 - resto);
  return dv === dvEsperado;
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "–";
  const hoy = new Date();
  const nac = new Date(fechaNacimiento + "T00:00:00");
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function formatearFecha(fecha) {
  if (!fecha) return "–";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function formatPeso(monto) {
  if (monto == null) return "–";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(monto);
}

const BUCKET_CARNETS      = "carnets";
const BUCKET_COMPROBANTES = "comprobantes";
const FORM_VACIO = { nombre_completo: "", rut: "", fecha_nacimiento: "", direccion: "", foto_url: "" };
const PAGO_FORM_VACIO = {
  periodo:    "",
  monto:      "10000",
  fecha_pago: new Date().toISOString().split("T")[0],
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
    plus:     <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />,
    edit:     <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />,
    trash:    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" />,
    close:    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
    user:     <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    check:    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />,
    warning:  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />,
    search:   <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    camera:   <><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    eye:      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    sun:      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />,
    moon:     <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
    banknote: <><rect x="2" y="7" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/><circle cx="12" cy="14" r="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    receipt:  <><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></>,
    paperclip:<path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />,
  };
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {paths[name]}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ animation: "slideUp .3s ease" }}
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold pointer-events-none ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
      <Icon name={toast.type === "error" ? "warning" : "check"} className="w-4 h-4 flex-shrink-0" />
      {toast.message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL ELIMINAR
// ═══════════════════════════════════════════════════════════════

function DeleteModal({ player, onConfirm, onCancel }) {
  if (!player) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div style={{ animation: "fadeIn .2s ease" }}
        className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 w-full max-w-sm shadow-2xl transition-colors duration-300">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-5">
          <Icon name="trash" className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">¿Eliminar jugador?</h3>
        <p className="text-slate-600 dark:text-slate-400 text-center text-sm mb-7">
          Se eliminará a <span className="font-semibold text-slate-900 dark:text-white">{player.nombre_completo}</span> y todos sus datos.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium transition-colors">Cancelar</button>
          <button onClick={() => onConfirm(player)} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors">Sí, eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SECCIÓN PAGOS (subcomponente del modal de detalles)
// ═══════════════════════════════════════════════════════════════

function PagosSection({ jugadorId, player, pagos, pagosLoading, onSavePago, onDownloadComprobante }) {
  const comprobanteRef = useRef(null);
  const [showForm, setShowForm]       = useState(false);
  const [pagoForm, setPagoForm]       = useState(PAGO_FORM_VACIO);
  const [pagoFile, setPagoFile]       = useState(null);
  const [pagoPreview, setPagoPreview] = useState(null);
  const [pagoErrors, setPagoErrors]   = useState({});
  const [saving, setSaving]           = useState(false);

  function abrirForm() {
    setPagoForm(PAGO_FORM_VACIO);
    setPagoFile(null); setPagoPreview(null); setPagoErrors({});
    setShowForm(true);
  }

  function cambiar(field, value) {
    setPagoForm((p) => ({ ...p, [field]: value }));
    setPagoErrors((p) => ({ ...p, [field]: undefined }));
  }

  function handleComprobanteChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPagoErrors((p) => ({ ...p, comprobante: "Solo imágenes (JPG, PNG, WebP)" }));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPagoErrors((p) => ({ ...p, comprobante: "Máximo 8 MB" }));
      return;
    }
    setPagoFile(file);
    setPagoPreview(URL.createObjectURL(file));
    setPagoErrors((p) => ({ ...p, comprobante: undefined }));
  }

  function validarPago() {
    const e = {};
    if (!pagoForm.periodo.trim()) e.periodo = "El período es requerido";
    const montoNum = parseInt(pagoForm.monto, 10);
    if (!pagoForm.monto || isNaN(montoNum) || montoNum <= 0) e.monto = "Ingresa un monto válido";
    if (!pagoForm.fecha_pago) e.fecha_pago = "La fecha es requerida";
    setPagoErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmitPago(e) {
    e.preventDefault();
    if (!validarPago()) return;
    setSaving(true);
    const ok = await onSavePago(jugadorId, pagoForm, pagoFile);
    setSaving(false);
    if (ok) { setShowForm(false); setPagoFile(null); setPagoPreview(null); }
  }

  const inputCls = (field) =>
    `w-full bg-slate-100 dark:bg-slate-800/80 border ${
      pagoErrors[field] ? "border-red-500" : "border-slate-300 dark:border-slate-700"
    } rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors duration-300`;

  return (
    <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300">

      {/* Encabezado de la sección */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="banknote" className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">
            Historial de pagos
          </p>
          {pagos.length > 0 && (
            <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {pagos.length}
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={abrirForm}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            Registrar mensualidad
          </button>
        )}
      </div>

      {/* Formulario inline colapsable */}
      {showForm && (
        <div style={{ animation: "fadeIn .2s ease" }}
          className="mb-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/25 rounded-2xl p-4 transition-colors duration-300">

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 transition-colors">
              <Icon name="receipt" className="w-4 h-4" /> Nueva mensualidad
            </p>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>

          <form id="pago-form" onSubmit={handleSubmitPago} className="space-y-3">

            {/* Período */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide transition-colors">
                Período / Trimestre *
              </label>
              <input type="text" className={inputCls("periodo")} placeholder="Ej: Marzo-Junio 2026"
                value={pagoForm.periodo} onChange={(e) => cambiar("periodo", e.target.value)} />
              {pagoErrors.periodo && <p className="text-red-500 text-xs mt-1">{pagoErrors.periodo}</p>}
            </div>

            {/* Monto + Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide transition-colors">
                  Monto (CLP) *
                </label>
                <input type="number" className={inputCls("monto")} placeholder="10000" min="1"
                  value={pagoForm.monto} onChange={(e) => cambiar("monto", e.target.value)} />
                {pagoErrors.monto && <p className="text-red-500 text-xs mt-1">{pagoErrors.monto}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide transition-colors">
                  Fecha de pago *
                </label>
                <input type="date" className={inputCls("fecha_pago")} value={pagoForm.fecha_pago}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => cambiar("fecha_pago", e.target.value)}
                  style={{ colorScheme: "dark" }} />
                {pagoErrors.fecha_pago && <p className="text-red-500 text-xs mt-1">{pagoErrors.fecha_pago}</p>}
              </div>
            </div>

            {/* Comprobante */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide transition-colors">
                Comprobante <span className="normal-case font-normal">(opcional)</span>
              </label>
              <div onClick={() => comprobanteRef.current?.click()}
                className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 cursor-pointer group transition-colors duration-300 ${
                  pagoErrors.comprobante ? "border-red-400" : "border-slate-300 dark:border-slate-700 hover:border-amber-500"}`}>
                {pagoPreview ? (
                  <>
                    <img src={pagoPreview} alt="Comprobante" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors">✓ Comprobante seleccionado</p>
                      <p className="text-xs text-slate-400 mt-0.5">Clic para cambiar</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/10 transition-colors">
                      <Icon name="paperclip" className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        Subir foto del voucher
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">JPG, PNG · máx. 8 MB</p>
                    </div>
                  </>
                )}
              </div>
              {pagoErrors.comprobante && <p className="text-red-500 text-xs mt-1">{pagoErrors.comprobante}</p>}
              <input ref={comprobanteRef} type="file" accept="image/*" className="hidden" onChange={handleComprobanteChange} />
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-xs font-semibold transition-colors">
                Cancelar
              </button>
              <button type="submit" form="pago-form" disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition-colors">
                {saving
                  ? <><Icon name="spinner" className="w-3.5 h-3.5" /> Guardando...</>
                  : <><Icon name="check" className="w-3.5 h-3.5" /> Confirmar pago</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de pagos */}
      {pagosLoading ? (
        <div className="flex items-center justify-center py-6 gap-2">
          <Icon name="spinner" className="w-5 h-5 text-amber-500" />
          <span className="text-xs text-slate-400">Cargando pagos…</span>
        </div>
      ) : pagos.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl transition-colors duration-300">
          <Icon name="banknote" className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-500 text-xs">Sin pagos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pagos.map((pago) => (
            <div key={pago.id} style={{ animation: "fadeIn .25s ease" }}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl gap-3 transition-colors duration-300">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate leading-tight transition-colors">
                  {pago.periodo}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-colors">
                    {formatPeso(pago.monto)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                    {formatearFecha(pago.fecha_pago)}
                  </span>
                </div>
              </div>
              {/* Acciones comprobante */}
              {pago.comprobante_url ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={pago.comprobante_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200 dark:border-sky-500/20 px-2.5 py-1 rounded-lg transition-colors"
                    title="Ver comprobante">
                    <Icon name="eye" className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ver</span>
                  </a>
                  <button onClick={() => onDownloadComprobante(pago, player)}
                    className="flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg transition-colors"
                    title="Descargar comprobante">
                    <Icon name="download" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-600 italic flex-shrink-0 transition-colors">
                  Sin voucher
                </span>
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

function PlayerDetailsModal({ player, onClose, onEdit, onDelete, onDownload, pagos, pagosLoading, onSavePago, onDownloadComprobante }) {
  if (!player) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-colors duration-300" onClick={onClose} />
      <div style={{ animation: "fadeIn .2s ease" }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">

        {/* Cabecera */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 transition-colors duration-300 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 transition-colors">
            <Icon name="user" className="w-5 h-5 text-amber-500" />
            Detalle del jugador
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
            <Icon name="close" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          {/* Foto */}
          <div className="w-full h-56 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6 overflow-hidden border border-slate-200 dark:border-slate-700 transition-colors duration-300">
            {player.foto_url
              ? <img src={player.foto_url} alt={player.nombre_completo} className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600"><Icon name="camera" className="w-12 h-12 mb-2"/><span className="text-sm">Sin foto</span></div>}
          </div>

          {/* Datos personales */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre completo</p>
              <p className="text-slate-900 dark:text-white font-bold text-xl transition-colors duration-300">{player.nombre_completo}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors duration-300">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">RUT</p>
                <p className="text-amber-600 dark:text-amber-400 font-mono text-sm">{player.rut}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 transition-colors duration-300">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Edad</p>
                <p className="text-slate-900 dark:text-white text-sm font-semibold transition-colors duration-300">{calcularEdad(player.fecha_nacimiento)} años</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Fecha de nacimiento</p>
              <p className="text-slate-800 dark:text-white text-sm transition-colors duration-300">{formatearFecha(player.fecha_nacimiento)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dirección</p>
              <p className="text-slate-800 dark:text-white text-sm transition-colors duration-300">{player.direccion}</p>
            </div>
          </div>

          {/* Sección pagos */}
          <PagosSection jugadorId={player.id} player={player} pagos={pagos} pagosLoading={pagosLoading} onSavePago={onSavePago} onDownloadComprobante={onDownloadComprobante} />
        </div>

        {/* Botones de acción */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/50 transition-colors duration-300 flex-shrink-0">
          <button onClick={() => { onClose(); onEdit(player); }}
            className="flex flex-col items-center justify-center py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-white text-xs font-semibold transition-colors">
            <Icon name="edit" className="w-4 h-4 mb-1 text-slate-500 dark:text-slate-400" /> Editar
          </button>
          {player.foto_url ? (
            <button onClick={() => onDownload(player)}
              className="flex flex-col items-center justify-center py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-sky-600 dark:text-sky-400 text-xs font-semibold transition-colors">
              <Icon name="download" className="w-4 h-4 mb-1" /> Descargar
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 opacity-50 rounded-xl text-slate-400 text-xs font-semibold cursor-not-allowed transition-colors duration-300">
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
//  PANEL FORMULARIO JUGADOR
// ═══════════════════════════════════════════════════════════════

function PlayerFormPanel({ show, editingId, form, setForm, errors, setErrors, photoPreview, onPhotoChange, onSubmit, onClose, submitting }) {
  const fileRef = useRef(null);
  const inputCls = (field) =>
    `w-full bg-slate-50 dark:bg-slate-900 border ${errors[field] ? "border-red-500" : "border-slate-300 dark:border-slate-700"} rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors duration-300`;
  const cambiar = (field, value) => { setForm((p) => ({ ...p, [field]: value })); setErrors((p) => ({ ...p, [field]: undefined })); };
  const rutOk = form.rut.length >= 8 && validarRUT(form.rut);

  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/40 dark:bg-black/65 backdrop-blur-sm transition-all duration-300 ${show ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
      <aside className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${show ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <h2 className="text-base font-bold text-slate-900 dark:text-white transition-colors duration-300">
            {editingId ? "Editar jugador" : "Agregar jugador"}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <Icon name="close" />
          </button>
        </div>
        <form id="jugador-form" onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5" style={{ scrollbarWidth: "thin" }}>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileRef.current?.click()}
              className={`relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed flex-shrink-0 group ${errors.foto ? "border-red-500" : "border-slate-300 dark:border-slate-600 hover:border-amber-500"} transition-colors duration-300`}>
              {photoPreview
                ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/60"><Icon name="camera" className="w-6 h-6 text-slate-400 dark:text-slate-500" /></div>}
            </button>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-semibold text-amber-600 dark:text-amber-400 transition-colors">Seleccionar imagen</button>
              <p className="text-xs text-slate-500 dark:text-slate-600 mt-1 transition-colors">JPG, PNG o WebP · máx. 5 MB</p>
              {errors.foto && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{errors.foto}</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 transition-colors">NOMBRE COMPLETO *</label>
            <input type="text" className={inputCls("nombre_completo")} value={form.nombre_completo} onChange={(e) => cambiar("nombre_completo", e.target.value)} />
            {errors.nombre_completo && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.nombre_completo}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 transition-colors">RUT *</label>
            <input type="text" className={inputCls("rut")} value={form.rut} maxLength={12} onChange={(e) => cambiar("rut", e.target.value.replace(/[^0-9kK.-]/g, ""))} />
            {errors.rut ? <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.rut}</p> : rutOk && <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">✓ RUT válido</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 transition-colors">FECHA DE NACIMIENTO *</label>
            <input type="date" className={inputCls("fecha_nacimiento")} value={form.fecha_nacimiento} max={new Date().toISOString().split("T")[0]} onChange={(e) => cambiar("fecha_nacimiento", e.target.value)} style={{ colorScheme: "dark" }} />
            {errors.fecha_nacimiento && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.fecha_nacimiento}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 transition-colors">DIRECCIÓN *</label>
            <input type="text" className={inputCls("direccion")} value={form.direccion} onChange={(e) => cambiar("direccion", e.target.value)} />
            {errors.direccion && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.direccion}</p>}
          </div>
        </form>
        <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <button type="submit" form="jugador-form" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? <><Icon name="spinner" className="w-4 h-4" /> Guardando...</> : <><Icon name="check" className="w-4 h-4" /> {editingId ? "Guardar cambios" : "Agregar jugador"}</>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function App() {
  // ── Jugadores ───────────────────────────────────────────────
  const [players, setPlayers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [isDarkMode, setIsDarkMode]       = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingId, setEditingId]         = useState(null);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [photoFile, setPhotoFile]         = useState(null);
  const [photoPreview, setPhotoPreview]   = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState({});
  const [toast, setToast]                 = useState(null);
  const [search, setSearch]               = useState("");

  // ── Pagos ────────────────────────────────────────────────────
  const [pagos, setPagos]               = useState([]);
  const [pagosLoading, setPagosLoading] = useState(false);

  // ── Toast ────────────────────────────────────────────────────
  function mostrarToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Fetch jugadores ──────────────────────────────────────────
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("jugadores").select("*").order("created_at", { ascending: false });
    if (!error) setPlayers(data ?? []);
    else mostrarToast("Error al cargar los jugadores", "error");
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  // ── Fetch pagos (se dispara al abrir el modal de un jugador) ─
  const fetchPagos = useCallback(async (jugadorId) => {
    if (!jugadorId) { setPagos([]); return; }
    setPagosLoading(true);
    const { data, error } = await supabase
      .from("pagos")
      .select("*")
      .eq("jugador_id", jugadorId)
      .order("fecha_pago", { ascending: false });
    if (!error) setPagos(data ?? []);
    else mostrarToast("Error al cargar los pagos", "error");
    setPagosLoading(false);
  }, []);

  useEffect(() => {
    fetchPagos(viewingPlayer?.id ?? null);
  }, [viewingPlayer, fetchPagos]);

  // ── Guardar pago ─────────────────────────────────────────────
  async function handleSavePago(jugadorId, pagoForm, pagoFile) {
    try {
      let comprobante_url = null;

      if (pagoFile) {
        const ext  = pagoFile.name.split(".").pop().toLowerCase();
        const path = `${jugadorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_COMPROBANTES)
          .upload(path, pagoFile, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET_COMPROBANTES).getPublicUrl(path);
        comprobante_url = urlData.publicUrl;
      }

      const payload = {
        jugador_id:     jugadorId,
        periodo:        pagoForm.periodo.trim(),
        monto:          parseInt(pagoForm.monto, 10),
        fecha_pago:     pagoForm.fecha_pago,
        comprobante_url,
      };

      const { error } = await supabase.from("pagos").insert([payload]);
      if (error) throw error;

      await fetchPagos(jugadorId);
      mostrarToast("Pago registrado correctamente");
      return true;
    } catch (err) {
      mostrarToast(err.message ?? "Error al registrar el pago", "error");
      return false;
    }
  }
  
  // ── Descargar Comprobante (Fuerza descarga del archivo) ──────
  async function handleDownloadComprobante(pago, player) {
    try {
      mostrarToast("Iniciando descarga...");
      const res = await fetch(pago.comprobante_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Voucher_${player.nombre_completo.replace(/\s+/g, "_")}_${pago.periodo.replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { window.open(pago.comprobante_url, "_blank"); }
  }

  // ── CRUD jugadores (sin cambios respecto a V1) ───────────────
  function validar() {
    const e = {};
    if (!form.nombre_completo.trim()) e.nombre_completo = "El nombre es requerido";
    if (!form.rut.trim()) e.rut = "El RUT es requerido";
    else if (!validarRUT(form.rut)) e.rut = "El RUT no es válido";
    if (!form.fecha_nacimiento) e.fecha_nacimiento = "La fecha es requerida";
    if (!form.direccion.trim()) e.direccion = "La dirección es requerida";
    if (!editingId && !photoFile) e.foto = "Selecciona una foto";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function subirFoto(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_CARNETS).upload(nombre, file);
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET_CARNETS).getPublicUrl(nombre);
    return data.publicUrl;
  }

  async function eliminarFotoStorage(url) {
    try {
      const partes = url.split(`/${BUCKET_CARNETS}/`);
      if (partes.length < 2) return;
      await supabase.storage.from(BUCKET_CARNETS).remove([partes[1].split("?")[0]]);
    } catch { console.warn("No se pudo eliminar la foto"); }
  }

  async function handleDownloadFoto(player) {
    try {
      mostrarToast("Iniciando descarga...");
      const res = await fetch(player.foto_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Carnet_${player.nombre_completo.replace(/\s+/g, "_")}.jpg`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { window.open(player.foto_url, "_blank"); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validar()) return;
    setSubmitting(true);
    try {
      let foto_url = form.foto_url;
      if (photoFile) {
        if (editingId && form.foto_url) await eliminarFotoStorage(form.foto_url);
        foto_url = await subirFoto(photoFile);
      }
      const payload = { nombre_completo: form.nombre_completo.trim(), rut: form.rut.trim(), fecha_nacimiento: form.fecha_nacimiento, direccion: form.direccion.trim(), foto_url };
      if (editingId) { const { error } = await supabase.from("jugadores").update(payload).eq("id", editingId); if (error) throw error; }
      else { const { error } = await supabase.from("jugadores").insert([payload]); if (error) throw error; }
      await fetchPlayers();
      cerrarForm();
      mostrarToast(editingId ? "Jugador actualizado" : "Jugador agregado");
    } catch (err) { mostrarToast(err.message ?? "Error al guardar", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(player) {
    try {
      if (player.foto_url) await eliminarFotoStorage(player.foto_url);
      const { error } = await supabase.from("jugadores").delete().eq("id", player.id);
      if (error) throw error;
      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
      mostrarToast("Jugador eliminado");
      setViewingPlayer(null);
    } catch { mostrarToast("Error al eliminar", "error"); }
    setDeleteConfirm(null);
  }

  function abrirNuevo() { setForm(FORM_VACIO); setPhotoFile(null); setPhotoPreview(null); setEditingId(null); setErrors({}); setShowForm(true); }
  function abrirEdicion(player) { setForm({ ...player, foto_url: player.foto_url ?? "" }); setPhotoFile(null); setPhotoPreview(player.foto_url ?? null); setEditingId(player.id); setErrors({}); setShowForm(true); }
  function cerrarForm() { setShowForm(false); setForm(FORM_VACIO); setPhotoFile(null); setPhotoPreview(null); setEditingId(null); setErrors({}); }
  function handlePhotoChange(e) { const file = e.target.files?.[0]; if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); setErrors((p) => ({ ...p, foto: undefined })); } }

  const jugadoresFiltrados = players.filter((p) =>
    search.toLowerCase().split(" ").every((v) => p.nombre_completo.toLowerCase().includes(v) || p.rut.toLowerCase().includes(v))
  );
  const promEdad = players.length
    ? Math.round(players.reduce((acc, p) => acc + (Number(calcularEdad(p.fecha_nacimiento)) || 0), 0) / players.length)
    : 0;

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .font-display { font-family: 'Bebas Neue', sans-serif; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(.55) brightness(1.2); cursor: pointer; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      <div className={isDarkMode ? "dark" : ""}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-500">

          {/* HEADER */}
          <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/70 transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
                  <Icon name="volleyball" className="w-5 h-5 text-slate-950" />
                </div>
                <span className="font-display text-2xl tracking-wide text-slate-900 dark:text-white transition-colors duration-300">
                  Club Voley <span className="text-amber-500">Arica</span>
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-300"
                  title="Cambiar tema">
                  <Icon name={isDarkMode ? "sun" : "moon"} className="w-5 h-5" />
                </button>
                <button onClick={abrirNuevo} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm px-4 py-2 rounded-xl shadow-sm transition-all">
                  <Icon name="plus" className="w-4 h-4" />
                  <span className="hidden sm:inline">Nuevo jugador</span>
                  <span className="sm:hidden">Nuevo</span>
                </button>
              </div>
            </div>
          </header>

          {/* MAIN */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
              <div className="flex gap-3 text-sm font-semibold flex-wrap">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm transition-colors duration-300">
                  Jugadores: <span className="text-amber-600 dark:text-amber-400">{players.length}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm transition-colors duration-300">
                  Edad prom.: <span className="text-sky-600 dark:text-sky-400">{players.length ? `${promEdad} años` : "–"}</span>
                </div>
              </div>
              <div className="relative w-full sm:w-80 shadow-sm">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar RUT o nombre..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-colors duration-300 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Icon name="spinner" className="w-8 h-8 text-amber-500 mb-2" /><p className="text-slate-500">Cargando...</p>
              </div>
            ) : jugadoresFiltrados.length === 0 ? (
              <div className="text-center py-20 border border-slate-300 dark:border-slate-800 border-dashed rounded-3xl bg-white/50 dark:bg-slate-900/30 transition-colors duration-300">
                <Icon name="user" className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-semibold mb-2">{search ? "No se encontraron jugadores" : "El plantel está vacío"}</p>
                {!search && <button onClick={abrirNuevo} className="mt-2 text-amber-600 dark:text-amber-400 text-sm font-semibold hover:underline">Agregar el primer jugador →</button>}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950/50 transition-colors duration-300">
                  <div className="col-span-5 sm:col-span-4">Jugador</div>
                  <div className="col-span-3">RUT</div>
                  <div className="hidden sm:block col-span-2">Edad</div>
                  <div className="col-span-4 sm:col-span-3 text-right">Acciones</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 transition-colors duration-300">
                  {jugadoresFiltrados.map((player) => (
                    <div key={player.id} onClick={() => setViewingPlayer(player)}
                      className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group">
                      <div className="col-span-5 sm:col-span-4 font-bold text-slate-800 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {player.nombre_completo}
                      </div>
                      <div className="col-span-3 text-slate-500 dark:text-slate-400 font-mono text-sm transition-colors">{player.rut}</div>
                      <div className="hidden sm:block col-span-2 text-slate-500 dark:text-slate-400 text-sm transition-colors">{calcularEdad(player.fecha_nacimiento)} años</div>
                      <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setViewingPlayer(player); }}
                          className="hidden sm:flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 px-2 py-1 rounded-lg transition-colors"
                          title="Ver pagos">
                          <Icon name="banknote" className="w-3.5 h-3.5" /> Pagos
                        </button>
                        <button className="text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 text-sm font-semibold flex items-center gap-1 transition-colors">
                          <Icon name="eye" className="w-4 h-4 hidden sm:inline" /> Ver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>

          <PlayerFormPanel show={showForm} editingId={editingId} form={form} setForm={setForm} errors={errors} setErrors={setErrors} photoPreview={photoPreview} onPhotoChange={handlePhotoChange} onSubmit={handleSubmit} onClose={cerrarForm} submitting={submitting} />
          <PlayerDetailsModal player={viewingPlayer} onClose={() => setViewingPlayer(null)} onEdit={abrirEdicion} onDelete={setDeleteConfirm} onDownload={handleDownloadFoto} pagos={pagos} pagosLoading={pagosLoading} onSavePago={handleSavePago} onDownloadComprobante={handleDownloadComprobante} />
          <DeleteModal player={deleteConfirm} onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} />
          <Toast toast={toast} />
        </div>
      </div>
    </>
  );
}