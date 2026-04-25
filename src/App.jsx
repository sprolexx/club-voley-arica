import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Importaciones de los nuevos módulos
import { calcularEdad, getCurrentTrimestre, FORM_VACIO, BUCKET_CARNETS, BUCKET_COMPROBANTES, BUCKET_COMPRAS } from "./utils/helpers";
import { Icon } from "./components/Icon";
import { Toast, StatusDot } from "./components/UI";
import { FinanceView } from "./views/FinanceView";
import { PlayerDetailsModal, PlayerFormPanel, QuickPayModal, DeleteModal } from "./modals/PlayerModals";

// Lógica de Subida de Imagenes movida fuera del componente para evitar re-renders y calmar a ESLint
async function uploadSingleImage(file, bucket, folder, typeSuffix) {
  if (!file) return null;
  const cleanRut = (folder || "").replace(/[.\s-]/g, "");
  const ext = file.name.split(".").pop().toLowerCase();
  const nombre = `${cleanRut}/${typeSuffix}.${ext}`; 
  const { error } = await supabase.storage.from(bucket).upload(nombre, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(nombre).data.publicUrl;
}

async function uploadSingleFile(file, bucket, folder, profesionalName) {
  if (!file) return null;
  const { error } = await supabase.storage.from(bucket).upload(`${folder}/${profesionalName}`, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(`${folder}/${profesionalName}`).data.publicUrl;
}

export default function App() {
  const [currentView, setCurrentView] = useState("plantel");
  const [isDarkMode, setIsDarkMode]   = useState(true);
  const [players, setPlayers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [toast, setToast]             = useState(null);
  
  const [sortBy, setSortBy]           = useState("nombre"); 
  const [sortOrder, setSortOrder]     = useState("asc"); 
  const [groupBy, setGroupBy]         = useState("none"); 
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const [showForm, setShowForm]           = useState(false);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [editingId, setEditingId]         = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState({});
  const [photoFiles, setPhotoFiles]       = useState({ perfil: null, frontal: null, trasero: null });
  const [photoPreviews, setPhotoPreviews] = useState({ perfil: null, frontal: null, trasero: null });
  
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [quickPayPlayer, setQuickPayPlayer] = useState(null);
  
  const [trimestre, setTrimestre]               = useState(getCurrentTrimestre());
  const [pagosTrimestre, setPagosTrimestre]     = useState([]);
  const [comprasTrimestre, setComprasTrimestre] = useState([]);
  
  const [loadingFinanzas, setLoadingFinanzas]     = useState(false);
  const [loadingPagosModal, setLoadingPagosModal] = useState(false);
  const [pagosJugadorModal, setPagosJugadorModal] = useState([]);

  const mostrarToast = useCallback((message, type = "success") => { 
    setToast({ message, type }); 
    setTimeout(() => setToast(null), 3500); 
  }, []);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("jugadores").select("*").order("created_at", { ascending: false });
    setPlayers(data || []);
    setLoading(false);
  }, []);

  const fetchFinanzas = useCallback(async (periodo) => {
    setLoadingFinanzas(true);
    const [p, c] = await Promise.all([
      supabase.from("pagos").select("*").eq("periodo", periodo),
      supabase.from("compras").select("*").eq("trimestre_referencia", periodo)
    ]);
    setPagosTrimestre(p.data || []); 
    setComprasTrimestre(c.data || []);
    setLoadingFinanzas(false);
  }, []);

  const fetchPagosJugador = useCallback(async (id) => {
    if(!id) return;
    setLoadingPagosModal(true);
    const { data } = await supabase.from("pagos").select("*").eq("jugador_id", id).order("fecha_pago", { ascending: false });
    setPagosJugadorModal(data || []);
    setLoadingPagosModal(false);
  }, []);

  // Se quitaron las dependencias que causaban advertencias en ESLint
  useEffect(() => { fetchPlayers(); }, []); // eslint-disable-line
  
  useEffect(() => { 
    if(currentView === "finanzas") fetchFinanzas(trimestre); 
  }, [currentView, trimestre]); // eslint-disable-line
  
  useEffect(() => { 
    if(viewingPlayer?.id) fetchPagosJugador(viewingPlayer.id); 
  }, [viewingPlayer]); // eslint-disable-line

  function abrirNuevo() {
    setForm(FORM_VACIO); setEditingId(null); setErrors({});
    setPhotoFiles({ perfil: null, frontal: null, trasero: null });
    setPhotoPreviews({ perfil: null, frontal: null, trasero: null });
    setShowForm(true);
  }

  function abrirEdicion(p) {
    setForm({ ...p, altura_cm: p.altura_cm ?? "", estado: p.estado || "activo" }); setEditingId(p.id); setErrors({});
    setPhotoFiles({ perfil: null, frontal: null, trasero: null });
    setPhotoPreviews({ perfil: p.foto_perfil_url || p.foto_url || null, frontal: p.carnet_frontal_url || null, trasero: p.carnet_trasero_url || null });
    setShowForm(true);
  }

  function handlePhotoChange(tipo, e) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFiles(prev => ({ ...prev, [tipo]: file }));
      setPhotoPreviews(prev => ({ ...prev, [tipo]: URL.createObjectURL(file) }));
    }
  }

  const handleSaveJugador = async (e) => {
    e.preventDefault();
    if (!form.nombre_completo || !form.rut || !form.fecha_nacimiento) { mostrarToast("Faltan campos obligatorios", "error"); return; }
    setSubmitting(true);
    try {
      const payload = { 
        nombre_completo: form.nombre_completo.trim(), rut: form.rut.trim(), fecha_nacimiento: form.fecha_nacimiento, direccion: form.direccion,
        posicion: form.posicion || null, telefono: form.telefono || null, email_personal: form.email_personal || null, estado: form.estado || "activo",
        altura_cm: form.altura_cm ? parseInt(form.altura_cm, 10) : null,
        foto_perfil_url: form.foto_perfil_url || form.foto_url || null, carnet_frontal_url: form.carnet_frontal_url || null, carnet_trasero_url: form.carnet_trasero_url || null,
      };

      const subidas = [];
      if (photoFiles.perfil) subidas.push(uploadSingleImage(photoFiles.perfil, BUCKET_CARNETS, form.rut, "perfil").then(url => payload.foto_perfil_url = url));
      if (photoFiles.frontal) subidas.push(uploadSingleImage(photoFiles.frontal, BUCKET_CARNETS, form.rut, "carnet_frontal").then(url => payload.carnet_frontal_url = url));
      if (photoFiles.trasero) subidas.push(uploadSingleImage(photoFiles.trasero, BUCKET_CARNETS, form.rut, "carnet_trasero").then(url => payload.carnet_trasero_url = url));
      
      await Promise.all(subidas);
      if (payload.foto_url) payload.foto_url = null;

      if (editingId) await supabase.from("jugadores").update(payload).eq("id", editingId);
      else await supabase.from("jugadores").insert([payload]);
      
      fetchPlayers(); setShowForm(false); mostrarToast(editingId ? "Actualizado" : "Guardado");
    } catch { mostrarToast("Error al guardar", "error"); }
    setSubmitting(false);
  };

  const handleSoftDelete = async (player) => {
    await supabase.from("jugadores").update({ estado: 'inactivo' }).eq("id", player.id);
    fetchPlayers(); setDeleteConfirm(null); mostrarToast("Jugador desactivado");
  };

  const handleSavePago = async (jugadorId, pagoForm, file, profesionalName) => {
    try {
      let url = file ? await uploadSingleFile(file, BUCKET_COMPROBANTES, jugadorId, profesionalName) : null;
      await supabase.from("pagos").insert([{ jugador_id: jugadorId, periodo: pagoForm.periodo, monto: parseInt(pagoForm.monto), fecha_pago: pagoForm.fecha_pago, comprobante_url: url }]);
      fetchFinanzas(trimestre); if (viewingPlayer?.id === jugadorId) fetchPagosJugador(jugadorId);
      mostrarToast("Pago registrado"); return true;
    } catch { mostrarToast("Error al registrar el pago", "error"); return false; }
  };

  const handleSaveCompra = async (compra, file, profesionalName) => {
    try {
      let url = file ? await uploadSingleFile(file, BUCKET_COMPRAS, trimestre, profesionalName) : null;
      await supabase.from("compras").insert([{ producto: compra.producto, monto: parseInt(compra.monto), fecha_compra: compra.fecha_compra, trimestre_referencia: compra.trimestre_referencia, comprobante_url: url }]);
      fetchFinanzas(trimestre); mostrarToast("Compra registrada"); return true;
    } catch { mostrarToast("Error al registrar la compra", "error"); return false; }
  };

  const handleDeleteCompra = async (id) => {
    await supabase.from("compras").delete().eq("id", id);
    fetchFinanzas(trimestre); mostrarToast("Compra eliminada");
  };

  // Blindaje anti-pantalla blanca con (p.nombre || "")
  let displayPlayers = players.filter(p => 
    (p?.nombre_completo || "").toLowerCase().includes(search.toLowerCase()) || 
    (p?.rut || "").includes(search)
  );
  
  displayPlayers.sort((a, b) => {
    let valA = sortBy === "nombre" ? (a?.nombre_completo || "").toLowerCase() : calcularEdad(a?.fecha_nacimiento);
    let valB = sortBy === "nombre" ? (b?.nombre_completo || "").toLowerCase() : calcularEdad(b?.fecha_nacimiento);
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  let groupedPlayers = { "Todos": displayPlayers };
  if (groupBy === "posicion") {
    groupedPlayers = {};
    displayPlayers.forEach(p => {
      const pos = p?.posicion || "Sin posición";
      if (!groupedPlayers[pos]) groupedPlayers[pos] = [];
      groupedPlayers[pos].push(p);
    });
  }

  const promEdad = players.length ? Math.round(players.reduce((acc, p) => acc + (Number(calcularEdad(p?.fecha_nacimiento)) || 0), 0) / players.length) : 0;

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-[#FDFDFE] dark:bg-[#030611] text-[#1F2937] dark:text-[#E5E7EB] font-sans pb-20">
        
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#030611]/95 border-b border-[#E5E7EB] dark:border-[#1E293B] p-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-black text-[#1E40AF] dark:text-white tracking-tighter flex items-center gap-2"><div className="bg-[#1E40AF] p-1.5 rounded-lg"><Icon name="volleyball" className="w-5 h-5 text-white"/></div> CLUB UNION VOLEY</h1>
            <div className="flex bg-[#F3F4F6] dark:bg-[#0B1120] p-1 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B]">
                <button onClick={() => setCurrentView("plantel")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentView === "plantel" ? "bg-[#1E40AF] text-white" : "text-[#6B7280] hover:text-[#111827] dark:hover:text-white"}`}>Plantel</button>
                <button onClick={() => setCurrentView("finanzas")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentView === "finanzas" ? "bg-[#1E40AF] text-white" : "text-[#6B7280] hover:text-[#111827] dark:hover:text-white"}`}>Finanzas</button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-[#F3F4F6] dark:bg-[#0B1120] text-[#1E40AF] rounded-lg"><Icon name={isDarkMode?"sun":"moon"} className="w-5 h-5"/></button>
              <button onClick={abrirNuevo} className="px-4 py-2 bg-[#1E40AF] text-white font-bold rounded-lg flex items-center gap-2 shadow-lg"><Icon name="plus" className="w-4 h-4"/> <span className="hidden sm:block">Nuevo</span></button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6">
          {currentView === "plantel" && (
            <>
              <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
                <div className="flex gap-2">
                  <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 rounded-xl text-sm font-bold text-[#6B7280]">Total: <span className="text-[#1E40AF] dark:text-white">{players.length}</span></div>
                  <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 rounded-xl text-sm font-bold text-[#6B7280]">Edad: <span className="text-[#1E40AF] dark:text-white">{promEdad}</span></div>
                </div>
                <div className="flex gap-2 flex-1 sm:justify-end relative">
                  <div className="relative w-full sm:w-80">
                    <Icon name="search" className="absolute left-3 top-3 text-gray-400 w-5 h-5"/>
                    <input className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl outline-none focus:border-[#1E40AF] text-sm" placeholder="Buscar jugador..." value={search} onChange={e=>setSearch(e.target.value)} />
                  </div>
                  <div className="relative">
                    <button onClick={()=>setShowFilterMenu(!showFilterMenu)} className="px-4 py-2.5 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#111827]"><Icon name="filter" className="w-4 h-4"/> <span className="hidden sm:inline">Ordenar</span></button>
                    {showFilterMenu && (
                      <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] shadow-2xl rounded-xl p-4 z-40">
                        <p className="text-[10px] font-black text-gray-500 mb-2">ORDENAR POR</p>
                        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[#111827] dark:border-[#1E293B] border text-sm mb-2 outline-none"><option value="nombre">Nombre</option><option value="edad">Edad</option></select>
                        <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[#111827] dark:border-[#1E293B] border text-sm mb-4 outline-none"><option value="asc">Ascendente (A-Z)</option><option value="desc">Descendente (Z-A)</option></select>
                        <p className="text-[10px] font-black text-gray-500 mb-2">AGRUPAR POR</p>
                        <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[#111827] dark:border-[#1E293B] border text-sm outline-none"><option value="none">Sin agrupar</option><option value="posicion">Posición</option></select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {loading ? <div className="py-20 flex justify-center"><Icon name="spinner" className="w-8 h-8 text-[#1E40AF]"/></div> : 
                Object.keys(groupedPlayers).map(group => (
                  <div key={group} className="mb-8">
                    {groupBy !== "none" && <h2 className="text-lg font-black mb-3 text-[#1E40AF] dark:text-[#60A5FA] border-b border-gray-200 dark:border-gray-800 pb-2">{group} <span className="text-gray-400 text-sm font-normal">({groupedPlayers[group].length})</span></h2>}
                    <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl overflow-hidden shadow-sm">
                       {groupedPlayers[group].map(p => (
                         <div key={p.id} className="p-4 border-b border-[#F3F4F6] dark:border-[#1E293B] flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors">
                           <div className="flex items-center gap-4">
                             <StatusDot status={p?.estado} />
                             <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden hidden sm:block">
                               {(p?.foto_perfil_url || p?.foto_url) ? <img src={p.foto_perfil_url || p.foto_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Icon name="user" className="w-5 h-5 text-gray-400"/></div>}
                             </div>
                             <div>
                               <p className="font-bold text-[#111827] dark:text-white text-sm">{p?.nombre_completo}</p>
                               <p className="text-xs text-[#6B7280]">{p?.rut} • {calcularEdad(p?.fecha_nacimiento)} años {p?.posicion && `• ${p.posicion}`}</p>
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={()=>{setViewingPlayer(p)}} className="px-3 py-1.5 text-sm font-bold text-[#1E40AF] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 rounded-lg hover:bg-[#DBEAFE]">Ver Perfil</button>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
              ))}
            </>
          )}

          {currentView === "finanzas" && (
            <FinanceView players={players} trimestre={trimestre} setTrimestre={setTrimestre} pagosTrimestre={pagosTrimestre} comprasTrimestre={comprasTrimestre} loadingFinanzas={loadingFinanzas} onSavePago={handleSavePago} onSaveCompra={handleSaveCompra} onDeleteCompra={handleDeleteCompra} onQuickPay={setQuickPayPlayer} />
          )}
        </main>

        <PlayerFormPanel show={showForm} editingId={editingId} form={form} setForm={setForm} errors={errors} setErrors={setErrors} previews={photoPreviews} onPhotoChange={handlePhotoChange} onSubmit={handleSaveJugador} onClose={() => setShowForm(false)} submitting={submitting} />
        <PlayerDetailsModal player={viewingPlayer} onClose={() => setViewingPlayer(null)} onEdit={abrirEdicion} onDelete={setDeleteConfirm} pagos={pagosJugadorModal} pagosLoading={loadingPagosModal} onSavePago={handleSavePago} />
        <QuickPayModal player={quickPayPlayer} trimestre={trimestre} onClose={() => setQuickPayPlayer(null)} onSave={handleSavePago} />
        <DeleteModal player={deleteConfirm} onConfirm={handleSoftDelete} onCancel={() => setDeleteConfirm(null)} />
        <Toast toast={toast} />
      </div>
    </div>
  );
}