// Tutorial de instalação: reconhece se é Android ou iPhone e mostra o passo a passo certo.
// Some sozinho quando o app já está instalado. "Agora não" recolhe para um link pequeno.
import { useEffect, useState } from 'react';
import { instalado, plataforma, safariNoIphone, dentroDeOutroApp, temConvite, aoMudarConvite, instalarAgora } from '../lib/instalar.js';

const CHAVE = 'instalar-dispensado';

// Desenho do botão "Compartilhar" do iPhone (quadrado com seta para cima)
const IconeCompartilhar = () => (
  <svg viewBox="0 0 24 24" className="mx-1 inline h-6 w-6 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Compartilhar">
    <path d="M12 15V3M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
);

function Passos({ itens }) {
  return (
    <ol className="space-y-3">
      {itens.map((texto, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">{i + 1}</span>
          <span className="pt-1 text-base leading-snug">{texto}</span>
        </li>
      ))}
    </ol>
  );
}

export default function InstalarApp() {
  const [aberto, setAberto] = useState(() => localStorage.getItem(CHAVE) !== '1');
  const [convite, setConvite] = useState(temConvite());
  const [pronto, setPronto] = useState(false);
  useEffect(() => aoMudarConvite(() => setConvite(temConvite())), []);

  if (instalado()) return null;
  const aparelho = plataforma();
  const nome = { iphone: 'iPhone', android: 'Android', computador: 'computador' }[aparelho];

  if (pronto) {
    return <div className="rounded-xl bg-emerald-50 p-4 text-center font-semibold text-emerald-900">App instalado! Procure o ícone "Máquinas" na tela inicial do celular.</div>;
  }
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="mx-auto block py-2 text-sm font-medium text-emerald-700 underline">
        📲 Como instalar o app no {nome}
      </button>
    );
  }

  const dispensar = () => { localStorage.setItem(CHAVE, '1'); setAberto(false); };

  return (
    <section className="space-y-4 rounded-xl border-2 border-emerald-600 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">📲 Instale o app no seu {nome}</h2>
        <p className="text-sm text-slate-600">Fica com ícone na tela inicial, abre em tela cheia e funciona mesmo com internet ruim.</p>
      </div>

      {dentroDeOutroApp() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Você abriu este link dentro de outro aplicativo. Toque nos três pontinhos e escolha
          <b> "Abrir no {aparelho === 'iphone' ? 'Safari' : 'Chrome'}"</b> antes de instalar.
        </div>
      )}

      {aparelho === 'android' && (convite ? (
        <>
          <button onClick={async () => setPronto(await instalarAgora())}
            className="min-h-14 w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white shadow-sm active:bg-emerald-700">
            Instalar agora
          </button>
          <p className="text-sm text-slate-600">Vai aparecer uma janela do Android: toque em <b>Instalar</b>.</p>
        </>
      ) : (
        <Passos itens={[
          <>Abra este endereço no <b>Chrome</b>.</>,
          <>Toque nos <b>três pontinhos ⋮</b> no canto de cima, à direita.</>,
          <>Toque em <b>"Instalar app"</b> (em alguns aparelhos aparece <b>"Adicionar à tela inicial"</b>).</>,
          <>Confirme em <b>Instalar</b>. O ícone <b>"Máquinas"</b> aparece na tela inicial.</>,
        ]} />
      ))}

      {aparelho === 'iphone' && (
        <Passos itens={safariNoIphone() ? [
          <>Toque no botão <b>Compartilhar</b><IconeCompartilhar />, na barra de baixo do Safari.</>,
          <>Role a lista para baixo e toque em <b>"Adicionar à Tela de Início"</b>.</>,
          <>Toque em <b>Adicionar</b>, no canto de cima. O ícone <b>"Máquinas"</b> aparece na tela inicial.</>,
        ] : [
          <>Toque no botão <b>Compartilhar</b><IconeCompartilhar />, no canto de cima, ao lado do endereço.</>,
          <>Role a lista para baixo e toque em <b>"Adicionar à Tela de Início"</b>.</>,
          <>Toque em <b>Adicionar</b>. Se a opção não aparecer, abra este endereço no <b>Safari</b> e repita.</>,
        ]} />
      )}

      {aparelho === 'computador' && (convite ? (
        <button onClick={async () => setPronto(await instalarAgora())}
          className="min-h-14 w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white shadow-sm">Instalar agora</button>
      ) : (
        <Passos itens={[
          <>No <b>celular</b>, abra este mesmo endereço: o passo a passo certo para Android ou iPhone aparece aqui.</>,
          <>No computador (Chrome ou Edge), clique no ícone de <b>instalar</b> no fim da barra de endereço.</>,
        ]} />
      ))}

      <button onClick={dispensar} className="block w-full py-1 text-center text-sm text-slate-500 underline">Agora não</button>
    </section>
  );
}
