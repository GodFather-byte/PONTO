// Rotas do app. O que cada pessoa enxerga depende do papel dela.
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { configurado } from './lib/supabase.js';
import { ProvedorSessao, useSessao } from './lib/sessao.jsx';
import { iniciarSincronizacao } from './lib/fila.js';
import { Tela, Cartao, Botao } from './componentes/ui.jsx';
import Login from './telas/Login.jsx';
import Inicio from './telas/Inicio.jsx';
import Pontos from './telas/Pontos.jsx';
import PontoForm from './telas/PontoForm.jsx';
import Maquinas from './telas/Maquinas.jsx';
import MaquinaForm from './telas/MaquinaForm.jsx';
import Usuarios from './telas/Usuarios.jsx';
import NovaLeitura from './telas/NovaLeitura.jsx';
import Leituras from './telas/Leituras.jsx';
import LeituraDetalhe from './telas/LeituraDetalhe.jsx';
import EditarLeitura from './telas/EditarLeitura.jsx';
import DonoInicio from './telas/DonoInicio.jsx';
import DonoLeitura from './telas/DonoLeitura.jsx';

function Mensagem({ titulo, children }) {
  const sessao = useSessao();
  return (
    <Tela titulo="Controle de Máquinas">
      <Cartao className="space-y-3">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <div className="text-slate-600">{children}</div>
      </Cartao>
      {sessao?.usuario && <Botao cor="claro" onClick={sessao.sair}>Sair</Botao>}
    </Tela>
  );
}

function Rotas() {
  const { usuario, perfil, carregando } = useSessao();
  const logado = Boolean(usuario);

  // Só começa a enviar a fila depois do login
  useEffect(() => { if (logado) iniciarSincronizacao(); }, [logado]);

  if (usuario === null) return <Login />;
  if (carregando) return <Mensagem titulo="Carregando…">Aguarde um instante.</Mensagem>;
  if (!perfil.ativo) return <Mensagem titulo="Acesso desativado">Fale com o administrador.</Mensagem>;

  // Dono do ponto: área só de visualização (e o botão "Conferido")
  if (perfil.papel === 'dono') {
    return (
      <Routes>
        <Route path="/" element={<DonoInicio />} />
        <Route path="/leituras/:id" element={<DonoLeitura />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const admin = perfil.papel === 'admin';
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/leitura" element={<NovaLeitura />} />
      <Route path="/leitura/:pontoId" element={<NovaLeitura />} />
      <Route path="/leituras" element={<Leituras />} />
      <Route path="/leituras/:id" element={<LeituraDetalhe />} />
      {admin && <>
        <Route path="/leituras/:id/editar" element={<EditarLeitura />} />
        <Route path="/pontos" element={<Pontos />} />
        <Route path="/pontos/:id" element={<PontoForm />} />
        <Route path="/maquinas" element={<Maquinas />} />
        <Route path="/maquinas/:id" element={<MaquinaForm />} />
        <Route path="/usuarios" element={<Usuarios />} />
      </>}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  if (!configurado) {
    return (
      <Tela titulo="Controle de Máquinas">
        <Cartao>Falta configurar o Supabase: preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o arquivo .env.example).</Cartao>
      </Tela>
    );
  }
  return <ProvedorSessao><Rotas /></ProvedorSessao>;
}
