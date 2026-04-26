import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Importaciones
import { calcularEdad, getCurrentTrimestre, FORM_VACIO, BUCKET_CARNETS, BUCKET_COMPROBANTES, BUCKET_COMPRAS } from "./utils/helpers";
import { Icon } from "./components/Icon";
import { Toast, StatusDot } from "./components/UI";
import { FinanceView } from "./views/FinanceView";
import { PlayerDetailsModal, PlayerFormPanel, PaymentModal, DeleteModal } from "./modals/PlayerModals";

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
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [currentView, setCurrentView] = useState("plantel");
  const [isDarkMode, setIsDarkMode]   = useState(false); // <--- MODO CLARO POR DEFECTO
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
  const [paymentModalConfig, setPaymentModalConfig] = useState(null); // Para el PaymentModal
  
  const [trimestre, setTrimestre]               = useState(getCurrentTrimestre());
  const [pagosTrimestre, setPagosTrimestre]     = useState([]);
  const [comprasTrimestre, setComprasTrimestre] = useState([]);
  
  const [loadingFinanzas, setLoadingFinanzas]     = useState(false);
  const [loadingPagosModal, setLoadingPagosModal] = useState(false);
  const [pagosJugadorModal, setPagosJugadorModal] = useState([]);

  // Estados para el Historial
  const [historialJugadorModal, setHistorialJugadorModal] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const mostrarToast = useCallback((message, type = "success") => { 
    setToast({ message, type }); 
    setTimeout(() => setToast(null), 3500); 
  }, []);

  // --- SESIÓN ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) mostrarToast("Credenciales incorrectas", "error");
    setAuthLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); };

  // --- FETCH DATA ---
  const fetchPlayers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase.from("jugadores").select("*").order("created_at", { ascending: false });
    setPlayers(data || []);
    setLoading(false);
  }, [session]);

  const fetchFinanzas = useCallback(async (periodo) => {
    if (!session) return;
    setLoadingFinanzas(true);
    const [p, c] = await Promise.all([
      supabase.from("pagos").select("*").eq("periodo", periodo),
      supabase.from("compras").select("*").eq("trimestre_referencia", periodo)
    ]);
    setPagosTrimestre(p.data || []); 
    setComprasTrimestre(c.data || []);
    setLoadingFinanzas(false);
  }, [session]);

  const fetchPagosJugador = useCallback(async (id) => {
    if(!id || !session) return;
    setLoadingPagosModal(true);
    const { data } = await supabase.from("pagos").select("*").eq("jugador_id", id).order("fecha_pago", { ascending: false });
    setPagosJugadorModal(data || []);
    setLoadingPagosModal(false);
  }, [session]);

  const fetchHistorialJugador = useCallback(async (id) => {
    if(!id || !session) return;
    setLoadingHistorial(true);
    const { data } = await supabase.from("historial_estados").select("*").eq("jugador_id", id).order("created_at", { ascending: false });
    setHistorialJugadorModal(data || []);
    setLoadingHistorial(false);
  }, [session]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { if(currentView === "finanzas") fetchFinanzas(trimestre); }, [currentView, trimestre, fetchFinanzas]);
  
  useEffect(() => { 
    if(viewingPlayer?.id) {
      fetchPagosJugador(viewingPlayer.id); 
      fetchHistorialJugador(viewingPlayer.id); // Llamamos al historial cuando abres el modal
    }
  }, [viewingPlayer, fetchPagosJugador, fetchHistorialJugador]);

  // --- HANDLERS JUGADOR ---
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
        nombre_completo: form.nombre_completo.trim(), rut: form.rut.replace(/[.\s]/g, ""), fecha_nacimiento: form.fecha_nacimiento, direccion: form.direccion,
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

      let jugadorGuardadoId = editingId;

      if (editingId) {
        const originalPlayer = players.find(p => p.id === editingId);
        const { error } = await supabase.from("jugadores").update(payload).eq("id", editingId);
        if (error) throw error;
        
        // Registrar Historial si el estado cambió
        if (originalPlayer && originalPlayer.estado !== payload.estado) {
          await supabase.from("historial_estados").insert([{
             jugador_id: editingId,
             estado_anterior: originalPlayer.estado || 'activo',
             estado_nuevo: payload.estado,
             motivo: 'Actualización manual de ficha'
          }]);
        }
      } else {
        const { data, error } = await supabase.from("jugadores").insert([payload]).select().single();
        if (error) throw error;
        jugadorGuardadoId = data.id;
        
        // Registrar creación como primer historial
        await supabase.from("historial_estados").insert([{
           jugador_id: jugadorGuardadoId,
           estado_anterior: null,
           estado_nuevo: payload.estado,
           motivo: 'Ingreso al club'
        }]);
      }
      
      fetchPlayers(); setShowForm(false); mostrarToast(editingId ? "Actualizado" : "Guardado");
    } catch (err) { mostrarToast(err.message || "Error al guardar", "error"); }
    setSubmitting(false);
  };

  const handleSoftDelete = async (player) => {
    try {
      await supabase.from("jugadores").update({ estado: 'inactivo' }).eq("id", player.id);
      
      // Registrar baja en el historial
      await supabase.from("historial_estados").insert([{
         jugador_id: player.id,
         estado_anterior: player.estado || 'activo',
         estado_nuevo: 'inactivo',
         motivo: 'Baja o eliminación de jugador'
      }]);
      
      fetchPlayers(); setDeleteConfirm(null); mostrarToast("Jugador desactivado");
    } catch { mostrarToast("Error al desactivar", "error"); }
  };

  const handleSavePago = async (jugadorId, pagoForm, file, profesionalName, editPagoId = null) => {

    try {
      // Si suben una foto nueva, la guardamos
      let url = file ? await uploadSingleFile(file, BUCKET_COMPROBANTES, jugadorId, profesionalName) : null;
      
      const payload = { 
        jugador_id: jugadorId, 
        periodo: pagoForm.periodo, 
        monto: parseInt(pagoForm.monto), 
        fecha_pago: pagoForm.fecha_pago 
      };
      
      // Solo sobreescribimos la URL del comprobante si subieron uno nuevo
      if (url) payload.comprobante_url = url;

      if (editPagoId) {
        // MODO EDICIÓN: Actualiza el registro existente
        await supabase.from("pagos").update(payload).eq("id", editPagoId);
      } else {
        // MODO CREACIÓN: Inserta uno nuevo
        await supabase.from("pagos").insert([payload]);
      }

      fetchFinanzas(trimestre); 
      if (viewingPlayer?.id === jugadorId) fetchPagosJugador(jugadorId);
      mostrarToast(editPagoId ? "Pago actualizado correctamente" : "Pago registrado exitosamente"); 
      return true;
    } catch { 
      mostrarToast("Error al procesar el pago", "error"); 
      return false; 
    }
  };

  const handleDeletePago = async (id) => {
    try {
      await supabase.from("pagos").delete().eq("id", id);
      fetchFinanzas(trimestre);
      if (viewingPlayer?.id) fetchPagosJugador(viewingPlayer.id);
      mostrarToast("Pago eliminado correctamente");
    } catch {
      mostrarToast("Error al eliminar", "error");
    }
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

  if (!session) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <div className="min-h-screen bg-[#FDFDFE] dark:bg-[#030611] flex items-center justify-center p-4 font-sans transition-colors">
          <form onSubmit={handleLogin} className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6">
            <div className="text-center space-y-3">
              <div className="bg-[#1E40AF] w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Icon name="volleyball" className="text-white w-8 h-8" />
              </div>
              <h1 className="text-2xl font-display font-black text-[#1E40AF] dark:text-white tracking-tight">CLUB UNION VOLEY</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Ingresa para gestionar el club</p>
            </div>
            <div className="space-y-4">
              <input type="email" placeholder="Correo electrónico" className="w-full p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-gray-50 dark:bg-[#111827] dark:text-white outline-none focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/20 transition-all text-sm" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Contraseña" className="w-full p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-gray-50 dark:bg-[#111827] dark:text-white outline-none focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/20 transition-all text-sm" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={authLoading} className="w-full py-3.5 bg-[#1E40AF] text-white font-bold rounded-xl shadow-lg hover:bg-[#1C3FAA] transition-all active:scale-95 flex justify-center">
              {authLoading ? <Icon name="spinner" /> : "Iniciar Sesión"}
            </button>
            <Toast toast={toast} />
          </form>
        </div>
      </div>
    );
  }

  let displayPlayers = players.filter(p => (p?.nombre_completo || "").toLowerCase().includes(search.toLowerCase()) || (p?.rut || "").includes(search));
  
  displayPlayers.sort((a, b) => {
    let valA = sortBy === "nombre" ? (a?.nombre_completo || "").toLowerCase() : calcularEdad(a?.fecha_nacimiento);
    let valB = sortBy === "nombre" ? (b?.nombre_completo || "").toLowerCase() : calcularEdad(b?.fecha_nacimiento);
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const CATEGORIAS_PRINCIPALES = ["Armadores", "Puntas", "Centros", "Opuestos", "Líberos"];
  
  const getCategoriaName = (posString) => {
    if (!posString) return "Sin Posición";
    if (posString.includes("Armador")) return "Armadores";
    if (posString.includes("Punta")) return "Puntas";
    if (posString.includes("Central")) return "Centros";
    if (posString.includes("Opuesto")) return "Opuestos";
    if (posString.includes("Líbero")) return "Líberos";
    return "Otros";
  };

  let groupedPlayers = {};
  if (groupBy === "posicion") {
    // Inicializamos los 5 buckets vacíos para mantener el orden
    CATEGORIAS_PRINCIPALES.forEach(cat => groupedPlayers[cat] = []);
    groupedPlayers["Sin Posición"] = [];

    displayPlayers.forEach(p => {
      // Solo tomamos la primera posición (Principal)
      const posPrincipal = p.posicion && p.posicion.length > 0 ? p.posicion[0] : null;
      const cat = getCategoriaName(posPrincipal);
      if (groupedPlayers[cat]) groupedPlayers[cat].push(p);
    });

    // Limpiamos las listas vacías para que no estorben
    Object.keys(groupedPlayers).forEach(k => {
      if (groupedPlayers[k].length === 0) delete groupedPlayers[k];
    });
  } else {
    groupedPlayers = { "Todos los Jugadores": displayPlayers };
  }

  const promEdad = players.length ? Math.round(players.reduce((acc, p) => acc + (Number(calcularEdad(p?.fecha_nacimiento)) || 0), 0) / players.length) : 0;

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-[#FDFDFE] dark:bg-[#030611] text-[#1F2937] dark:text-[#E5E7EB] font-sans pb-20 transition-colors">
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#030611]/95 border-b border-[#E5E7EB] dark:border-[#1E293B] p-4 transition-colors">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-black font-display text-[#1E40AF] dark:text-white tracking-tighter flex items-center gap-2"><div className="bg-[#1E40AF] p-1.5 rounded-lg"><Icon name="volleyball" className="w-5 h-5 text-white"/></div> CLUB UNION VOLEY</h1>
            <div className="flex bg-[#F3F4F6] dark:bg-[#0B1120] p-1 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B]">
                <button onClick={() => setCurrentView("plantel")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentView === "plantel" ? "bg-[#1E40AF] text-white shadow-sm" : "text-[#6B7280] hover:text-[#111827] dark:hover:text-white"}`}>Plantel</button>
                <button onClick={() => setCurrentView("finanzas")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentView === "finanzas" ? "bg-[#1E40AF] text-white shadow-sm" : "text-[#6B7280] hover:text-[#111827] dark:hover:text-white"}`}>Finanzas</button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-[#F3F4F6] dark:bg-[#0B1120] text-[#1E40AF] rounded-xl hover:scale-105 transition-transform"><Icon name={isDarkMode?"sun":"moon"} className="w-5 h-5"/></button>
              <button onClick={abrirNuevo} className="px-4 py-2 bg-[#1E40AF] text-white font-bold rounded-xl flex items-center gap-2 shadow-lg hover:bg-[#1C3FAA] transition-colors"><Icon name="plus" className="w-4 h-4"/> <span className="hidden sm:block">Nuevo</span></button>
              <button onClick={handleLogout} className="p-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Cerrar sesión"><Icon name="close" className="w-5 h-5"/></button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6">
          {currentView === "plantel" && (
            <div style={{ animation: "fadeIn .35s ease" }}>
              <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
                <div className="flex gap-2">
                  <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 rounded-xl text-sm font-bold text-[#6B7280] shadow-sm transition-colors">Total: <span className="text-[#1E40AF] dark:text-white">{players.length}</span></div>
                  <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 rounded-xl text-sm font-bold text-[#6B7280] shadow-sm transition-colors">Edad: <span className="text-[#1E40AF] dark:text-white">{promEdad}</span></div>
                </div>
                <div className="flex gap-2 flex-1 sm:justify-end relative">
                  <div className="relative w-full sm:w-80 shadow-sm">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"/>
                    <input className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl outline-none focus:border-[#1E40AF] text-sm transition-colors" placeholder="Buscar jugador..." value={search} onChange={e=>setSearch(e.target.value)} />
                  </div>
                  <div className="relative">
                    <button onClick={()=>setShowFilterMenu(!showFilterMenu)} className="px-4 py-2.5 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#111827] shadow-sm transition-colors"><Icon name="filter" className="w-4 h-4"/> <span className="hidden sm:inline">Ordenar</span></button>
                    {showFilterMenu && (
                      <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] shadow-2xl rounded-xl p-4 z-40 transition-colors">
                        <p className="text-[10px] font-black text-gray-500 mb-2">ORDENAR POR</p>
                        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[#111827] dark:border-[#1E293B] border text-sm mb-2 outline-none transition-colors"><option value="nombre">Nombre</option><option value="edad">Edad</option></select>
                        <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[#111827] dark:border-[#1E293B] border text-sm mb-4 outline-none transition-colors"><option value="asc">Ascendente (A-Z)</option><option value="desc">Descendente (Z-A)</option></select>
                        <p className="text-[10px] font-black text-gray-500 mb-2">AGRUPAR POR</p>
                        <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[#111827] dark:border-[#1E293B] border text-sm outline-none transition-colors"><option value="none">Sin agrupar</option><option value="posicion">Posición</option></select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {loading ? <div className="py-20 flex justify-center"><Icon name="spinner" className="w-8 h-8 text-[#1E40AF]"/></div> : 
                Object.keys(groupedPlayers).map(group => (
                  <div key={group} className="mb-8">
                    {groupBy !== "none" && <h2 className="text-lg font-black mb-3 text-[#1E40AF] dark:text-[#60A5FA] border-b border-[#E5E7EB] dark:border-[#1E293B] pb-2 transition-colors">{group} <span className="text-gray-400 text-sm font-normal">({groupedPlayers[group].length})</span></h2>}
                    <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl overflow-hidden shadow-lg transition-colors">
                       {groupedPlayers[group].map(p => (
                         <div key={p.id} className="p-4 border-b border-[#F3F4F6] dark:border-[#1E293B] flex items-center justify-between hover:bg-[#F9FAFB] dark:hover:bg-[#111827] transition-colors cursor-pointer" onClick={()=>{setViewingPlayer(p)}}>
                           <div className="flex items-center gap-4">
                             <StatusDot status={p?.estado} />
                             <div className="w-11 h-11 rounded-full bg-[#F3F4F6] dark:bg-[#1E293B] overflow-hidden hidden sm:block shadow-sm">
                               {(p?.foto_perfil_url || p?.foto_url) ? <img src={p.foto_perfil_url || p.foto_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Icon name="user" className="w-5 h-5 text-gray-400"/></div>}
                             </div>
                             <div>
                               <p className="font-bold text-[#111827] dark:text-white text-sm group-hover:text-[#1E40AF] transition-colors">{p?.nombre_completo}</p>
                               <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">{p?.rut} • {calcularEdad(p?.fecha_nacimiento)} años {p?.posicion && `• ${p.posicion}`}</p>
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <button className="px-3 py-1.5 text-sm font-bold text-[#1E40AF] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 rounded-lg hover:bg-[#DBEAFE] transition-colors">Ver Perfil</button>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
              ))}
            </div>
          )}

          {currentView === "finanzas" && (
            <div style={{ animation: "fadeIn .35s ease" }}>
              <FinanceView players={players} trimestre={trimestre} setTrimestre={setTrimestre} pagosTrimestre={pagosTrimestre} comprasTrimestre={comprasTrimestre} loadingFinanzas={loadingFinanzas} onSavePago={handleSavePago} onSaveCompra={handleSaveCompra} onDeleteCompra={handleDeleteCompra} onQuickPay={setPaymentModalConfig} />
            </div>
          )}
        </main>

        <PlayerFormPanel show={showForm} editingId={editingId} form={form} setForm={setForm} errors={errors} setErrors={setErrors} previews={photoPreviews} onPhotoChange={handlePhotoChange} onSubmit={handleSaveJugador} onClose={() => setShowForm(false)} submitting={submitting} />
        
        {/* Modal de Detalles (Actualizado sin OnSavePago ya que es Solo Lectura) */}
        <PlayerDetailsModal player={viewingPlayer} onClose={() => setViewingPlayer(null)} onEdit={abrirEdicion} onDelete={setDeleteConfirm} pagos={pagosJugadorModal} pagosLoading={loadingPagosModal} historial={historialJugadorModal} historialLoading={loadingHistorial} />
        
      {/* EL NUEVO MODAL DE PAGOS */}
        <PaymentModal config={paymentModalConfig} trimestreActual={trimestre} onClose={() => setPaymentModalConfig(null)} onSave={handleSavePago} onDelete={handleDeletePago} />

        <DeleteModal player={deleteConfirm} onConfirm={handleSoftDelete} onCancel={() => setDeleteConfirm(null)} />
        <Toast toast={toast} />
      </div>
    </div>
  );
}