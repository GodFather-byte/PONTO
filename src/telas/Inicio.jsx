// Tela inicial: botões grandes e aviso de leituras esperando sinal
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessao } from '../lib/sessao.jsx';
import { listarFila, aoMudarFila, sincronizar } from '../lib/fila.js';
import InstalarApp from '../componentes/InstalarApp.jsx';
import { Tela, Botao, Aviso } from '../componentes/ui.jsx';

export default function Inicio() {
  const { perfil, sair } = useSessao();
  const navegar = useNavigate();
  const [fila, setFila] = useState([]);

  useEffect(() => {
    const atualizar = () => listarFila().then(setFila);
    atualizar();
    return aoMudarFila(atualizar);
  }, []);

  const comErro = fila.filter((i) => i.erro).length;
  return (
    <Tela titulo="Controle de Máquinas">
      <p className="px-1 text-slate-600">Olá, {perfil.nome || perfil.email}</p>

      {fila.length > 0 && (
        <Aviso tom={comErro ? 'erro' : 'alerta'}>
          <div className="flex items-center justify-between gap-2">
            <span>
              {fila.length} leitura(s) guardada(s) no aparelho, esperando envio.
              {comErro > 0 && ` ${comErro} com erro — abra em "Leituras" para ver.`}
            </span>
            <button onClick={sincronizar} className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white">Enviar</button>
          </div>
        </Aviso>
      )}

      <Botao onClick={() => navegar('/leitura')} className="min-h-24 text-2xl">Nova leitura</Botao>
      <Botao cor="escuro" onClick={() => navegar('/leituras')}>Leituras</Botao>
      <Botao cor="escuro" onClick={() => navegar('/pagamentos')}>Pagamentos aos pontos</Botao>

      {perfil.papel === 'admin' && <>
        <Botao cor="escuro" onClick={() => navegar('/painel')}>Painel</Botao>
        <Botao cor="escuro" onClick={() => navegar('/analises')}>Análises</Botao>
        <h2 className="px-1 pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Cadastros</h2>
        <Botao cor="claro" onClick={() => navegar('/pontos')}>Pontos</Botao>
        <Botao cor="claro" onClick={() => navegar('/maquinas')}>Máquinas</Botao>
        <Botao cor="claro" onClick={() => navegar('/usuarios')}>Usuários</Botao>
      </>}

      <InstalarApp />
      <button onClick={sair} className="mx-auto block py-4 text-slate-500 underline">Sair</button>
    </Tela>
  );
}
