import { useState } from "react";
import { Icon } from "../components/Icon";

const ZONAS = [4, 3, 2, 5, 6, 1]; 
const CATS = [
  { nombre: "Armadores", sigla: "A", color: "#3b82f6" },
  { nombre: "Puntas", sigla: "PU", color: "#ef4444" },
  { nombre: "Centros", sigla: "CE", color: "#10b981" },
  { nombre: "Opuestos", sigla: "OP", color: "#f59e0b" },
  { nombre: "Líberos", sigla: "LB", color: "#8b5cf6" }
];

const FORMACION_BASE = {
  1: { 1: 'A', 2: 'PU', 3: 'CE', 4: 'OP', 5: 'PU', 6: 'CE/LB' },
  2: { 1: 'CE/LB', 2: 'A', 3: 'PU', 4: 'CE', 5: 'OP', 6: 'PU' },
  3: { 1: 'PU', 2: 'CE/LB', 3: 'A', 4: 'PU', 5: 'CE', 6: 'OP' },
  4: { 1: 'OP', 2: 'PU', 3: 'CE/LB', 4: 'A', 5: 'PU', 6: 'CE' },
  5: { 1: 'CE', 2: 'OP', 3: 'PU', 4: 'CE/LB', 5: 'A', 6: 'PU' },
  6: { 1: 'PU', 2: 'CE', 3: 'OP', 4: 'PU', 5: 'CE/LB', 6: 'A' },
};

