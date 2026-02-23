export default async function handler(request, response) {
    // 1. Configuração de segurança (CORS)
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const { message } = request.body;

    if (!message) {
        return response.status(400).json({ error: 'Mensagem vazia' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("ERRO: Chave GEMINI_API_KEY não encontrada!");
            return response.status(500).json({ reply: "Erro de configuração no servidor." });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const systemPrompt = `
        Você é o Consultor Virtual da Ágil Solar.
        Persona: Profissional, amigável e especialista em energia fotovoltaica.
        Fatos Importantes:
        - Economia de até 85% na conta de luz.
        - Garantia de 25 anos de performance.
        - Payback médio de 3 anos.
        - Instalação rápida em média 36h.
        - Se o cliente pedir orçamento, falar para usar o formulário. Nunca tentar fazer o orçamento.
        - Orçamento só vai ser liberado pelo vendedor, o site não tem simulador.
        Objetivo: Tirar dúvidas e incentivar o uso do simulador.
        Regra de Ouro: Responda de forma concisa (máximo 3 frases).
        `;

        const payload = {
            contents: [{
                role: "user",
                parts: [{ text: systemPrompt + "\n\nUser: " + message }]
            }]
        };

        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await googleResponse.json();

        // TRATAMENTO INTELIGENTE DE ERROS:
        if (!googleResponse.ok) {
            // Se for o erro 429 (Limite de requisições)
            if (googleResponse.status === 429) {
                console.warn("Aviso: Limite de uso do Google atingido (429).");
                return response.status(200).json({
                    reply: "Estou a processar muitos pedidos neste momento! ☀️ Podes tentar enviar a tua mensagem novamente daqui a 1 minuto?"
                });
            }

            // Outros erros da API
            console.error("ERRO DA API DO GOOGLE:", JSON.stringify(data, null, 2));
            return response.status(200).json({ reply: "Ocorreu um erro técnico na nossa comunicação. Por favor, tenta novamente mais tarde." });
        }

        // Sucesso!
        const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não entendi.";
        response.status(200).json({ reply: botReply });

    } catch (error) {
        console.error("ERRO GERAL NO SERVIDOR:", error);
        response.status(500).json({ error: 'Erro interno no servidor' });
    }
}