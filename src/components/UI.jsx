import { Icon } from "./Icon";

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ animation: "slideUp .3s ease" }} className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold pointer-events-none ${toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
      <Icon name={toast.type === "error" ? "warning" : "check"} className="w-4 h-4 flex-shrink-0" /> {toast.message}
    </div>
  );
}

export const StatusDot = ({ status }) => {
  const colors = { activo: "bg-emerald-500", inactivo: "bg-red-500", congelado: "bg-sky-500" };
  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${colors[status || 'activo']}`} title={status} />;
};