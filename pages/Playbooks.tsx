import React from 'react';
import { 
  UserPlus, 
  Wrench, 
  Flame, 
  ThermometerSnowflake, 
  Zap, 
  RefreshCw, 
  Send,
  Target,
  HelpCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const PlaybookCard = ({ flow }: any) => {
  const getColor = (type: string) => {
    switch(type) {
      case 'hot': return 'border-orange-200 bg-orange-50';
      case 'cold': return 'border-blue-200 bg-blue-50';
      case 'angry': return 'border-red-200 bg-red-50';
      case 'support': return 'border-purple-200 bg-purple-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getIconColor = (type: string) => {
    switch(type) {
      case 'hot': return 'text-orange-600 bg-orange-100';
      case 'cold': return 'text-blue-600 bg-blue-100';
      case 'angry': return 'text-red-600 bg-red-100';
      case 'support': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`p-6 rounded-xl border shadow-sm ${getColor(flow.type)}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-lg ${getIconColor(flow.type)}`}>
          <flow.icon size={24} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{flow.title}</h3>
          <p className="text-xs text-gray-500 uppercase font-semibold">{flow.category}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-1">
            <Target size={16} /> Objetivo
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">{flow.objective}</p>
        </div>

        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
            <HelpCircle size={16} /> Perguntas-Chave
          </h4>
          <ul className="space-y-1">
            {flow.questions.map((q: string, i: number) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                {q}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
            <Zap size={16} /> Ações da IA
          </h4>
          <div className="bg-white/60 p-3 rounded-lg border border-gray-200/50">
            <ul className="space-y-1">
               {flow.actions.map((a: string, i: number) => (
                <li key={i} className="text-xs text-gray-700 font-medium">
                   {i + 1}. {a}
                </li>
               ))}
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200/50">
           <div className="flex items-center gap-2 text-green-700 text-xs font-bold bg-green-100/50 p-2 rounded">
             <CheckCircle2 size={14} />
             Sucesso: {flow.success}
           </div>
        </div>
      </div>
    </div>
  );
};

const FLOWS = [
  {
    type: 'default',
    title: 'Primeiro Contato',
    category: 'Vendas / Triagem',
    icon: UserPlus,
    objective: 'Qualificar o lead e capturar dados básicos sem parecer um interrogatório.',
    questions: [
      'Qual o seu nome?',
      'A demanda é para empresa ou pessoal?',
      'Como você nos conheceu?'
    ],
    actions: [
      'Saudar com entusiasmo moderado.',
      'Verificar se o nome já existe na memória.',
      'Oferecer menu de opções ou perguntar demanda aberta.'
    ],
    success: 'Nome e intenção capturados no CRM.'
  },
  {
    type: 'support',
    title: 'Suporte Técnico',
    category: 'Pós-Venda',
    icon: Wrench,
    objective: 'Resolver o problema rápido ou escalar para Nível 2 com dados completos.',
    questions: [
      'Pode descrever o erro?',
      'Aparece alguma mensagem na tela?',
      'Isso começou quando?'
    ],
    actions: [
      'Demonstrar empatia ("Sinto muito por isso").',
      'Consultar base RAG por erros similares.',
      'Se não resolver em 2 turnos, abrir ticket.'
    ],
    success: 'Problema resolvido ou Ticket criado com logs.'
  },
  {
    type: 'angry',
    title: 'Cliente Irritado',
    category: 'Crítico',
    icon: AlertTriangle,
    objective: 'Desescalar a tensão (Acalmar) e mover para solução prioritária.',
    questions: [
      'O que houve exatamente?',
      'Como posso compensar esse transtorno?'
    ],
    actions: [
      'NUNCA pedir para "se acalmar".',
      'Pedir desculpas genuínas pelo transtorno (não pelo erro se não confirmado).',
      'Passar para humano imediatamente se detectar ofensas.'
    ],
    success: 'Cliente sente-se ouvido e aceita aguardar solução.'
  },
  {
    type: 'cold',
    title: 'Lead Frio',
    category: 'Vendas',
    icon: ThermometerSnowflake,
    objective: 'Despertar interesse e educar sobre o produto.',
    questions: [
      'Você já usa alguma solução parecida?',
      'Qual seu maior desafio hoje com X?'
    ],
    actions: [
      'Enviar material rico (PDF/Link) da base de conhecimento.',
      'Não pressionar por venda.',
      'Focar em "dor" vs "solução".'
    ],
    success: 'Lead aceita receber mais informações ou agendar demo.'
  },
  {
    type: 'hot',
    title: 'Lead Quente',
    category: 'Vendas',
    icon: Flame,
    objective: 'Fechar negócio ou agendar reunião AGORA.',
    questions: [
      'Você tem disponibilidade terça ou quinta?',
      'Prefere pagar no cartão ou Pix?',
      'Podemos fechar o contrato hoje?'
    ],
    actions: [
      'Eliminar barreiras (responder preço direto).',
      'Usar gatilhos de escassez (se real).',
      'Enviar link de checkout ou agenda.'
    ],
    success: 'Venda realizada ou Reunião agendada.'
  },
  {
    type: 'default',
    title: 'Cliente Recorrente',
    category: 'Relacionamento',
    icon: RefreshCw,
    objective: 'Facilitar a recompra e gerar sentimento de exclusividade.',
    questions: [
      'O de sempre?',
      'Como foi com o último pedido?',
      'Viu nossa novidade X?'
    ],
    actions: [
      'Usar o NOME e histórico de compras da Memória.',
      'Pular etapas de cadastro.',
      'Oferecer desconto de fidelidade.'
    ],
    success: 'Recompra efetuada em menos de 3 mensagens.'
  },
  {
    type: 'default',
    title: 'Follow-up (Reativação)',
    category: 'Vendas',
    icon: Send,
    objective: 'Relembrar o cliente de uma pendência sem ser chato.',
    questions: [
      'Ficou alguma dúvida sobre a proposta?',
      'Conseguiu ver o material que te mandei?'
    ],
    actions: [
      'Referenciar a última conversa ("Como falamos na terça...").',
      'Oferecer ajuda adicional, não apenas cobrar resposta.',
      'Se não responder, marcar para tentar em 3 dias.'
    ],
    success: 'Cliente responde a mensagem (mesmo que seja não).'
  }
];

export const Playbooks: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Playbooks de Atendimento</h1>
        <p className="text-gray-600">
          Estratégias pré-definidas que o Agente utiliza para navegar em diferentes cenários de conversa.
          Esses fluxos guiam o comportamento da IA para parecer mais humana e eficiente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {FLOWS.map((flow, index) => (
          <PlaybookCard key={index} flow={flow} />
        ))}
      </div>
    </div>
  );
};