import React, { useState } from 'react';
import { Send, User, Bot } from 'lucide-react';
import { Button, Input } from '../../components/ui/index';

export function AgentPreview({ config }: { config: any }) {
    const [messages, setMessages] = useState<any[]>([
        { role: 'assistant', content: 'Olá! Sou a Ana do TecHub. Como posso ajudar com sua energia solar hoje?' }
    ]);
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;

        const newMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, newMsg]);
        setInput('');

        // Simulate AI Typying
        setTimeout(() => {
            // Mock Response based on simple rules or just echo for preview
            let reply = "Entendi! Posso te ajudar com isso.";
            if (input.toLowerCase().includes('preço')) reply = "Nossos kits começam a partir de R$ 12.000.";
            if (input.toLowerCase().includes('humano')) reply = "Vou transferir para um especialista.";

            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        }, 1000);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 shadow-xl">
            {/* Phone Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot size={18} />
                </div>
                <div>
                    <div className="font-semibold text-sm">Ana (TecHub)</div>
                    <div className="text-xs opacity-80 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse"></span>
                        Online
                    </div>
                </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                             max-w-[80%] rounded-2xl px-4 py-2 text-sm
                             ${msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-sm'}
                         `}>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-zinc-200">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e: any) => setInput(e.target.value)}
                        onKeyDown={(e: any) => e.key === 'Enter' && handleSend()}
                        placeholder="Digite uma mensagem..."
                        className="bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-primary/20"
                    />
                    <Button size="icon" onClick={handleSend} className="bg-primary text-primary-foreground">
                        <Send size={16} />
                    </Button>
                </div>
                <div className="text-[10px] text-center text-zinc-400 mt-2">
                    Preview do comportamento da IA
                </div>
            </div>
        </div>
    );
}
