// Arquivo: assets/js/script.js

// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://vuvwcefqrkjkzpybkcox.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dndjZWZxcmtqa3pweWJrY294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTI5NTgsImV4cCI6MjA4MzQ2ODk1OH0.FrzJnC4tSuuMUiEnnMfPsTEFvCtPW1gK985QDMerrR0';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// VARIÁVEIS DO CHAT
let userMessageCount = 0;
let pendingUserQuestion = "";

// --- FUNÇÕES DE INTERFACE (UI) ---

function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    const tooltip = document.getElementById('chat-help-tooltip');

    // Remove tooltip permanently when chat is opened
    if (tooltip) tooltip.remove();

    if (chatWindow.classList.contains('translate-y-[120%]')) {
        chatWindow.classList.remove('translate-y-[120%]', 'opacity-0', 'pointer-events-none');
    } else {
        chatWindow.classList.add('translate-y-[120%]', 'opacity-0', 'pointer-events-none');
    }
}

// Formatar Telefone no Chat
const chatPhoneInput = document.getElementById('chat-phone');
if(chatPhoneInput) {
    chatPhoneInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.substring(0, 11);
        if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
        else if (v.length > 5) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
        else if (v!=="") v = v.replace(/^(\d*)$/, "($1");
        e.target.value = v;
    });
}

// Enviar Mensagem no Chat
async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    appendMessage('user', message);
    input.value = '';

    userMessageCount++;

    // Verifica se já enviou formulário (Cookies)
    const alreadyConverted = getCookie('agil_lead_enviado');

    // Lógica de Captura (Interrompe na 2ª msg se não converteu ainda)
    if (userMessageCount === 2 && !alreadyConverted) {
        pendingUserQuestion = message;

        const loadingId = appendLoading();
        setTimeout(() => {
            removeMessage(loadingId);
            appendMessage('ai', "Para continuar seu atendimento personalizado, preciso rapidinho do seu **Nome** e **WhatsApp** abaixo:");

            // Troca a barra de chat pelos inputs
            document.getElementById('chat-form').classList.add('hidden');
            document.getElementById('chat-lead-form').classList.remove('hidden');
            document.getElementById('chat-lead-form').classList.add('flex');
        }, 1000);
        return;
    }

    // Fluxo Normal
    const loadingId = appendLoading();
    try {
        const response = await callGeminiAPI(message);
        removeMessage(loadingId);
        appendMessage('ai', response);
    } catch (error) {
        console.error(error);
        removeMessage(loadingId);
        appendMessage('ai', "Desculpe, tive um problema técnico. Pode tentar novamente?");
    }
}

async function submitLeadData() {
    const name = document.getElementById('chat-name').value;
    const phone = document.getElementById('chat-phone').value;

    if(!name || phone.length < 14) {
        alert("Por favor, preencha nome e telefone corretamente.");
        return;
    }

    // 1. Esconde inputs e volta barra normal
    document.getElementById('chat-lead-form').classList.add('hidden');
    document.getElementById('chat-lead-form').classList.remove('flex');
    document.getElementById('chat-form').classList.remove('hidden');

    // 2. Classificação
    const classification = "FRIO/MORNO";

    // 3. Enviar para Supabase
    if (supabaseClient) {
        try {
            await supabaseClient.from('leads').insert([{
                nome: name,
                telefone: phone,
                origem: "Chatbot",
                status: "Novo",
                classificacao: classification
            }]);
            console.log("Lead do Chat salvo!");
            setCookie('agil_chat_convertido', 'true', 24);
            setCookie('agil_lead_enviado', 'true', 24);
        } catch (err) {
            console.error("Erro ao salvar lead do chat:", err);
        }
    }

    const loadingId = appendLoading();
    try {
        const contextMessage = `O usuário informou: Nome ${name}, Tel ${phone}. Agradeça e responda: "${pendingUserQuestion}"`;
        const response = await callGeminiAPI(contextMessage);
        removeMessage(loadingId);
        appendMessage('ai', response);
    } catch (error) {
        removeMessage(loadingId);
        appendMessage('ai', "Obrigado! Dados anotados.");
    }
}

function appendMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `flex items-start gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const avatar = role === 'ai'
        ? `<div class="w-8 h-8 rounded-full bg-brand-orange/10 flex-shrink-0 flex items-center justify-center text-brand-orange text-xs border border-brand-orange/20"><i class="fas fa-bolt"></i></div>`
        : `<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs"><i class="fas fa-user"></i></div>`;
    const bubbleClass = role === 'ai' ? "bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-tl-none" : "bg-brand-deepBlue text-white rounded-tr-none";
    div.innerHTML = `${avatar}<div class="${bubbleClass} p-3 rounded-2xl text-sm shadow-sm max-w-[80%] leading-relaxed">${text.replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendLoading() {
    const id = 'loading-' + Date.now();
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.id = id;
    div.className = "flex items-start gap-3";
    div.innerHTML = `<div class="w-8 h-8 rounded-full bg-brand-orange/10 flex-shrink-0 flex items-center justify-center text-brand-orange text-xs border border-brand-orange/20"><i class="fas fa-bolt"></i></div><div class="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3 rounded-2xl rounded-tl-none text-sm shadow-sm flex gap-1 items-center h-10"><div class="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot"></div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeMessage(id) { const el = document.getElementById(id); if (el) el.remove(); }

// --- AQUI ESTÁ A MUDANÇA IMPORTANTE ---
// Chama a API interna do Vercel (/api/chat) em vez do Google direto
async function callGeminiAPI(userMessage) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
    });

    if (!response.ok) throw new Error('Erro na comunicação com o servidor');

    const data = await response.json();
    return data.reply;
}

// --- UTILS ---
function toggleFaq(element) { element.classList.toggle('faq-open'); }
function setCookie(name, value, hours) { const d = new Date(); d.setTime(d.getTime() + (hours * 60 * 60 * 1000)); document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/"; }
function getCookie(name) { const value = `; ${document.cookie}`; const parts = value.split(`; ${name}=`); if (parts.length === 2) return parts.pop().split(';').shift(); }
function updateSelect(id, value) { const select = document.getElementById(id); if(select) { select.innerHTML = `<option value="${value}" selected>${value}</option>`; select.value = value; const event = new Event('change'); select.dispatchEvent(event); } }

// Policy/Terms Logic
function openPolicy(e) { if(e) e.preventDefault(); const m=document.getElementById('policy-modal'); const b=document.getElementById('policy-backdrop'); const p=document.getElementById('policy-panel'); m.classList.remove('hidden'); setTimeout(()=>{b.classList.remove('opacity-0'); p.classList.remove('opacity-0','translate-y-4','sm:translate-y-0','sm:scale-95'); p.classList.add('opacity-100','translate-y-0','sm:scale-100');},10); }
function closePolicy() { const m=document.getElementById('policy-modal'); const b=document.getElementById('policy-backdrop'); const p=document.getElementById('policy-panel'); b.classList.add('opacity-0'); p.classList.remove('opacity-100','translate-y-0','sm:scale-100'); p.classList.add('opacity-0','translate-y-4','sm:translate-y-0','sm:scale-95'); setTimeout(()=>{m.classList.add('hidden');},300); }
function openTerms(e) { if(e) e.preventDefault(); const m=document.getElementById('terms-modal'); const b=document.getElementById('terms-backdrop'); const p=document.getElementById('terms-panel'); m.classList.remove('hidden'); setTimeout(()=>{b.classList.remove('opacity-0'); p.classList.remove('opacity-0','translate-y-4','sm:translate-y-0','sm:scale-95'); p.classList.add('opacity-100','translate-y-0','sm:scale-100');},10); }
function closeTerms() { const m=document.getElementById('terms-modal'); const b=document.getElementById('terms-backdrop'); const p=document.getElementById('terms-panel'); b.classList.add('opacity-0'); p.classList.remove('opacity-100','translate-y-0','sm:scale-100'); p.classList.add('opacity-0','translate-y-4','sm:translate-y-0','sm:scale-95'); setTimeout(()=>{m.classList.add('hidden');},300); }
document.addEventListener('click', function(e) {
    const pm=document.getElementById('policy-modal'); const pb=document.getElementById('policy-backdrop');
    if(pm&&!pm.classList.contains('hidden')&&e.target===pb) closePolicy();
    const tm=document.getElementById('terms-modal'); const tb=document.getElementById('terms-backdrop');
    if(tm&&!tm.classList.contains('hidden')&&e.target===tb) closeTerms();
});

// Theme & Menu Logic
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');

if (localStorage.getItem('color-theme') === 'dark') {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
    }
}

