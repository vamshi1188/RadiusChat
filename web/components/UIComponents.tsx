import React from 'react';

// Made children optional to avoid TS errors when used in JSX where children might appear missing to the compiler
export const NeonCard = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <div className={`bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-lg shadow-black/50 rounded-xl p-6 relative overflow-hidden ${className}`}>
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-75"></div>
    {children}
  </div>
);

export const NeonButton = ({ onClick, children, variant = 'primary', disabled = false, className = '' }: any) => {
  const baseStyle = "relative font-bold py-2 px-4 rounded transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm";
  
  const variants: any = {
    primary: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.4)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] border border-cyan-400",
    secondary: "bg-transparent border border-pink-500 text-pink-400 hover:bg-pink-500/10 hover:shadow-[0_0_10px_rgba(236,72,153,0.4)]",
    danger: "bg-red-900/50 border border-red-500 text-red-400 hover:bg-red-800/50",
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const NeonInput = ({ value, onChange, placeholder, disabled, onKeyDown }: any) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    disabled={disabled}
    placeholder={placeholder}
    className="w-full bg-slate-800/50 border border-slate-600 text-cyan-100 placeholder-slate-500 rounded px-4 py-3 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
  />
);

export const Badge = ({ status }: { status: string }) => {
  const colors: any = {
    idle: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    requesting: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    chatting: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    offline: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
  };
  
  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${colors[status] || colors.offline}`}>
      {status}
    </span>
  );
};