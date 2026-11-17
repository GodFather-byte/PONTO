// Peças visuais reaproveitadas em todas as telas (botões grandes, campos, cartões)
import { useNavigate } from 'react-router-dom';
import { paraNumero } from '../lib/formato.js';

// Moldura da tela: barra no topo com título e botão de voltar
export function Tela({ titulo, voltar, acao, children }) {
  const navegar = useNavigate();
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-slate-900 px-3 py-3 text-white shadow">
        {voltar && (
          <button onClick={() => (voltar === true ? navegar(-1) : navegar(voltar))}
            className="-ml-1 rounded-lg px-3 py-2 text-2xl leading-none active:bg-slate-700" aria-label="Voltar">‹</button>
        )}
        <h1 className="flex-1 truncate text-lg font-semibold">{titulo}</h1>
        {acao}
      </header>
      <main className="flex-1 space-y-4 p-3 pb-10">{children}</main>
    </div>
  );
}

const CORES = {
  primario: 'bg-emerald-600 text-white active:bg-emerald-700',
  escuro: 'bg-slate-900 text-white active:bg-slate-700',
  claro: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
  perigo: 'bg-red-600 text-white active:bg-red-700',
};

export function Botao({ cor = 'primario', className = '', ...props }) {
  return (
    <button type="button" {...props}
      className={`min-h-14 w-full rounded-xl px-4 text-lg font-semibold shadow-sm disabled:opacity-50 ${CORES[cor]} ${className}`} />
  );
}

export function Cartao({ className = '', ...props }) {
  return <div {...props} className={`rounded-xl bg-white p-4 shadow-sm ${className}`} />;
}

const ESTILO_CAMPO = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 focus:border-emerald-600 focus:outline-none';

export function Campo({ rotulo, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-slate-600 ${className}`}>
      {rotulo}
      <input {...props} className={ESTILO_CAMPO} />
    </label>
  );
}

// Campo de valor em reais / contador: teclado numérico e aviso se o valor for inválido
export function CampoValor({ rotulo, value, onChange, className = '', ...props }) {
  const invalido = value !== '' && paraNumero(value) === null;
  return (
    <label className={`block text-sm font-medium text-slate-600 ${className}`}>
      {rotulo}
      <input {...props} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        className={`${ESTILO_CAMPO} text-right text-lg font-semibold tabular-nums ${invalido ? 'border-red-500' : ''}`} />
    </label>
  );
}

export function Selecao({ rotulo, children, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-slate-600 ${className}`}>
      {rotulo}
      <select {...props} className={ESTILO_CAMPO}>{children}</select>
    </label>
  );
}

export function Marcador({ rotulo, checked, onChange }) {
  return (
    <label className="flex min-h-12 items-center gap-3 text-base">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 accent-emerald-600" />
      {rotulo}
    </label>
  );
}

const TONS = { erro: 'bg-red-50 text-red-800 border-red-200', alerta: 'bg-amber-50 text-amber-900 border-amber-200', ok: 'bg-emerald-50 text-emerald-900 border-emerald-200' };
export function Aviso({ tom = 'alerta', children }) {
  return children ? <div className={`rounded-lg border px-3 py-2 text-sm ${TONS[tom]}`}>{children}</div> : null;
}

// Linha "rótulo ........ valor"
export function Linha({ rotulo, valor, forte }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${forte ? 'text-lg font-bold' : ''}`}>
      <span className="text-slate-600">{rotulo}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}
