import { useState, useRef } from "react";
import { formatPeso, formatearFecha, COMPRA_FORM_VACIO, TRIMESTRES } from "../utils/helpers";
import { Icon } from "../components/Icon";
import { StatusDot } from "../components/UI";

export function FinanceView({ players = [], trimestre, setTrimestre, pagosTrimestre = [], comprasTrimestre = [], loadingFinanzas, onSavePago, onSaveCompra, onDeleteCompra, onQuickPay }) {
  const [tab, setTab] = useState("jugadores");
  const [compraForm, setCompraForm] = useState(COMPRA_FORM_VACIO);
  const [showCompraForm, setShowCompraForm] = useState(false);
  const [finFilter, setFinFilter] = useState("todos");
  const [compraFile, setCompraFile] = useState(null);
  const [compraPreview, setCompraPreview] = useState(null);
  const [savingCompra, setSavingCompra] = useState(false);
  const voucherRef = useRef(null);

  const totalIngresos = pagosTrimestre.reduce((s, p) => s + (p?.monto || 0), 0);
  const totalEgresos  = comprasTrimestre.reduce((s, c) => s + (c?.monto || 0), 0);
  const balance       = totalIngresos - totalEgresos;

  const pagoMap = {}; 
  pagosTrimestre.forEach(p => { if (p) pagoMap[p.jugador_id] = p; });
  
  let jugadoresCobro = players.filter(p => p?.estado !== "inactivo");
  if (finFilter === "pagados") jugadoresCobro = jugadoresCobro.filter(p => pagoMap[p.id]);
  if (finFilter === "pendientes") jugadoresCobro = jugadoresCobro.filter(p => !pagoMap[p.id]);

  const handleSubmitCompra = async (e) => {
    e.preventDefault();
    if (!compraForm.producto.trim() || !compraForm.monto) return;
    setSavingCompra(true);
    const nombreDescarga = `Voucher_Compra_${compraForm.producto.replace(/\s+/g, '_')}_${trimestre}.jpg`;
    await onSaveCompra({ ...compraForm, trimestre_referencia: trimestre }, compraFile, nombreDescarga);
    setSavingCompra(false);
    setShowCompraForm(false); 
    setCompraForm(COMPRA_FORM_VACIO);
    setCompraFile(null);
    setCompraPreview(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center bg-white dark:bg-[#0B1120] p-4 rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B]">
        <label className="text-sm font-bold text-[#6B7280]">Trimestre:</label>
        <select value={trimestre} onChange={e => setTrimestre(e.target.value)} className="bg-[#F3F4F6] dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1E293B] rounded-lg px-4 py-2 font-bold text-[#1E40AF] dark:text-[#3B82F6] outline-none cursor-pointer">
          {TRIMESTRES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {loadingFinanzas && <Icon name="spinner" className="w-5 h-5 text-[#1E40AF]" />}
      </div>

      {/* --- NUEVO TÍTULO GIGANTE CENTRADO --- */}
      <div className="py-6 text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Visualizando Balance de</p>
        <h2 className="text-3xl sm:text-5xl font-black text-[#1E40AF] dark:text-[#60A5FA] tracking-tighter uppercase drop-shadow-sm">
          {trimestre}
        </h2>
      </div>
      {/* ----------------------------------- */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5 rounded-2xl transition-colors">
          <p className="text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-1">↑ Ingresos</p>
          <p className="text-3xl font-display font-extrabold text-emerald-600">{formatPeso(totalIngresos)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-5 rounded-2xl transition-colors">
          <p className="text-red-700 dark:text-red-400 font-bold text-sm mb-1">↓ Egresos</p>
          <p className="text-3xl font-display font-extrabold text-red-600">{formatPeso(totalEgresos)}</p>
        </div>
        <div className="bg-[#EFF6FF] dark:bg-[#1E3A8A]/20 border border-[#BFDBFE] dark:border-[#1E3A8A] p-5 rounded-2xl transition-colors">
          <p className="text-[#1E40AF] dark:text-[#60A5FA] font-bold text-sm mb-1">= Balance Real</p>
          <p className="text-3xl font-display font-extrabold text-[#1D4ED8] dark:text-[#3B82F6]">{formatPeso(balance)}</p>
        </div>
      </div>

      <div className="flex gap-2 bg-[#F3F4F6] dark:bg-[#0B1120] p-1 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] w-fit">
        {[{k: "jugadores", l: "Cobros"}, {k: "compras", l: "Compras"}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.k ? "bg-white dark:bg-[#1F2937] text-[#1E40AF] dark:text-white shadow-sm" : "text-[#6B7280] hover:text-[#111827] dark:hover:text-white"}`}>{t.l}</button>
        ))}
      </div>

      {tab === "jugadores" && (
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between bg-[#F9FAFB] dark:bg-[#030611]">
            <div className="flex gap-2">
              <button onClick={()=>setFinFilter("todos")} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${finFilter==="todos"?"bg-[#1E40AF] text-white":"bg-[#E5E7EB] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF]"}`}>Todos</button>
              <button onClick={()=>setFinFilter("pendientes")} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${finFilter==="pendientes"?"bg-amber-500 text-white":"bg-[#E5E7EB] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF]"}`}>Pendientes</button>
              <button onClick={()=>setFinFilter("pagados")} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${finFilter==="pagados"?"bg-emerald-500 text-white":"bg-[#E5E7EB] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF]"}`}>Pagados</button>
            </div>
            <span className="text-xs font-bold text-[#6B7280]">Total: {jugadoresCobro.length}</span>
          </div>
          <div className="divide-y divide-[#F3F4F6] dark:divide-[#1E293B]">
            {jugadoresCobro.length === 0 ? <p className="text-center py-8 text-sm text-[#6B7280]">No hay jugadores en esta categoría</p> : null}
            {jugadoresCobro.map(p => (
              <div key={p.id} className="p-4 flex items-center justify-between hover:bg-[#F9FAFB] dark:hover:bg-[#111827] transition-colors">
                <div className="flex items-center gap-3">
                  <StatusDot status={p.estado} />
                  <p className="font-bold text-sm text-[#111827] dark:text-white">{p.nombre_completo}</p>
                </div>
                {pagoMap[p.id] ? (
                  <div className="flex items-center gap-1.5">
                    {/* 1. BOTÓN VER (Ojo) */}
                    {pagoMap[p.id].comprobante_url ? (
                      <a 
                        href={pagoMap[p.id].comprobante_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 bg-sky-50 dark:bg-sky-900/30 text-sky-600 rounded-xl hover:bg-sky-100 transition-colors border border-sky-100 dark:border-sky-800"
                        title="Ver comprobante"
                      >
                        <Icon name="eye" className="w-4 h-4" />
                      </a>
                    ) : (
                      <div className="p-2 opacity-20 cursor-not-allowed" title="Sin comprobante"><Icon name="eye" className="w-4 h-4" /></div>
                    )}

                    {/* 2. BOTÓN DESCARGAR (Download) */}
                    {pagoMap[p.id].comprobante_url ? (
                      <button 
                        onClick={() => {
                          // Importamos la función de descarga de los helpers
                          import("../utils/helpers").then(m => m.descargarImagen(pagoMap[p.id].comprobante_url, `Voucher_${p.nombre_completo}_${trimestre}.jpg`))
                        }}
                        className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                        title="Descargar imagen"
                      >
                        <Icon name="download" className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="p-2 opacity-20 cursor-not-allowed" title="Sin comprobante"><Icon name="download" className="w-4 h-4" /></div>
                    )}

                    {/* 3. BOTÓN EDITAR (Lápiz) */}
                    <button 
                      onClick={() => onQuickPay({ player: p, pagoAEditar: pagoMap[p.id] })} 
                      className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 ml-1"
                      title="Editar registro"
                    >
                      <span className="text-[10px] font-black uppercase tracking-tighter hidden sm:inline">Pagado</span>
                      <Icon name="edit" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* BOTÓN COBRAR (Si no ha pagado) */
                  <button 
                    onClick={() => onQuickPay({ player: p, pagoAEditar: null })} 
                    className="px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-xl hover:bg-amber-400 transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" /> Cobrar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REEMPLAZA TODO DESDE AQUÍ HASTA EL FINAL */}
      {tab === "compras" && (
        <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-[#E5E7EB] dark:border-[#1E293B] p-5 shadow-sm">
          {!showCompraForm ? (
             <button onClick={() => setShowCompraForm(true)} className="w-full sm:w-auto px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex justify-center items-center gap-2 shadow-md"><Icon name="plus"/> Registrar Gasto</button>
          ) : (
            <form onSubmit={handleSubmitCompra} className="space-y-4 bg-red-50 dark:bg-red-500/5 p-5 rounded-2xl border border-red-100 dark:border-red-500/20">
              <div className="flex items-center justify-between mb-2">
                 <p className="font-bold text-red-600 flex items-center gap-2"><Icon name="minus_circle"/> Nuevo Egreso</p>
                 <button type="button" onClick={()=>setShowCompraForm(false)} className="text-gray-400 hover:text-gray-600"><Icon name="close"/></button>
              </div>
              <input className="w-full border rounded-xl p-3 bg-white dark:bg-[#111827] dark:border-[#1E293B] dark:text-white outline-none focus:border-red-400" placeholder="Producto o Descripción" value={compraForm.producto} onChange={e=>setCompraForm({...compraForm, producto: e.target.value})} required/>
              <div className="flex flex-col sm:flex-row gap-4">
                <input type="number" className="w-full border rounded-xl p-3 bg-white dark:bg-[#111827] dark:border-[#1E293B] dark:text-white outline-none focus:border-red-400" placeholder="Monto total ($)" value={compraForm.monto} onChange={e=>setCompraForm({...compraForm, monto: e.target.value})} required/>
                <input type="date" className="w-full border rounded-xl p-3 bg-white dark:bg-[#111827] dark:border-[#1E293B] dark:text-white outline-none focus:border-red-400" style={{colorScheme:'dark'}} value={compraForm.fecha_compra} onChange={e=>setCompraForm({...compraForm, fecha_compra: e.target.value})} required/>
              </div>
              <div onClick={()=>voucherRef.current?.click()} className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-red-400 bg-white dark:bg-[#111827] transition-colors">
                {compraPreview ? <img src={compraPreview} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex justify-center items-center"><Icon name="paperclip" className="text-gray-400"/></div>}
                <p className="text-xs text-gray-500 font-medium">{compraPreview ? "Voucher seleccionado" : "Adjuntar voucher de compra (opcional)"}</p>
              </div>
              <input ref={voucherRef} type="file" accept="image/*" className="hidden" onChange={e=>{if(e.target.files[0]){setCompraFile(e.target.files[0]); setCompraPreview(URL.createObjectURL(e.target.files[0]))}}}/>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowCompraForm(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white font-bold rounded-xl hover:bg-gray-300 transition-colors">Cancelar</button>
                <button type="submit" disabled={savingCompra} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">{savingCompra ? "Guardando..." : "Guardar Egreso"}</button>
              </div>
            </form>
          )}

          <div className="mt-6 divide-y divide-[#F3F4F6] dark:divide-[#1E293B]">
            {comprasTrimestre.length === 0 && !showCompraForm && <p className="text-sm text-center py-6 text-[#6B7280]">No hay egresos en este trimestre.</p>}
            {comprasTrimestre.map(c => (
              <div key={c.id} className="py-4 flex justify-between items-center group border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 border border-red-100 dark:border-red-800/50 shadow-sm"><Icon name="arrow_down" className="w-5 h-5"/></div>
                   <div>
                     <p className="font-bold text-sm text-[#111827] dark:text-white">{c.producto}</p>
                     <p className="text-[11px] text-gray-500 font-medium">{formatearFecha(c.fecha_compra)}</p>
                   </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="font-black text-red-500 text-sm">-{formatPeso(c.monto)}</span>
                  
                  {/* BOTONES SIEMPRE VISIBLES PARA MÓVIL Y PC */}
                  <div className="flex gap-1.5 ml-2">
                    {c.comprobante_url ? (
                      <a 
                        href={c.comprobante_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-2 bg-sky-50 dark:bg-sky-900/30 text-sky-600 rounded-xl hover:bg-sky-100 transition-colors border border-sky-100 dark:border-sky-800"
                        title="Ver voucher"
                      >
                        <Icon name="eye" className="w-4 h-4"/>
                      </a>
                    ) : (
                      <div className="p-2 opacity-20 cursor-not-allowed text-slate-400" title="Sin voucher"><Icon name="eye" className="w-4 h-4" /></div>
                    )}
                    
                    <button 
                      onClick={() => { if(window.confirm("¿Seguro que deseas eliminar este gasto?")) onDeleteCompra(c.id) }} 
                      className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100 dark:border-red-800"
                      title="Eliminar registro"
                    >
                      <Icon name="trash" className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}