import { useState } from "react";
import { Icon } from "../components/Icon";

const ZONAS = [4, 3, 2, 5, 6, 1]; // Orden visual (Red arriba)
const CATS = [
  { nombre: "Armadores", sigla: "A", color: "#3b82f6" },
  { nombre: "Puntas", sigla: "PU", color: "#ef4444" },
  { nombre: "Centros", sigla: "CE", color: "#10b981" },
  { nombre: "Opuestos", sigla: "OP", color: "#f59e0b" },
  { nombre: "Líberos", sigla: "LB", color: "#8b5cf6" }
];

export function TacticalBoardView({ players }) {
  const [lineup, setLineup] = useState({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  // Estado de asistencia local (Solo para el partido actual)
  const [asistencia, setAsistencia] = useState(
    players.reduce((acc, p) => ({ ...acc, [p.id]: p.estado === 'activo' }), {})
  );

  const presentes = players.filter(p => asistencia[p.id]);
  const ausentes = players.filter(p => !asistencia[p.id]);

  const handleZoneClick = (zona) => {
    if (selectedPlayer) {
      // Si el jugador ya estaba en otra zona, lo movemos
      const newLineup = { ...lineup };
      Object.keys(newLineup).forEach(k => {
        if (newLineup[k]?.id === selectedPlayer.id) newLineup[k] = null;
      });
      newLineup[zona] = selectedPlayer;
      setLineup(newLineup);
      setSelectedPlayer(null);
    } else if (lineup[zona]) {
      // Quitar de la cancha
      setLineup({ ...lineup, [zona]: null });
    }
  };

  const isPlayerOnCourt = (id) => Object.values(lineup).some(p => p?.id === id);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* PANEL IZQUIERDO */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        
        <div className="bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-4 shadow-sm">
          <h3 className="font-black text-[#1E40AF] dark:text-[#60A5FA] mb-4">PRESENTES</h3>
          
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
            {CATS.map(cat => {
              // Filtrar jugadores que tengan esta categoría en su array de posiciones
              const enEstaCat = presentes.filter(p => p.posicion && p.posicion.some(pos => pos.includes(cat.sigla)));
              if (enEstaCat.length === 0) return null;

              return (
                <div key={cat.nombre}>
                  <h4 className="text-xs font-bold text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">{cat.nombre.toUpperCase()}</h4>
                  <div className="space-y-1.5">
                    {enEstaCat.map(p => {
                      const onCourt = isPlayerOnCourt(p.id);
                      // Revisamos si fue seleccionado desde ESTA lista en específico
                      const isSelected = selectedPlayer?.id === p.id && selectedPlayer?.rolJugado === cat.sigla;
                      // Revisamos si está en cancha y está jugando ESTA posición
                      const isPlayingThisRole = Object.values(lineup).some(c => c?.id === p.id && c?.rolJugado === cat.sigla);

                      return (
                        <div 
                          key={`${p.id}-${cat.sigla}`} 
                          onClick={() => !onCourt && setSelectedPlayer(isSelected ? null : { ...p, rolJugado: cat.sigla, color: cat.color })}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer
                            ${onCourt ? 
                               (isPlayingThisRole ? 'border-[#1E40AF] bg-[#EFF6FF] dark:bg-[#1E3A8A]/20 shadow-inner' : 'opacity-30 grayscale border-transparent line-through') 
                            : isSelected ? 'border-[#1E40AF] bg-[#EFF6FF] shadow-md ring-1 ring-[#1E40AF]' 
                            : 'border-[#E5E7EB] dark:border-[#1E293B] hover:border-gray-300 dark:bg-[#111827]'}`}
                        >
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setAsistencia(prev => ({...prev, [p.id]: false})) }} className="w-3 h-3 rounded-full bg-emerald-500 hover:scale-125 transition-transform" title="Marcar ausente"></button>
                            <span className="font-bold text-sm dark:text-white truncate max-w-[160px]">{p.nombre_completo.split(" ")[0]} {p.nombre_completo.split(" ")[1]||""}</span>
                          </div>
                          <input 
                            type="number" 
                            className="w-10 text-center text-xs font-mono bg-slate-100 dark:bg-slate-800 border-none rounded p-1 outline-none" 
                            placeholder="#" 
                            onClick={e=>e.stopPropagation()}
                            onChange={(e) => {
                              p.numero_temporal = e.target.value; // Guardamos el número temporal en el objeto del jugador
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* AUSENTES */}
        <div className="bg-gray-50 dark:bg-[#030611] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-4">
          <h3 className="font-bold text-gray-500 mb-3 text-sm">AUSENTES</h3>
          <div className="space-y-1.5 max-h-[15vh] overflow-y-auto">
            {ausentes.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer" onClick={() => setAsistencia(prev => ({...prev, [p.id]: true}))}>
                 <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-emerald-500 transition-colors"></div>
                 <span className="text-xs text-gray-500">{p.nombre_completo}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CANCHA */}
      <div className="flex-1 bg-white dark:bg-[#0B1120] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center relative">
        <div className="absolute top-4 text-center w-full">
          {selectedPlayer ? (
            <p className="text-sm font-bold text-white bg-[#1E40AF] py-2 px-4 rounded-full inline-block animate-bounce shadow-lg">
              Toca una zona para ubicar a {selectedPlayer.nombre_completo.split(" ")[0]} ({selectedPlayer.rolJugado})
            </p>
          ) : (
            <p className="text-sm text-gray-400">Selecciona un jugador presente para armar el sexteto</p>
          )}
        </div>

        <div className="w-full max-w-[400px] aspect-[4/3] bg-[#E87948] border-4 border-white ring-8 ring-[#1E40AF] rounded-sm relative mt-8 flex flex-col shadow-2xl">
          <div className="absolute -top-3 -left-4 -right-4 h-3 bg-gray-200 border-x-4 border-gray-400 flex items-center justify-evenly opacity-80 z-10">
             {[...Array(15)].map((_, i) => <div key={i} className="w-px h-full bg-gray-400"></div>)}
          </div>
          <div className="absolute top-[33%] left-0 right-0 border-b-4 border-white/70 border-dashed"></div>

          <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 p-2">
            {ZONAS.map(zona => {
              const jugador = lineup[zona];
              
              return (
                <div key={zona} onClick={() => handleZoneClick(zona)} className={`relative flex items-center justify-center rounded-xl transition-all ${selectedPlayer ? 'hover:bg-white/20 cursor-pointer' : ''} ${!jugador && !selectedPlayer ? 'cursor-default' : 'cursor-pointer'}`}>
                  {!jugador && <span className="text-4xl font-black text-white/30 select-none">{zona}</span>}

                  {jugador && (
                    <div className="absolute flex flex-col items-center transform transition-transform hover:scale-110 z-20">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white relative" style={{ backgroundColor: jugador.color }}>
                        {jugador.numero_temporal || '?'}
                        <div className="absolute -bottom-2 -right-2 bg-white text-black text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm border border-gray-200">
                          {jugador.rolJugado}
                        </div>
                      </div>
                      <span className="mt-1 text-[11px] font-bold text-white bg-black/60 px-2 py-0.5 rounded backdrop-blur-md">
                        {jugador.nombre_completo.split(" ")[0]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}