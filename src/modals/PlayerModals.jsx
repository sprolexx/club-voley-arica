import { useState, useRef } from "react";
import { Icon } from "../components/Icon";
import { validarRUT, calcularEdad, formatearFecha, formatPeso, descargarImagen, getCurrentTrimestre, POSICIONES, ESTADOS, PAGO_FORM_VACIO } from "../utils/helpers";

function ImageUploadField({ label, preview, onChange, error, hint = "Seleccionar imagen", compact = false }) {
  const ref = useRef(null);
  const h = compact ? "h-24" : "h-36";
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</label>}
      <div onClick={() => ref.current?.click()} className={`relative w-full ${h} rounded-xl overflow-hidden border-2 border-dashed cursor-pointer group ${error ? "border-red-500" : "border-slate-300 dark:border-slate-700 hover:border-[#1E40AF]"}`}>
        {preview ? (
          <><img src={preview} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Icon name="camera" className="w-6 h-6 text-white" /></div></>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50"><Icon name="camera" className="w-5 h-5 text-slate-400 group-hover:text-[#1E40AF]" /><span className="text-xs text-slate-400 group-hover:text-[#1E40AF] text-center px-2">{hint}</span></div>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}

function PagosSection({ jugadorId, playerName, pagos = [], pagosLoading, onSavePago }) {
  const comprobanteRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [pagoForm, setPagoForm] = useState(PAGO_FORM_VACIO);
  const [pagoFile, setPagoFile] = useState(null);
  const [pagoPreview, setPagoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pagoForm.periodo.trim() || !pagoForm.monto || !pagoForm.fecha_pago) return;
    setSaving(true);
    const nombreDescarga = `Voucher_${playerName || 'Jugador'}_${pagoForm.periodo}.jpg`;
    const ok = await onSavePago(jugadorId, pagoForm, pagoFile, nombreDescarga);
    setSaving(false);
    if (ok) { setShowForm(false); setPagoFile(null); setPagoPreview(null); }
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Icon name="banknote" className="w-4 h-4 text-[#1E40AF]" /><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Historial de pagos</p></div>
        {!showForm && <button onClick={() => {setPagoForm({ ...PAGO_FORM_VACIO, periodo: getCurrentTrimestre() }); setShowForm(true);}} className="flex items-center gap-1.5 bg-[#1E40AF] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#1C3FAA]"><Icon name="plus" className="w-3.5 h-3.5" /> Registrar pago</button>}
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 bg-[#EFF6FF] dark:bg-[#1E3A8A]/10 border border-[#BFDBFE] dark:border-[#1E3A8A] rounded-2xl p-4 space-y-3">
           <div className="flex justify-between items-center"><p className="text-sm font-bold text-[#1E40AF] dark:text-[#60A5FA] flex items-center gap-1.5"><Icon name="receipt" className="w-4 h-4" /> Nuevo pago</p><button type="button" onClick={()=>setShowForm(false)} className="text-slate-400"><Icon name="close" className="w-4 h-4"/></button></div>
           <input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none" placeholder="Período" value={pagoForm.periodo} onChange={e=>setPagoForm({...pagoForm, periodo: e.target.value})} required/>
           <div className="grid grid-cols-2 gap-3">
             <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none" placeholder="Monto" value={pagoForm.monto} onChange={e=>setPagoForm({...pagoForm, monto: e.target.value})} required/>
             <input type="date" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none" style={{colorScheme: 'dark'}} value={pagoForm.fecha_pago} onChange={e=>setPagoForm({...pagoForm, fecha_pago: e.target.value})} required/>
           </div>
           <div onClick={()=>comprobanteRef.current?.click()} className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer">
              {pagoPreview ? <img src={pagoPreview} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center"><Icon name="paperclip" className="w-4 h-4 text-slate-400"/></div>}
              <p className="text-xs text-slate-500">{pagoPreview ? "Comprobante listo" : "Adjuntar voucher (opcional)"}</p>
           </div>
           <input ref={comprobanteRef} type="file" accept="image/*" className="hidden" onChange={e => {if(e.target.files[0]) {setPagoFile(e.target.files[0]); setPagoPreview(URL.createObjectURL(e.target.files[0]))}}} />
           <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-[#1E40AF] hover:bg-[#1C3FAA] text-white text-xs font-bold">{saving ? "Guardando..." : "Confirmar"}</button>
        </form>
      )}
      {pagosLoading ? <p className="text-xs text-slate-400 text-center py-4">Cargando...</p> : pagos.length === 0 ? <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Sin pagos</p> : (
        <div className="space-y-2">
          {pagos.map(p => (
            <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div><p className="text-sm font-bold dark:text-white">{p.periodo}</p><p className="text-xs text-slate-500">{formatPeso(p.monto)} • {formatearFecha(p.fecha_pago)}</p></div>
              {p.comprobante_url && (
                <div className="flex gap-1.5">
                  <a href={p.comprobante_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 rounded-lg"><Icon name="eye" className="w-3.5 h-3.5"/></a>
                  <button onClick={()=>descargarImagen(p.comprobante_url, `Voucher_${playerName}_${p.periodo}.jpg`)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg"><Icon name="download" className="w-3.5 h-3.5"/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerDetailsModal({ player, onClose, onEdit, onDelete, pagos, pagosLoading, onSavePago }) {
  if (!player) return null;
  const fotoPerfil = player.foto_perfil_url || player.foto_url || null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div style={{ animation: "fadeIn .2s ease" }} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex-shrink-0">
          <h3 className="text-base font-bold dark:text-white flex items-center gap-2"><Icon name="user" className="w-4 h-4 text-[#1E40AF]" /> Detalle del jugador</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><Icon name="close" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6" style={{ scrollbarWidth: "thin" }}>
          <div className="w-full h-52 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-5">
            {fotoPerfil ? <img src={fotoPerfil} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-slate-400"><Icon name="camera" className="w-10 h-10" /></div>}
          </div>
          <div className="space-y-4 mb-5">
            <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nombre completo</p><p className="dark:text-white font-bold text-xl">{player.nombre_completo}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700"><p className="text-xs font-bold text-slate-500 uppercase mb-0.5">RUT</p><p className="text-[#1E40AF] dark:text-[#60A5FA] font-mono text-sm">{player.rut}</p></div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700"><p className="text-xs font-bold text-slate-500 uppercase mb-0.5">Edad</p><p className="dark:text-white font-semibold text-sm">{calcularEdad(player.fecha_nacimiento)} años</p></div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700"><p className="text-xs font-bold text-slate-500 uppercase mb-0.5">Posición</p><p className="dark:text-white font-semibold text-sm">{player.posicion || "–"}</p></div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700"><p className="text-xs font-bold text-slate-500 uppercase mb-0.5">Altura</p><p className="dark:text-white font-semibold text-sm">{player.altura_cm ? `${player.altura_cm} cm` : "–"}</p></div>
            </div>
            <div><p className="text-xs font-bold text-slate-500 uppercase mb-0.5">Dirección</p><p className="dark:text-white text-sm">{player.direccion}</p></div>
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {player.telefono && <a href={`tel:${player.telefono}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><Icon name="phone" className="w-4 h-4 text-slate-400" />{player.telefono}</a>}
              {player.email_personal && <a href={`mailto:${player.email_personal}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><Icon name="mail" className="w-4 h-4 text-slate-400" />{player.email_personal}</a>}
            </div>
          </div>
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3"><Icon name="id-card" className="w-4 h-4 text-[#1E40AF]" /><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documentación</p></div>
            <div className="grid grid-cols-2 gap-3">
              {[{ l: "Frontal", u: player.carnet_frontal_url, s: "frontal" }, { l: "Trasero", u: player.carnet_trasero_url, s: "trasero" }].map(c => (
                <div key={c.s}><p className="text-xs font-bold text-slate-500 mb-1.5">{c.l}</p>
                  {c.u ? <><div className="h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-1.5"><img src={c.u} className="w-full h-full object-cover"/></div>
                  <div className="flex gap-1.5"><a href={c.u} target="_blank" rel="noopener noreferrer" className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-xs font-bold">Ver</a><button onClick={()=>descargarImagen(c.u, `${player.nombre_completo}_carnet_${c.s}.jpg`)} className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold">Bajar</button></div></>
                  : <div className="h-24 border border-dashed rounded-xl flex items-center justify-center border-slate-200 dark:border-slate-800"><p className="text-xs text-slate-400">Sin imagen</p></div>}
                </div>
              ))}
            </div>
          </div>
          <PagosSection jugadorId={player.id} playerName={player.nombre_completo} pagos={pagos} pagosLoading={pagosLoading} onSavePago={onSavePago} />
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 flex-shrink-0">
          <button onClick={()=>{onClose(); onEdit(player)}} className="py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white flex flex-col items-center"><Icon name="edit" className="w-4 h-4 mb-1" /> Editar</button>
          {fotoPerfil ? <button onClick={()=>descargarImagen(fotoPerfil, `Perfil_${player.nombre_completo}.jpg`)} className="py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#1E40AF] dark:text-[#60A5FA] flex flex-col items-center"><Icon name="download" className="w-4 h-4 mb-1" /> Bajar Perfil</button> : <div className="py-2.5 opacity-40 border border-dashed rounded-xl text-xs font-bold flex flex-col items-center text-slate-500"><Icon name="download" className="w-4 h-4 mb-1" /> Sin foto</div>}
          <button onClick={()=>{onClose(); onDelete(player)}} className="py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 flex flex-col items-center"><Icon name="trash" className="w-4 h-4 mb-1" /> Desactivar</button>
        </div>
      </div>
    </div>
  );
}

export function PlayerFormPanel({ show, editingId, form, setForm, errors, setErrors, previews, onPhotoChange, onSubmit, onClose, submitting }) {
  const iCls = (f) => `w-full bg-slate-50 dark:bg-slate-900 border ${errors[f] ? "border-red-500" : "border-slate-300 dark:border-slate-700"} rounded-xl px-4 py-3 text-sm dark:text-white focus:outline-none focus:border-[#1E40AF]`;
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/65 backdrop-blur-sm transition-opacity ${show?"opacity-100":"opacity-0 pointer-events-none"}`} />
      <aside className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ${show?"translate-x-0":"translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800"><h2 className="font-bold dark:text-white">{editingId ? "Editar jugador" : "Agregar jugador"}</h2><button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><Icon name="close" /></button></div>
        <form id="j-form" onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6" style={{scrollbarWidth:"thin"}}>
          <div><p className="text-xs font-bold text-slate-500 mb-3"><span className="bg-[#1E40AF] text-white px-2 py-0.5 rounded-full mr-2">1</span> FOTO DE PERFIL *</p> <ImageUploadField preview={previews.perfil} onChange={e=>onPhotoChange("perfil", e)} error={errors.foto_perfil} /></div>
          <div><p className="text-xs font-bold text-slate-500 mb-3"><span className="bg-[#1E40AF] text-white px-2 py-0.5 rounded-full mr-2">2</span> CARNET DE IDENTIDAD</p>
            <div className="grid grid-cols-2 gap-3"><ImageUploadField label="Frontal" preview={previews.frontal} onChange={e=>onPhotoChange("frontal", e)} compact/><ImageUploadField label="Trasero" preview={previews.trasero} onChange={e=>onPhotoChange("trasero", e)} compact/></div>
          </div>
          <div className="space-y-4"><p className="text-xs font-bold text-slate-500"><span className="bg-[#1E40AF] text-white px-2 py-0.5 rounded-full mr-2">3</span> DATOS PERSONALES</p>
            <input className={iCls("nombre_completo")} placeholder="Nombre completo *" value={form.nombre_completo} onChange={e=>{setForm(p=>({...p, nombre_completo: e.target.value})); setErrors(p=>({...p, nombre_completo: undefined}))}} />
            <div className="grid grid-cols-2 gap-3"><input className={iCls("rut")} placeholder="RUT *" value={form.rut} onChange={e=>{setForm(p=>({...p, rut: e.target.value.replace(/[^0-9kK.-]/g, "")})); setErrors(p=>({...p, rut: undefined}))}} /><input type="date" className={iCls("fecha_nacimiento")} value={form.fecha_nacimiento} onChange={e=>setForm(p=>({...p, fecha_nacimiento: e.target.value}))} style={{colorScheme:"dark"}}/></div>
            <div className="grid grid-cols-3 gap-3">
              <select className={iCls("posicion")} value={form.posicion} onChange={e=>setForm(p=>({...p, posicion: e.target.value}))}><option value="">Posición</option>{POSICIONES.map(p=><option key={p} value={p}>{p}</option>)}</select>
              <input type="number" className={iCls("altura_cm")} placeholder="Altura cm" value={form.altura_cm} onChange={e=>setForm(p=>({...p, altura_cm: e.target.value}))} />
              <select className={iCls("estado")} value={form.estado} onChange={e=>setForm(p=>({...p, estado: e.target.value}))}>{ESTADOS.map(es=><option key={es} value={es}>{es.toUpperCase()}</option>)}</select>
            </div>
          </div>
          <div className="space-y-4"><p className="text-xs font-bold text-slate-500"><span className="bg-[#1E40AF] text-white px-2 py-0.5 rounded-full mr-2">4</span> CONTACTO</p>
            <input className={iCls("direccion")} placeholder="Dirección *" value={form.direccion} onChange={e=>setForm(p=>({...p, direccion: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3"><input className={iCls("telefono")} placeholder="Teléfono" value={form.telefono} onChange={e=>setForm(p=>({...p, telefono: e.target.value}))} /><input type="email" className={iCls("email_personal")} placeholder="Email" value={form.email_personal} onChange={e=>setForm(p=>({...p, email_personal: e.target.value}))} /></div>
          </div>
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800"><button type="submit" form="j-form" disabled={submitting} className="w-full py-3.5 bg-[#1E40AF] text-white font-bold rounded-xl">{submitting ? "Guardando..." : (editingId ? "Guardar cambios" : "Agregar jugador")}</button></div>
      </aside>
    </>
  );
}

export function QuickPayModal({ player, trimestre, onSave, onClose }) {
  const [form, setForm] = useState({ ...PAGO_FORM_VACIO, periodo: trimestre });
  const [file, setFile] = useState(null), [preview, setPreview] = useState(null), [saving, setSaving] = useState(false);
  const ref = useRef(null);
  
  if (!player) return null;
  
  async function handleSubmit(e) {
    e.preventDefault(); 
    if(!form.periodo || !form.monto || !form.fecha_pago) return;
    setSaving(true);
    const nombreDescarga = `Voucher_${player.nombre_completo || 'Jugador'}_${form.periodo}.jpg`;
    const ok = await onSave(player.id, form, file, nombreDescarga);
    setSaving(false); 
    if(ok) onClose();
  }
  const iCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm dark:text-white outline-none";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold dark:text-white">Cobro Rápido</h3><button onClick={onClose}><Icon name="close" className="text-slate-400"/></button></div>
        <p className="text-sm text-slate-500 mb-4">{player.nombre_completo}</p>
        <form id="qp" onSubmit={handleSubmit} className="space-y-4">
          <input className={iCls} placeholder="Periodo" value={form.periodo} onChange={e=>setForm({...form, periodo: e.target.value})} required/>
          <div className="grid grid-cols-2 gap-3"><input type="number" className={iCls} value={form.monto} onChange={e=>setForm({...form, monto: e.target.value})} required/><input type="date" className={iCls} style={{colorScheme:'dark'}} value={form.fecha_pago} onChange={e=>setForm({...form, fecha_pago: e.target.value})} required/></div>
          <div onClick={()=>ref.current?.click()} className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer">
            {preview ? <img src={preview} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg flex justify-center items-center"><Icon name="paperclip" className="text-slate-400"/></div>}
            <p className="text-xs text-slate-500">{preview ? "✓ Voucher listo" : "Adjuntar voucher (opcional)"}</p>
          </div>
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e=>{if(e.target.files[0]){setFile(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0]))}}}/>
        </form>
        <div className="flex gap-3 mt-5"><button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold dark:text-white">Cancelar</button><button type="submit" form="qp" disabled={saving} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold">{saving?"Guardando":"Confirmar"}</button></div>
      </div>
    </div>
  );
}

export function DeleteModal({ player, onConfirm, onCancel }) {
  if (!player) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div style={{ animation: "fadeIn .2s ease" }} className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 w-full max-sm:w-[90vw] max-w-sm shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-5"><Icon name="trash" className="w-8 h-8 text-red-600 dark:text-red-400" /></div>
        <h3 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">¿Desactivar jugador?</h3>
        <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-7">Se pasará a <span className="font-semibold text-slate-900 dark:text-white">{player.nombre_completo}</span> a estado inactivo.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-white font-medium">Cancelar</button>
          <button onClick={() => onConfirm(player)} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">Sí, desactivar</button>
        </div>
      </div>
    </div>
  );
}