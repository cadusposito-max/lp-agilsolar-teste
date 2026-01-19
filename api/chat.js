export default async function handler(request, response) {
    // 1. Configuração de segurança (CORS)
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Responde rápido se for verificação do navegador
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    // 2. Pega a mensagem enviada pelo site
    const { message } = request.body;

    if (!message) {
        return response.status(400).json({ error: 'Mensagem vazia' });
    }

    try {
        // 3. Pega a chave segura do ambiente da Vercel
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('Chave da API não configurada no Vercel');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // 4. O Prompt do Sistema fica AQUI (Seguro no backend)
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

        // 5. Chama o Google
        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await googleResponse.json();
        const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não entendi.";

        // 6. Devolve a resposta para o seu site
        response.status(200).json({ reply: botReply });

    } catch (error) {
        console.error("Erro na API:", error);
        response.status(500).json({ error: 'Erro interno no servidor' });
    }
}