if(themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
if(themeToggleMobileBtn) themeToggleMobileBtn.addEventListener('click', toggleTheme);

function toggleMobileMenu() { const menu = document.getElementById('mobile-menu'); menu.classList.toggle('translate-x-full'); if (!menu.classList.contains('translate-x-full')) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; }

// Observers & Init
document.addEventListener('DOMContentLoaded', () => {
    // Tooltip Logic
    const tooltip = document.getElementById('chat-help-tooltip');
    const chatBtn = document.getElementById('chat-toggle-btn');
    let tooltipTimeout;

    const hideTooltip = () => {
        if(tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(10px)';
            tooltip.style.pointerEvents = 'none';
        }
    };

    const showTooltip = () => {
        if(tooltip) {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
            tooltip.style.pointerEvents = 'auto';
        }
    };

    tooltipTimeout = setTimeout(hideTooltip, 8000);

    if(chatBtn) {
        chatBtn.addEventListener('mouseenter', () => {
            clearTimeout(tooltipTimeout);
            showTooltip();
        });

        chatBtn.addEventListener('mouseleave', () => {
            tooltipTimeout = setTimeout(hideTooltip, 2000);
        });
    }

    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('active'); revealObserver.unobserve(entry.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    revealElements.forEach(element => { revealObserver.observe(element); });

    const form = document.getElementById('contact-form');
    const formHeader = document.querySelector('.form-header');
    const progressContainer = document.querySelector('.progress-container');
    const successDiv = document.getElementById('success-message');

    if (getCookie('agil_lead_enviado')) {
        if(form) form.style.display = 'none';
        if(formHeader) formHeader.style.display = 'none';
        if(progressContainer) progressContainer.style.display = 'none';
        if(successDiv) { successDiv.classList.remove('hidden'); successDiv.querySelector('h3').innerText = "Solicitação Recebida"; successDiv.querySelector('p').innerText = "Já recebemos seus dados hoje."; }
    }

    const consent = getCookie('agil_consentimento');
    if (!consent) { setTimeout(() => { const banner = document.getElementById('cookie-banner'); if(banner) { banner.classList.remove('hidden'); setTimeout(() => banner.classList.remove('translate-y-full'), 100); } }, 1000); } else if (consent === 'all') loadMarketingScripts();

    // Form Steps
    const step1 = document.getElementById('step1'); const step2 = document.getElementById('step2');
    const btnNext1 = document.getElementById('btn-next-1'); const btnPrev2 = document.getElementById('btn-prev-2'); const submitBtn = document.getElementById('submit-btn');
    const progressBar = document.getElementById('progress-bar');
    const nameInput = document.getElementById('name'); const phoneInput = document.getElementById('phone'); const cityInput = document.getElementById('city'); const stateInput = document.getElementById('state');
    const typeSelect = document.getElementById('type'); const consumptionInput = document.getElementById('consumption');

    function updateStep(step) {
        if (step === 1) { step1.classList.remove('hidden'); step2.classList.add('hidden'); progressBar.style.width = '50%'; }
        else { step1.classList.add('hidden'); step2.classList.remove('hidden'); progressBar.style.width = '100%'; }
    }

    if (btnNext1) btnNext1.addEventListener('click', () => { if (!typeSelect.value) { alert("Por favor, selecione o tipo de imóvel."); return; } if (!consumptionInput.value) { alert("Por favor, selecione o valor médio da conta."); return; } updateStep(2); });
    if (btnPrev2) btnPrev2.addEventListener('click', () => updateStep(1));

    if (phoneInput) phoneInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.substring(0, 11);
        if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
        else if (v.length > 5) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
        else if (v!=="") v = v.replace(/^(\d*)$/, "($1");
        e.target.value = v;
    });

    if (submitBtn) submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!nameInput.value || phoneInput.value.length < 14 || !cityInput.value || !stateInput.value) { alert("Preencha todos os campos corretamente."); return; }
        const originalText = submitBtn.innerHTML; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; submitBtn.disabled = true;

        let classificacao = "MORNO/QUENTE";
        if (getCookie('agil_chat_convertido')) {
            classificacao = "QUENTE";
        }

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('leads').insert([{
                    nome: nameInput.value,
                    telefone: phoneInput.value,
                    tipo_instalacao: typeSelect.value,
                    valor_conta: consumptionInput.value,
                    cidade: cityInput.value,
                    estado: stateInput.value,
                    origem: "Landing Page Final",
                    status: "Novo",
                    classificacao: classificacao
                }]);
                if (error) throw error;
                setCookie('agil_lead_enviado', 'true', 24);
                if(formHeader) formHeader.style.display = 'none'; if(progressContainer) progressContainer.style.display = 'none'; form.style.display = 'none'; successDiv.classList.remove('hidden'); successDiv.classList.add('fade-in');
            } catch (err) { console.error(err); alert("Erro ao enviar. Tente novamente."); submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
        } else {
            setTimeout(() => { setCookie('agil_lead_enviado', 'true', 24); if(formHeader) formHeader.style.display = 'none'; if(progressContainer) progressContainer.style.display = 'none'; form.style.display = 'none'; successDiv.classList.remove('hidden'); }, 1500);
        }
    });

    // AUTO-SCROLL DEPOIMENTOS (Versão Infinito Perfeito)
    const testimonialTrack = document.getElementById('testimonial-track');
    if (testimonialTrack) {
        // 1. Duplicar os cards para criar o efeito infinito visual
        const cards = Array.from(testimonialTrack.children);
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true'); // Ignorar clones na leitura de tela
            testimonialTrack.appendChild(clone);
        });

        const scrollStep = 1; // Velocidade
        const delay = 30;     // Suavidade
        let isPaused = false; // Controle de pausa

        const autoScroll = setInterval(() => {
            if (!isPaused) {
                testimonialTrack.scrollLeft += scrollStep;

                // A MÁGICA: Se rolou metade (chegou no fim dos originais),
                // volta pro zero instantaneamente. O usuário não percebe.
                // Usamos >= (scrollWidth / 2) porque dobramos o conteúdo.
                if (testimonialTrack.scrollLeft >= (testimonialTrack.scrollWidth / 2)) {
                    testimonialTrack.scrollLeft = 0;
                }
            }
        }, delay);

        // PAUSA: Quando o mouse entra ou toca na tela
        testimonialTrack.addEventListener('mouseenter', () => { isPaused = true; });
        testimonialTrack.addEventListener('touchstart', () => { isPaused = true; });

        // VOLTA: Quando o mouse sai ou solta o dedo
        testimonialTrack.addEventListener('mouseleave', () => { isPaused = false; });
        testimonialTrack.addEventListener('touchend', () => {
            setTimeout(() => { isPaused = false; }, 2000);
        });
    }
});

function acceptEssential() { setCookie('agil_consentimento', 'essential', 365 * 24); closeBanner(); }
function acceptAll() { setCookie('agil_consentimento', 'all', 365 * 24); loadMarketingScripts(); closeBanner(); }
function closeBanner() { const banner = document.getElementById('cookie-banner'); if(banner) { banner.classList.add('translate-y-full'); setTimeout(() => { banner.classList.add('hidden'); }, 500); } }
function loadMarketingScripts() { console.log("LGPD: Scripts de Marketing Autorizados."); }