export function TacticalBoardView({ players, lineup, setLineup, isServing, setIsServing, numeros, setNumeros, asistencia, setAsistencia }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isGrouped, setIsGrouped] = useState(false); // ESTADO PARA VER AGRUPADO O LISTA COMPLETA

  const presentes = players.filter(p => p.estado !== 'inactivo' && asistencia[p.id]);
  const ausentes = players.filter(p => p.estado !== 'inactivo' && !asistencia[p.id]);

  const counts = { PU: 0, CE: 0, LB: 0, A: 0, OP: 0 };
  let zonaArmador = null;

  Object.entries(lineup).forEach(([zona, p]) => {
    if (p) {
      if (counts[p.rolJugado] !== undefined) counts[p.rolJugado]++;
      if (p.rolJugado === 'A') zonaArmador = parseInt(zona);
    }
  });

  const siluetas = zonaArmador ? FORMACION_BASE[zonaArmador] : null;
  const hasArmador = zonaArmador !== null;

  // Lógica Tap & Place
  const handleZoneClick = (zona) => {
    if (selectedPlayer) {
      const newLineup = { ...lineup };
      Object.keys(newLineup).forEach(k => {
        if (newLineup[k]?.id === selectedPlayer.id) newLineup[k] = null;
      });
      newLineup[zona] = selectedPlayer;
      setLineup(newLineup);
      setSelectedPlayer(null);
    } else if (lineup[zona]) {
      setLineup({ ...lineup, [zona]: null }); 
    }
  };

  const resetCancha = () => {
    if(window.confirm("¿Sacar a todos los jugadores de la cancha?")) {
      setLineup({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
      setSelectedPlayer(null);
    }
  };

  const isPlayerOnCourt = (id) => Object.values(lineup).some(p => p?.id === id);

  // Manejador estricto de números únicos de camiseta
  const handleNumChange = (id, val) => {
    const valClean = val.replace(/\D/g, ''); 
    setNumeros(prev => {
      const newState = { ...prev };
      // Si ingresa un número, borrarlo de cualquier otro jugador que lo tenga
      if (valClean !== "") {
        Object.keys(newState).forEach(k => {
          if (newState[k] === valClean) newState[k] = "";
        });
      }
      newState[id] = valClean;
      return newState;
    });
  };

  // Alternar Asistencia con switch
  const toggleAsistencia = (id, estado) => {
    setAsistencia(prev => ({ ...prev, [id]: estado }));
    if (!estado) {
      setLineup(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (next[k]?.id === id) next[k] = null; });
        return next;
      });
      if (selectedPlayer?.id === id) setSelectedPlayer(null);
    }
  };

  // Función reutilizable para renderizar el bloque de cada jugador
  const renderPlayerRow = (p) => {
    const siglaPrincipal = p.posicion && p.posicion.length > 0 ? p.posicion[0].split(" - ")[0] : "??";
    const colorCat = CATS.find(c => c.sigla === siglaPrincipal)?.color || "#6B7280";
    const onCourt = isPlayerOnCourt(p.id);
    const isSelected = selectedPlayer?.id === p.id;
    const rolesSecundarios = p.posicion ? p.posicion.slice(1).map(pos => pos.split(" - ")[0]) : [];

    // REGLA: Bloquear a los que NO son armadores si aún no hay un armador en cancha.
    const isLocked = !hasArmador && siglaPrincipal !== 'A';

    return (
      <div 
        key={p.id} 
        onClick={() => {
          if (!onCourt && !isLocked) {
            setSelectedPlayer(isSelected ? null : { ...p, rolJugado: siglaPrincipal, color: colorCat, numCamiseta: numeros[p.id] || '?' });
          }
        }}
        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer shadow-sm
          ${isLocked && !onCourt ? 'opacity-50 grayscale bg-slate-50 dark:bg-slate-900 cursor-not-allowed border-transparent' : ''}
          ${onCourt ? 'opacity-40 border-transparent bg-slate-50 dark:bg-slate-900 line-through pointer-events-none' 
          : isSelected ? 'border-[#1E40AF] bg-[#EFF6FF] dark:bg-[#1E3A8A]/20 ring-2 ring-[#1E40AF]' 
          : !isLocked ? 'border-[#E5E7EB] dark:border-[#1E293B] hover:border-slate-300 dark:bg-[#111827] bg-white dark:bg-slate-800' : 'bg-white dark:bg-slate-800'}`}
      >
        <div className="flex flex-col gap-1.5 w-full mr-2 overflow-hidden pl-1">
          <div className="flex items-center gap-3">
            {/* TOGGLE SWITCH - ON (Presente) */}
            <div onClick={(e) => { e.stopPropagation(); toggleAsistencia(p.id, false); }} className="w-9 h-5 bg-emerald-500 rounded-full relative flex items-center px-0.5 cursor-pointer flex-shrink-0 transition-colors shadow-inner" title="Mover a ausentes">
              <div className="w-4 h-4 bg-white rounded-full shadow-sm transform translate-x-4 transition-transform"></div>
            </div>
            
            <span className="font-bold text-[13px] sm:text-sm dark:text-white truncate">
              {p.nombre_completo.split(" ")[0]} {p.nombre_completo.split(" ")[1]||""}
            </span>
            
            {/* Badge de posición principal si estamos en vista de lista plana */}
            {!isGrouped && (
              <span className="text-[10px] font-black text-white px-2 py-0.5 rounded shadow-sm ml-1" style={{backgroundColor: colorCat}}>{siglaPrincipal}</span>
            )}
          </div>

          {/* Badges Visuales de Roles Secundarios */}
          {rolesSecundarios.length > 0 && (
            <div className="flex gap-1.5 pl-12">
              {rolesSecundarios.map(sec => (
                <span key={sec} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 uppercase">
                  {sec}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* INPUT DE CAMISETA CIRCULAR Y GRANDE */}
        <input 
          type="text" 
          maxLength="2"
          className={`w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-full text-center text-base sm:text-lg font-black outline-none transition-all border-2 shadow-inner 
            ${isSelected ? 'bg-white border-[#1E40AF] text-[#1E40AF] scale-105' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-white focus:border-emerald-400 focus:bg-white'}`} 
          placeholder="#" 
          value={numeros[p.id] || ''}
          onClick={e => e.stopPropagation()}
          onChange={e => handleNumChange(p.id, e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      
      {/* --- PANEL IZQUIERDO: JUGADORES --- */}
      <div className="w-full lg:w-[350px] flex flex-col gap-4">
        
        {/* PRESENTES */}
        <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-[#1E40AF] dark:text-[#60A5FA] flex items-center gap-2">
              PRESENTES <span className="bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#1E40AF] px-2 py-0.5 rounded-lg text-xs font-bold shadow-sm">{presentes.length}</span>
            </h3>
            {/* BOTÓN PARA ALTERNAR VISTA AGRUPADA O PLANA */}
            <button onClick={() => setIsGrouped(!isGrouped)} className="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1">
              <Icon name="filter" className="w-3 h-3"/> {isGrouped ? "Ver Lista Completa" : "Agrupar por Rol"}
            </button>
          </div>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
            
            {/* VISTA 1: LISTA COMPLETA SIN AGRUPAR */}
            {!isGrouped && (
              <div className="space-y-2">
                {presentes.map(p => renderPlayerRow(p))}
              </div>
            )}

            {/* VISTA 2: AGRUPADOS POR ROL PRINCIPAL */}
            {isGrouped && CATS.map(cat => {
              const enEstaCat = presentes.filter(p => p.posicion && p.posicion.length > 0 && p.posicion[0].includes(cat.sigla));
              if (enEstaCat.length === 0) return null;

              return (
                <div key={cat.nombre} className="transition-all">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                    {cat.nombre}
                  </h4>
                  <div className="space-y-2">
                    {enEstaCat.map(p => renderPlayerRow(p))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* AUSENTES */}
        <div className="bg-slate-50 dark:bg-[#030611] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-4 shadow-inner">
          <h3 className="font-bold text-slate-400 mb-3 text-xs uppercase tracking-widest flex justify-between items-center">
            Ausentes <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg">{ausentes.length}</span>
          </h3>
          <div className="space-y-2 max-h-[20vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {ausentes.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-all shadow-sm" onClick={() => toggleAsistencia(p.id, true)}>
                 {/* TOGGLE SWITCH - OFF (Ausente) */}
                 <div className="w-9 h-5 bg-slate-300 dark:bg-slate-600 rounded-full relative flex items-center px-0.5 cursor-pointer flex-shrink-0 transition-colors shadow-inner" title="Mover a presentes">
                   <div className="w-4 h-4 bg-white rounded-full shadow-sm transform translate-x-0 transition-transform"></div>
                 </div>
                 <span className="text-xs font-semibold text-slate-500 truncate">{p.nombre_completo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- PANEL DERECHO: LA CANCHA --- */}
      <div className="flex-1 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col items-center relative overflow-hidden">
        
        {/* Contadores */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl w-full max-w-lg border border-slate-100 dark:border-slate-800 shadow-sm">
          {[
            { label: "Puntas", count: counts.PU, total: 2 },
            { label: "Centrales", count: counts.CE, total: 2 },
            { label: "Opuesto", count: counts.OP, total: 1 },
            { label: "Armador", count: counts.A, total: 1 },
            { label: "Líbero", count: counts.LB, total: 1 }
          ].map(c => (
            <div key={c.label} className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${c.count === c.total ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
              {c.label}: <span className={c.count === c.total ? '' : 'text-slate-900 dark:text-white'}>{c.count}/{c.total}</span>
            </div>
          ))}
        </div>

        {/* Controles Superiores */}
        <div className="flex justify-between items-end w-full max-w-[400px] mb-3 px-2">
          <button onClick={() => setIsServing(!isServing)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm ${isServing ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-sky-100 text-sky-700 border border-sky-300'}`}>
            {isServing ? "🏐 Equipo al Saque" : "🤲 Equipo en Recepción"}
          </button>
          <button onClick={resetCancha} className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-transparent hover:border-red-200">
            <Icon name="trash" className="w-3.5 h-3.5"/> Reiniciar
          </button>
        </div>

        {/* Cancha 2D */}
        <div className="w-full max-w-[400px] aspect-[4/3] bg-[#E87948] border-[6px] border-white ring-8 ring-[#1E40AF] rounded-sm relative flex flex-col shadow-2xl mb-8">
          <div className="absolute -top-3.5 -left-4 -right-4 h-4 bg-slate-200 border-x-[5px] border-slate-400 flex items-center justify-evenly opacity-90 z-10 shadow-sm">
             {[...Array(18)].map((_, i) => <div key={i} className="w-[1.5px] h-full bg-slate-400"></div>)}
          </div>
          <div className="absolute top-[33%] left-0 right-0 border-b-[5px] border-white/60 border-dashed"></div>

          <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 p-2">
            {ZONAS.map(zona => {
              const jugador = lineup[zona];
              const sugerencia = (!jugador && siluetas) ? siluetas[zona] : null;
              
              return (
                <div key={zona} onClick={() => handleZoneClick(zona)} className={`relative flex items-center justify-center rounded-xl transition-all ${selectedPlayer ? 'hover:bg-white/20 cursor-pointer ring-2 ring-white/50' : ''} ${!jugador && !selectedPlayer ? 'cursor-default' : 'cursor-pointer'}`}>
                  
                  {/* Silueta Sugerida (Ghost) */}
                  {!jugador && sugerencia && (
                    <div className="absolute inset-2 border-[3px] border-dashed border-white/40 rounded-full flex flex-col items-center justify-center bg-white/5 animate-pulse">
                      <span className="text-white/60 font-black text-xs sm:text-sm">{sugerencia}</span>
                    </div>
                  )}

                  {/* Número de zona (Fondo) */}
                  {!jugador && !sugerencia && <span className="text-5xl font-black text-white/20 select-none">{zona}</span>}

                  {/* Jugador en Cancha */}
                  {jugador && (
                    <div className="absolute flex flex-col items-center transform transition-transform hover:scale-110 z-20">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-xl border-[3px] border-white relative" style={{ backgroundColor: jugador.color }}>
                        {jugador.numCamiseta}
                        <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-white text-slate-900 text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-lg shadow-md border-2 border-slate-200">
                          {jugador.rolJugado}
                        </div>
                      </div>
                      <span className="mt-1.5 text-[10px] sm:text-xs font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-md backdrop-blur-md shadow-sm truncate max-w-[80px] sm:max-w-[100px] text-center border border-slate-700/50">
                        {jugador.nombre_completo.split(" ")[0]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Instrucciones Condicionales */}
        {selectedPlayer ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-max">
            <p className="text-sm font-bold text-white bg-[#1E40AF] py-2 px-6 rounded-full shadow-2xl animate-bounce border-2 border-white/20">
              Toca una zona para ubicar a {selectedPlayer.nombre_completo.split(" ")[0]}
            </p>
          </div>
        ) : (
          !hasArmador && presentes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-max">
              <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 py-2 px-6 rounded-full shadow-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                ⚠️ Debes colocar al Armador primero en la cancha
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}