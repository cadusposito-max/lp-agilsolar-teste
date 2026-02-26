// Arquivo: assets/js/script.js

// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://vuvwcefqrkjkzpybkcox.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dndjZWZxcmtqa3pweWJrY294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTI5NTgsImV4cCI6MjA4MzQ2ODk1OH0.FrzJnC4tSuuMUiEnnMfPsTEFvCtPW1gK985QDMerrR0';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let modulosData = [];
let inversoresData = [];

// VARIÁVEIS DE ESTADO DA CALCULADORA
let currentStep = 1;
let userConsumption = 0;
let selectedModuleId = null;
let selectedInverterId = null;
let requiredKwp = 0;
let modulesQuantity = 0;
let calcMode = 'consumo';
let selectedRoof = '';
let currentClientId = null; // O "ID Fantasma" do cliente
let selectedHsp = 4.50;     // Média Brasil (será atualizada pela cidade)

// VARIÁVEIS DO CHAT
let userMessageCount = 0;
let pendingUserQuestion = "";

// ------------------------------------------------------------
// LÓGICA DA CALCULADORA
// ------------------------------------------------------------

// Busca Catálogo (SOMENTE SUPABASE - SEM DADOS FAKE)
async function fetchCatalogData() {
    if(!supabaseClient) {
        console.error("Supabase não configurado.");
        return;
    }

    try {
        console.log("📡 Buscando catálogo no Banco...");

        const { data: mods, error: err1 } = await supabaseClient.from('modules').select('*');
        const { data: invs, error: err2 } = await supabaseClient.from('inverters').select('*');

        if (err1) console.error("Erro Supabase Modules:", err1.message);
        if (err2) console.error("Erro Supabase Inverters:", err2.message);

        // Se vieram módulos, processa
        if(mods && mods.length > 0) {
            console.log(`✅ ${mods.length} módulos encontrados.`);
            modulosData = mods.map(m => ({
                id: m.code || m.id,
                name: m.name,
                brand: m.brand,
                // Tenta pegar a potência de várias formas para não vir undefined
                power: m.power_watts || m.power || m.potencia || 0,
                price: m.price,
                img: m.image_url,
                datasheet: m.datasheet_url,
                desc: m.description,
                isPremium: m.is_premium,
                isCostBenefit: m.is_cost_benefit
            }));
            renderModules();
        } else {
            console.warn("⚠️ Banco retornou lista vazia de módulos. Verifique o RLS.");
        }

        // Se vieram inversores, processa
        if(invs && invs.length > 0) {
            inversoresData = invs.map(i => ({
                id: i.code || i.id,
                name: i.name,
                brand: i.brand,
                powerKw: i.power_kw || i.power || 0,
                type: i.type,
                price: i.price,
                img: i.image_url,
                desc: i.description,
                datasheet: i.datasheet_url,
                isPremium: i.is_premium,
                minModules: i.min_modules,
                maxModules: i.max_modules,
                isCostBenefit: i.is_cost_benefit
            }));
        }
    } catch (err) {
        console.error("Erro crítico ao buscar catálogo:", err);
    }
}

function updateSelect(id, value) {
    const select = document.getElementById(id);
    if(select) { select.value = value; }
}

function setCalcMode(mode) {
    calcMode = mode;
    const tabConsumo = document.getElementById('tab-consumo');
    const tabModulos = document.getElementById('tab-modulos');
    const contConsumo = document.getElementById('input-consumo-container');
    const contModulos = document.getElementById('input-modulos-container');
    const errorMsg = document.getElementById('error-msg-1');
    if(errorMsg) errorMsg.classList.add('hidden');

    if(mode === 'consumo') {
        tabConsumo.className = "flex-1 py-2 text-sm font-bold bg-white dark:bg-slate-700 shadow-sm rounded-lg text-brand-orange transition-all";
        tabModulos.className = "flex-1 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg transition-all";
        contConsumo.classList.remove('hidden');
        contModulos.classList.add('hidden');
    } else {
        tabModulos.className = "flex-1 py-2 text-sm font-bold bg-white dark:bg-slate-700 shadow-sm rounded-lg text-brand-orange transition-all";
        tabConsumo.className = "flex-1 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg transition-all";
        contModulos.classList.remove('hidden');
        contConsumo.classList.add('hidden');
    }
}

function goToStep(step) {
    // Esconde todos os passos
    document.querySelectorAll('[id^="step"]').forEach(el => el.classList.add('hidden'));

    // Mostra o passo atual
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) targetStep.classList.remove('hidden');

    // Atualiza barra de progresso
    const progressBar = document.getElementById('progress-bar');
    if(progressBar) progressBar.style.width = `${step * 25}%`;

    // --- CORREÇÃO DO TÍTULO ---
    // Se voltar para o passo 1, 2 ou 3, restaura o título original
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');

    if (step < 4) {
        if(headerTitle) headerTitle.innerText = "Monte Seu Kit";
        if(headerSubtitle) headerSubtitle.innerText = "Passo a passo para a sua economia.";
    }

    // --- LÓGICA DE EXPANSÃO E CABEÇALHO COMPACTO ---
    const textCol = document.getElementById('hero-text-col');
    const formCol = document.getElementById('hero-form-col');

    // Novos elementos do cabeçalho para animação
    const header = document.getElementById('main-form-header');
    const iconContainer = document.getElementById('main-header-icon-container');

    if (step > 1) {
        // Expande o Formulário (esconde texto lateral no desktop)
        if(textCol) {
            textCol.classList.remove('lg:col-span-7', 'opacity-100');
            textCol.classList.add('hidden', 'opacity-0');
        }
        if(formCol) {
            formCol.classList.remove('lg:col-span-5');
            formCol.classList.add('lg:col-span-12', 'max-w-6xl', 'mx-auto', 'w-full');
        }

        // Cabeçalho Horizontal (Mais compacto, lado a lado)
        if (header) {
            header.classList.remove('flex-col', 'text-center', 'mb-6');
            header.classList.add('flex-row', 'text-left', 'items-center', 'gap-4', 'mb-4');
        }
        if (iconContainer) {
            iconContainer.classList.remove('mx-auto', 'mb-4', 'w-14', 'h-14', 'text-2xl');
            iconContainer.classList.add('w-12', 'h-12', 'text-xl'); // Fica menor
        }
    } else {
        // Retrai o Formulário (mostra texto lateral no desktop)
        if(textCol) {
            textCol.classList.remove('hidden', 'opacity-0');
            textCol.classList.add('lg:col-span-7', 'opacity-100');
        }
        if(formCol) {
            formCol.classList.remove('lg:col-span-12', 'max-w-6xl', 'mx-auto', 'w-full');
            formCol.classList.add('lg:col-span-5');
        }

        // Cabeçalho Vertical (Padrão inicial, centralizado)
        if (header) {
            header.classList.remove('flex-row', 'text-left', 'items-center', 'gap-4', 'mb-4');
            header.classList.add('flex-col', 'text-center', 'mb-6');
        }
        if (iconContainer) {
            iconContainer.classList.remove('w-12', 'h-12', 'text-xl');
            iconContainer.classList.add('mx-auto', 'mb-4', 'w-14', 'h-14', 'text-2xl');
        }
    }
    currentStep = step;
}

// PASSO 1: Validação inicial e roteamento
function handleStep1() {
    const typeSelect = document.getElementById('type');
    const roofSelect = document.getElementById('roof-type');
    const errorMsg = document.getElementById('error-msg-1');

    // 1. Valida Tipo de Imóvel
    if (!typeSelect.value) {
        if(errorMsg) { errorMsg.innerText = "Selecione o tipo de imóvel."; errorMsg.classList.remove('hidden'); }
        return;
    }

    // 2. Valida Consumo ou Módulos
    if (calcMode === 'consumo') {
        const consumptionInput = document.getElementById('consumption-val');
        if (!consumptionInput.value || parseInt(consumptionInput.value) < 50) {
            if(errorMsg) { errorMsg.innerText = "Digite um consumo válido (mín. 50 kWh)."; errorMsg.classList.remove('hidden'); }
            return;
        }
        userConsumption = parseInt(consumptionInput.value);
    } else {
        const modulesInput = document.getElementById('modules-count');
        if (!modulesInput.value || parseInt(modulesInput.value) < 1) {
            if(errorMsg) { errorMsg.innerText = "Digite uma quantidade válida."; errorMsg.classList.remove('hidden'); }
            return;
        }
        modulesQuantity = parseInt(modulesInput.value);
    }

    // 3. Valida Telhado
    if (!roofSelect.value) {
        if(errorMsg) { errorMsg.innerText = "Selecione o tipo de telhado."; errorMsg.classList.remove('hidden'); }
        return;
    }

    selectedRoof = roofSelect.value;
    if(errorMsg) errorMsg.classList.add('hidden');

    // LÓGICA DE ROTEAMENTO
    // Se já temos o cliente identificado (cache), pula o cadastro e vai calcular
    if (currentClientId) {
        calculateAndAdvance();
        return;
    }

    // Se não, vai para o formulário de Lead (Captura)
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step-lead').classList.remove('hidden');
}

// PASSO 3 -> 4 (Resumo, Cálculos Finais e Otimização Inteligente)
function handleStep3() {
    if(!selectedInverterId) return;
    const mod = modulosData.find(m => m.id === selectedModuleId);
    const inv = inversoresData.find(i => i.id === selectedInverterId);

    // --- 1. OTIMIZAÇÃO INTELIGENTE (O Pulo do Gato) ---
    // Define a eficiência real baseada na tecnologia escolhida
    const isMicro = inv.type === 'Microinversor';
    const eficienciaReal = isMicro ? 0.90 : 0.80; // 90% para Micro, 80% para String

    // Se o cálculo for por consumo, ajustamos a quantidade de placas AGORA
    // para não vender módulos em excesso desnecessariamente.
    if (calcMode === 'consumo') {
        const potenciaKw = mod.power / 1000;
        // Quanto cada placa gera de verdade com esse inversor
        const geracaoPorModulo = potenciaKw * selectedHsp * eficienciaReal * 30;

        // Nova quantidade otimizada
        const qtdAntiga = modulesQuantity;
        modulesQuantity = Math.ceil(userConsumption / geracaoPorModulo);

        console.log(`Otimização ${inv.type}: De ${qtdAntiga} para ${modulesQuantity} módulos (Eficiência ${(eficienciaReal*100)}%)`);
    }

    // --- 2. CÁLCULOS GERAIS (Com a nova quantidade) ---
    const actualKwp = (modulesQuantity * mod.power) / 1000;

    // Quantidade de Inversores
    const inputsPerUnit = isMicro ? (inv.maxModules || 4) : 9999;
    const inverterQty = isMicro ? Math.ceil(modulesQuantity / inputsPerUnit) : 1;

    // Geração Final Estimada
    const geracaoMensalEstimada = actualKwp * selectedHsp * eficienciaReal * 30;

    // Precificação
    let structurePrice = selectedRoof === 'Sem Estrutura' ? 0 : (modulesQuantity * 120);
    const kitEletrico = 300 + (modulesQuantity * 25);
    const custoEquipamentos = (mod.price * modulesQuantity) + (inv.price * inverterQty) + structurePrice + kitEletrico;

    const margem = 1.30;
    const precoFinal = custoEquipamentos * margem;
    const precoCheio = precoFinal * 1.15;
    const precoDesconto = precoFinal;

    // --- 3. ATUALIZAÇÃO DO VISUAL (RESUMO) ---

    // Título e Geração
    document.getElementById('resumo-titulo').innerHTML = `
        Gerador de ${actualKwp.toFixed(2)} kWp<br>
        <span class="text-lg font-normal text-gray-400">
            Geração média: <strong class="${isMicro ? 'text-green-500' : 'text-green-500'}">${Math.floor(geracaoMensalEstimada)} kWh/mês</strong>
        </span>
    `;

    document.getElementById('preco-original').innerText = precoCheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('preco-desconto').innerText = precoDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('header-title').innerText = "Resumo do Kit";

    const taxaCartao = 1.12;
    const precoParcela = (precoDesconto * taxaCartao) / 12;
    const parcelaEl = document.getElementById('preco-parcelado');
    if (parcelaEl) {
        parcelaEl.innerText = `12x de ${precoParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }

    const valorEconomizado = precoCheio - precoDesconto;
    const badgeEconomia = document.getElementById('badge-economia');
    if (badgeEconomia) badgeEconomia.innerHTML = `<i class="fas fa-arrow-down"></i> Você economizou ${valorEconomizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;


    // Carrega a imagem do kit (Lógica mantida)
    const resumoImg = document.getElementById('resumo-image');
    const safeModId = mod.id ? mod.id.replace(/[^a-zA-Z0-9-_]/g, '') : 'mod';
    const safeInvId = inv.id ? inv.id.replace(/[^a-zA-Z0-9-_]/g, '') : 'inv';
    const kitImageName = `assets/kits/${safeModId}_${safeInvId}.png`;

    if (resumoImg) {
        const imgPreloader = new Image();
        imgPreloader.src = kitImageName;
        imgPreloader.onload = function() { resumoImg.src = kitImageName; };
        imgPreloader.onerror = function() { if (mod.img) resumoImg.src = mod.img; };
    }

    // Lista de Componentes
    const paresMC4 = Math.max(1, Math.ceil(modulesQuantity / 2));
    const caboMetragem = Math.max(20, modulesQuantity * 5);

    let compHTML = `
        <ul class="space-y-3">
            <li class="flex items-start gap-3">
                <i class="fas fa-solar-panel text-brand-orange mt-1 w-5 text-center text-lg"></i>
                <div>
                    <p class="text-sm font-bold text-brand-deepBlue dark:text-white leading-tight">${modulesQuantity}x Módulos Fotovoltaicos</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${mod.name} ${mod.brand}</p>
                </div>
            </li>

            <li class="flex items-start gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
                <i class="fas fa-charging-station text-blue-500 mt-1 w-5 text-center text-lg"></i>
                <div>
                    <p class="text-sm font-bold text-brand-deepBlue dark:text-white leading-tight">${inverterQty}x ${isMicro ? 'Microinversores' : 'Inversor'}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${inv.name} ${inv.brand}</p>
                </div>
            </li>

            <li class="flex items-start gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
                <i class="fas fa-plug text-gray-400 mt-1 w-5 text-center text-lg"></i>
                <div>
                    <p class="text-sm font-bold text-brand-deepBlue dark:text-white leading-tight">Kit de Instalação Elétrica</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${caboMetragem}m Cabo Solar + ${paresMC4}x Pares MC4</p>
                </div>
            </li>
    `;

    if (selectedRoof !== "Sem Estrutura") {
        compHTML += `
            <li class="flex items-start gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
                <i class="fas fa-tools text-gray-400 mt-1 w-5 text-center text-lg"></i>
                <div>
                    <p class="text-sm font-bold text-brand-deepBlue dark:text-white leading-tight">Estrutura de Fixação</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Perfil p/ Telhado ${selectedRoof}</p>
                </div>
            </li>
        `;
    } else {
        compHTML += `
            <li class="flex items-start gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
                <i class="fas fa-exclamation-triangle text-red-500 mt-1 w-5 text-center text-lg"></i>
                <div>
                    <p class="text-sm font-bold text-brand-deepBlue dark:text-white leading-tight">Sem Estrutura Inclusa</p>
                    <p class="text-xs text-red-500 mt-0.5">Você optou por comprar sem fixação.</p>
                </div>
            </li>
        `;
    }

    compHTML += `
        <li class="flex items-start gap-3 border-t border-gray-100 dark:border-white/5 pt-3">
            <i class="fas fa-shield-alt text-green-500 mt-1 w-5 text-center text-lg"></i>
            <div>
                <p class="text-sm font-bold text-brand-deepBlue dark:text-white leading-tight">Garantia e Segurança</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Até 25 anos de garantia de fábrica + Frete Seguro.</p>
            </div>
        </li>
    `;

    compHTML += `</ul>`;

    document.getElementById('kit-components').innerHTML = compHTML;

    saveQuoteToDb(custoEquipamentos, precoFinal, inverterQty);
    goToStep(4);
}

// NOVA FUNÇÃO: Processa o Lead e Calcula HSP
// NOVA FUNÇÃO: Processa o Lead e Pega o HSP do Banco
// NOVA FUNÇÃO SIMPLIFICADA
async function submitLeadStep() {
    const nameInput = document.getElementById('lead-name');
    const phoneInput = document.getElementById('lead-phone');
    const citySelect = document.getElementById('lead-city-select');
    const cityInput = document.getElementById('lead-city-input');
    const stateInput = document.getElementById('lead-state');
    const btn = document.getElementById('btn-submit-lead');

    // Validação
    if (!nameInput.value || !phoneInput.value || !citySelect.value) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    let userCity = citySelect.value;
    let finalHsp = 4.50; // Padrão

    // Se escolheu "Outra", pega o que digitou e busca HSP no banco
    if (userCity === 'outra') {
        if (!cityInput.value.trim()) {
            alert("Digite o nome da sua cidade.");
            return;
        }
        userCity = cityInput.value.trim();

        // Busca HSP dessa cidade nova
        if (supabaseClient) {
            const { data } = await supabaseClient
                .from('cities')
                .select('hsp')
                .ilike('name', userCity)
                .maybeSingle();
            if (data && data.hsp) finalHsp = data.hsp;
        }
    }
    // Se escolheu da lista, o HSP já está no atributo data-hsp
    else {
        const selectedOption = citySelect.options[citySelect.selectedIndex];
        if (selectedOption.getAttribute('data-hsp')) {
            finalHsp = parseFloat(selectedOption.getAttribute('data-hsp'));
            // Atualiza o estado automaticamente se tiver
            const uf = selectedOption.getAttribute('data-uf');
            if(uf) stateInput.value = uf;
        }
    }

    selectedHsp = finalHsp;

    // Feedback visual
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    // Salva no Banco (Clients)
    const nameUpper = nameInput.value.trim().toUpperCase();
    const phoneClean = phoneInput.value.replace(/\D/g, '');

    try {
        if (supabaseClient) {
            const { data: newClient } = await supabaseClient
                .from('clients')
                .upsert([{
                    nome: nameUpper,
                    telefone: phoneClean,
                    cidade: userCity,
                    estado: stateInput.value
                }], { onConflict: 'telefone' }) // Se já existir telefone, atualiza
                .select()
                .single();

            if (newClient) {
                currentClientId = newClient.id;
                localStorage.setItem('agil_client_id', currentClientId);
            }
        }
    } catch (err) {
        console.error("Erro ao salvar cliente:", err);
    }

    // Finaliza
    document.getElementById('step-lead').classList.add('hidden');
    calculateAndAdvance();

    btn.innerHTML = originalBtnText;
    btn.disabled = false;
}

// Função auxiliar para calcular KWP e ir para Step 2
function calculateAndAdvance() {
    if (calcMode === 'consumo') {
        // FÓRMULA EXATA (Baseada no seu fator 0.123)
        // Se HSP Araçatuba = 5.15
        // Fator = (5.15 * 0.80 * 30) / 1000 = 0.1236
        // kWp = Consumo / (30 * HSP * 0.80)

        const eficienciaSistema = 0.80;
        requiredKwp = userConsumption / (30 * selectedHsp * eficienciaSistema);
    }

    renderModules();
    goToStep(2);
}

// Substitua a função renderModules atual por esta:
function renderModules() {
    console.log("🛠️ Iniciando renderModules...");
    const container = document.getElementById('modulos-list');

    // 1. Verificação de Segurança do Container
    if(!container) {
        console.error("❌ ERRO: Elemento 'modulos-list' não encontrado no DOM!");
        return;
    }

    // 2. Limpeza (CORRIGIDO: Não limpa mais o ID selecionado)
    container.innerHTML = '';
    // selectedModuleId = null; // <--- LINHA REMOVIDA PARA CORRIGIR O BUG

    // 4. Renderização Item a Item
    modulosData.forEach((mod, index) => {
        try {
            let topBadgeHTML = '';
            let borderClass = 'border-gray-200 dark:border-white/10';

            // Tratamento de segurança para Strings (evita quebra de HTML com aspas)
            const safeId = String(mod.id).replace(/"/g, '&quot;');
            const safeName = String(mod.name).replace(/"/g, '&quot;');
            const safeImg = mod.img || 'assets/img/placeholder.png';

            // Lógica de Badges (Premium / Custo Benefício)
            if (mod.isPremium) {
                topBadgeHTML = `
                <div class="inline-flex items-center gap-1 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded border border-gray-600 shadow-sm mb-2 w-fit btn-shine">
                    <i class="fas fa-rocket text-brand-orange"></i> ALTA PERFORMANCE
                </div>`;
                borderClass = 'border-slate-900/50 dark:border-slate-600';
            } else if (mod.isCostBenefit) {
                topBadgeHTML = `
                <div class="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded border border-yellow-400/50 shadow-sm mb-2 w-fit btn-shine">
                    <i class="fas fa-fire"></i> CUSTO BENEFÍCIO
                </div>`;
                borderClass = 'border-orange-500/30 dark:border-orange-500/30';
            }

            const techBadge = mod.brand ? `
                <span class="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] md:text-xs font-bold px-2 py-1 rounded border border-blue-100 dark:border-blue-500/20 flex items-center gap-1.5">
                    <i class="fas fa-microchip"></i> ${mod.brand}
                </span>` : '';

            // Verifica se este módulo já estava selecionado (mantém o visual marcado)
            const isChecked = selectedModuleId === String(mod.id) ? 'checked' : '';

            // HTML Construído
            const html = `
                <label class="cursor-pointer group relative block h-full">
                    <input type="radio" name="modulo" value="${safeId}" class="peer sr-only radio-card-kit" onchange="selectModule('${safeId}')" ${isChecked}>
                    
                    <div class="h-full rounded-2xl border ${borderClass} bg-white shadow-sm dark:bg-slate-800 p-3 md:p-4 flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:border-brand-orange/50 relative">
                        
                        <div class="w-20 h-24 md:w-24 md:h-28 rounded-xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center p-2 shrink-0 border border-gray-100 dark:border-white/5">
                            <img src="${safeImg}" class="w-full h-full object-cover bg-gray-200 mix-blend-multiply dark:mix-blend-normal transform group-hover:scale-105 transition-transform duration-500" alt="${safeName}">
                        </div>

                        <div class="flex flex-col justify-center flex-1 min-w-0">
                            ${topBadgeHTML}
                            <h4 class="font-bold text-brand-deepBlue dark:text-white text-sm md:text-base leading-tight mb-2 line-clamp-2">${safeName}</h4>
                            <div class="flex items-center gap-2">
                                 ${techBadge}
                            </div>
                        </div>
                        
                        <button type="button" onclick="openProductModal('mod', '${safeId}', event)" class="absolute top-2 right-2 w-7 h-7 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-orange hover:border-brand-orange transition-all z-20">
                            <i class="fas fa-info text-[10px]"></i>
                        </button>
                        
                        <div class="absolute top-3 right-3 w-6 h-6 bg-brand-orange rounded-full flex items-center justify-center text-white text-xs shadow-lg hidden peer-checked:flex animate-bounce-subtle z-20">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                </label>`;

            container.insertAdjacentHTML('beforeend', html);
        } catch (err) {
            console.error(`❌ Erro ao renderizar módulo índice ${index}:`, err);
        }
    });

    console.log("✅ renderModules finalizado com sucesso.");
}

// PASSO 2 -> 3 (Cálculo de Quantidade de Placas)
function handleStep2() {
    if(!selectedModuleId) return;
    const mod = modulosData.find(m => m.id === selectedModuleId);

    // CÁLCULO PRECISO DE PLACAS
    if (calcMode === 'consumo') {
        // 1. Calcula quanto 1 Módulo gera no mês nessa cidade
        // Fórmula: Potência(kW) * HSP * Eficiência(0.80) * 30 dias
        const potenciaKw = mod.power / 1000;
        const geracaoPorModulo = potenciaKw * selectedHsp * 0.80 * 30;

        // Ex: Araçatuba (5.15) c/ Painel 585W
        // 0.585 * 5.15 * 0.80 * 30 = 72.3 kWh/mês (Bate com seu cálculo)

        // 2. Divide consumo pela geração de um módulo
        modulesQuantity = Math.ceil(userConsumption / geracaoPorModulo);

        console.log(`Geração/Módulo: ${geracaoPorModulo.toFixed(2)} kWh | Placas necessárias: ${modulesQuantity}`);
    }

    // Atualiza visual
    const actualKwp = (modulesQuantity * mod.power) / 1000;
    const calcText = document.getElementById('calc-modulos-text');
    if(calcText) calcText.innerText = `${modulesQuantity}`;

    renderModules();
    renderInverters(actualKwp);
    goToStep(3);
}

// Renderiza Cards de Inversores (EQUILIBRADO: Dados completos p/ todos)
// Renderiza Cards de Inversores (Visual Limpo e Tags Dinâmicas)
// Renderiza Cards de Inversores (Com Capacidade Mín/Máx)
function renderInverters(actualKwp) {
    const container = document.getElementById('inversores-list');
    if(!container) return;

    container.innerHTML = '';
    selectedInverterId = null;
    const btn = document.getElementById('btn-next-3');
    if(btn) btn.disabled = true;

    // 1. FILTRAGEM
    let validInverters = inversoresData.filter(inv => {
        const isMicro = inv.type === 'Microinversor';
        if (!isMicro) {
            // Filtra strings que não aguentam a potência total
            return (inv.powerKw >= actualKwp * 0.6) && (inv.powerKw <= actualKwp * 2.0);
        }
        return true;
    });

    // 2. ORDENAÇÃO
    validInverters.sort((a, b) => {
        if (a.type === 'Microinversor' && b.type !== 'Microinversor') return -1;
        if (a.type !== 'Microinversor' && b.type === 'Microinversor') return 1;
        return a.price - b.price;
    });

    // 3. FALLBACK
    if(validInverters.length === 0 && inversoresData.length > 0) {
        const sorted = [...inversoresData].sort((a,b) => Math.abs(a.powerKw - actualKwp) - Math.abs(b.powerKw - actualKwp));
        validInverters = [sorted[0], sorted[1]].filter(Boolean);
    } else {
        validInverters = validInverters.slice(0, 4);
    }

    // 4. RENDERIZAÇÃO
    validInverters.forEach(inv => {
        const isMicro = inv.type === 'Microinversor';
        const inputsPerUnit = inv.maxModules || 4;
        const qtyInverters = isMicro ? Math.ceil(modulesQuantity / inputsPerUnit) : 1;

        // Badge de Kit (Microinversor > 1 unidade)
        const kitBadge = (isMicro && qtyInverters > 1)
            ? `<div class="inline-block bg-orange-50 dark:bg-orange-900/20 text-brand-orange text-[10px] font-bold px-2 py-0.5 rounded mb-2 border border-orange-100 dark:border-orange-500/20">Kit com ${qtyInverters} un.</div>`
            : '';

        // Texto de Capacidade (VOLTOU!)
        // Se for Micro: "Até 4 módulos"
        // Se for String: "Suporta 6 a 12 módulos"
        const capacityText = isMicro
            ? `Até ${inputsPerUnit} módulos por un.`
            : `Suporta ${inv.minModules || '?'} a ${inv.maxModules || '?'} módulos`;

        // Etiquetas de Topo
        let topBadge = '';
        let borderClass = 'border-gray-200 dark:border-white/10';

        if (inv.isPremium) {
            topBadge = `
            <div class="inline-flex items-center gap-1 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded border border-gray-600 shadow-sm mb-1 w-fit btn-shine">
                <i class="fas fa-rocket text-brand-orange"></i> Alta Performance
            </div>`;
            borderClass = 'border-slate-900/50 dark:border-slate-600';
        }
        else if (inv.isCostBenefit || inv.type === 'Custo Benefício') {
            topBadge = `
            <div class="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded border border-yellow-400/50 shadow-sm mb-1 w-fit btn-shine">
                <i class="fas fa-fire"></i> Custo Benefício
            </div>`;
            borderClass = 'border-orange-500/30 dark:border-orange-500/30';
        }

        const html = `
            <label class="cursor-pointer group relative block h-full">
                <input type="radio" name="inversor" value="${inv.id}" class="peer sr-only radio-card-kit" onchange="selectInverter('${inv.id}')">
                
                <div class="h-full rounded-2xl border ${borderClass} bg-white shadow-sm dark:bg-slate-800 p-3 flex items-start gap-3 transition-all duration-300 hover:shadow-lg hover:border-brand-orange/50 relative">
                    
                    <div class="w-20 h-20 rounded-xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center p-2 shrink-0 border border-gray-100 dark:border-white/5 self-center">
                        <img src="${inv.img}" class="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" alt="${inv.name}">
                    </div>

                    <div class="flex flex-col justify-center flex-1 min-w-0 py-1">
                        ${topBadge}
                        <h4 class="font-bold text-brand-deepBlue dark:text-white text-sm leading-tight mb-1 line-clamp-2">${inv.name}</h4>
                        
                        <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
                            <i class="fas fa-th-large text-gray-400"></i> ${capacityText}
                        </div>

                        ${kitBadge}
                    </div>

                    <button type="button" onclick="openProductModal('inv', '${inv.id}', event)" class="absolute top-2 right-2 w-6 h-6 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-orange hover:border-brand-orange transition-all shadow-sm z-20">
                        <i class="fas fa-info text-[9px]"></i>
                    </button>
                </div>
            </label>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function selectInverter(id) {
    selectedInverterId = id;
    const btn = document.getElementById('btn-next-3');
    if(btn) btn.disabled = false;
}

// NOVA FUNÇÃO: Salva Orçamento na Tabela 'quotes'
async function saveQuoteToDb(custo, precoFinal, inverterQty = 1) {
    if (!currentClientId || !supabaseClient) return;

    const mod = modulosData.find(m => m.id === selectedModuleId);
    const inv = inversoresData.find(i => i.id === selectedInverterId);

    try {
        await supabaseClient.from('quotes').insert([{
            client_id: currentClientId,
            tipo_imovel: document.getElementById('type').value,
            consumo_media: userConsumption,
            telhado_tipo: selectedRoof,
            kwp_sistema: (modulesQuantity * mod.power) / 1000,
            valor_final: precoFinal,
            modulo_escolhido: `${modulesQuantity}x ${mod.name}`,
            // Aqui ele salva a quantidade correta (ex: "2x Hoymiles 2000")
            inversor_escolhido: `${inverterQty}x ${inv.name}`
        }]);
        console.log("Orçamento salvo com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar orçamento:", err);
    }
}


// Finalização (WhatsApp)
async function sendToWhatsApp() {
    const mod = modulosData.find(m => m.id === selectedModuleId);
    const inv = inversoresData.find(i => i.id === selectedInverterId);
    const actualKwp = (modulesQuantity * mod.power) / 1000;
    const price = document.getElementById('preco-desconto').innerText;

    // Recalcula geração para mandar no Zap
    const isMicro = inv.type === 'Microinversor';
    const eficienciaReal = isMicro ? 0.90 : 0.80;
    const geracaoMensal = Math.floor(actualKwp * selectedHsp * eficienciaReal * 30);

    // Salva na tabela leads antiga por garantia
    if (supabaseClient) {
        try {
            await supabaseClient.from('leads').insert([{
                nome: document.getElementById('lead-name') ? document.getElementById('lead-name').value : "Cliente Web",
                telefone: document.getElementById('lead-phone') ? document.getElementById('lead-phone').value : "",
                tipo_instalacao: selectedRoof,
                valor_conta: calcMode === 'consumo' ? userConsumption.toString() : `Modulos: ${modulesQuantity}`,
                origem: "Calculadora V2",
                status: "Novo",
                classificacao: "QUENTE"
            }]);
        } catch (err) { console.error("Erro tracking lead antigo", err); }
    }

    const text = `Olá! Montei meu kit no site e gostaria de finalizar o pedido.\n\n` +
        `*Resumo do Sistema:* ${actualKwp.toFixed(2)} kWp\n` +
        `*Geração Estimada:* ~${geracaoMensal} kWh/mês ${isMicro ? '(Alta Performance)' : ''}\n` +
        `- ${modulesQuantity}x Painéis ${mod.name}\n` +
        `- 1x Inversor ${inv.name}\n` +
        `- Fixação: ${selectedRoof}\n` +
        `- Inclui cabos solares e conectores MC4\n\n` +
        `*Valor Promocional:* ${price}\n\n` +
        `Podemos dar andamento?`;

    const encodedText = encodeURIComponent(text);
    const telefone = "5511999999999"; // Coloque seu número real aqui
    window.open(`https://wa.me/${telefone}?text=${encodedText}`, '_blank');
}

// --- MODAIS UI ---
function openProductModal(type, id, event) {
    event.preventDefault(); event.stopPropagation();
    const data = type === 'mod' ? modulosData.find(m=>m.id === id) : inversoresData.find(i=>i.id === id);
    if(!data) return;

    document.getElementById('modal-img').src = data.img;
    document.getElementById('modal-title').innerText = data.name;
    document.getElementById('modal-brand').innerText = data.brand;
    document.getElementById('modal-desc').innerText = data.desc;

    const btnContainer = document.getElementById('modal-datasheet-container');
    if (btnContainer) {
        if (data.datasheet) {
            btnContainer.innerHTML = `
                <a href="${data.datasheet}" target="_blank" class="flex items-center justify-center gap-2 w-full border border-brand-orange text-brand-orange font-bold py-3 rounded-xl hover:bg-brand-orange hover:text-white transition-all mt-3">
                    <i class="fas fa-file-pdf"></i> Ver Ficha Técnica (PDF)
                </a>`;
            btnContainer.classList.remove('hidden');
        } else {
            btnContainer.classList.add('hidden');
        }
    }

    const badge = document.getElementById('modal-badge-container');
    if(data.isCustoBeneficio) badge.classList.remove('hidden'); else badge.classList.add('hidden');

    const modal = document.getElementById('product-modal');
    const backdrop = document.getElementById('product-backdrop');
    const panel = document.getElementById('product-panel');
    modal.classList.remove('hidden');
    setTimeout(() => { backdrop.classList.remove('opacity-0'); panel.classList.remove('opacity-0', 'scale-95'); }, 10);
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    const backdrop = document.getElementById('product-backdrop');
    const panel = document.getElementById('product-panel');
    backdrop.classList.add('opacity-0'); panel.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function openBillInfoModal() {
    const modal = document.getElementById('bill-info-modal');
    const backdrop = document.getElementById('bill-info-backdrop');
    const panel = document.getElementById('bill-info-panel');
    modal.classList.remove('hidden');
    setTimeout(() => { backdrop.classList.remove('opacity-0'); panel.classList.remove('opacity-0', 'scale-95'); }, 10);
}

function closeBillInfoModal() {
    const modal = document.getElementById('bill-info-modal');
    const backdrop = document.getElementById('bill-info-backdrop');
    const panel = document.getElementById('bill-info-panel');
    backdrop.classList.add('opacity-0'); panel.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// ------------------------------------------------------------
// LÓGICA EXISTENTE (Chat, Tema, Scroll, etc)
// ------------------------------------------------------------

function toggleChat() {
    const chatWindow = document.getElementById('chat-window');
    const tooltip = document.getElementById('chat-help-tooltip');
    if (tooltip) tooltip.remove();
    if (chatWindow.classList.contains('translate-y-[120%]')) {
        chatWindow.classList.remove('translate-y-[120%]', 'opacity-0', 'pointer-events-none');
    } else {
        chatWindow.classList.add('translate-y-[120%]', 'opacity-0', 'pointer-events-none');
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    appendMessage('user', message);
    input.value = '';
    userMessageCount++;

    const alreadyConverted = getCookie('agil_lead_enviado');
    if (userMessageCount === 2 && !alreadyConverted) {
        pendingUserQuestion = message;
        appendMessage('ai', "Para continuar, preciso do seu **Nome** e **WhatsApp**:");
        document.getElementById('chat-form').classList.add('hidden');
        document.getElementById('chat-lead-form').classList.remove('hidden');
        document.getElementById('chat-lead-form').classList.add('flex');
        return;
    }
    setTimeout(()=> appendMessage('ai', "Sou uma IA em treinamento, mas posso adiantar que nossos kits têm garantia de 25 anos!"), 1000);
}

function appendMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `flex items-start gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const avatar = role === 'ai' ? `<div class="w-8 h-8 rounded-full bg-brand-orange/10 flex-shrink-0 flex items-center justify-center text-brand-orange text-xs border border-brand-orange/20"><i class="fas fa-bolt"></i></div>` : `<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-300 text-xs"><i class="fas fa-user"></i></div>`;
    const bubbleClass = role === 'ai' ? "bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-tl-none" : "bg-brand-deepBlue text-white rounded-tr-none";
    div.innerHTML = `${avatar}<div class="${bubbleClass} p-3 rounded-2xl text-sm shadow-sm max-w-[80%] leading-relaxed">${text}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function toggleFaq(element) { element.classList.toggle('faq-open'); }
function setCookie(name, value, hours) { const d = new Date(); d.setTime(d.getTime() + (hours * 60 * 60 * 1000)); document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/"; }
function getCookie(name) { const value = `; ${document.cookie}`; const parts = value.split(`; ${name}=`); if (parts.length === 2) return parts.pop().split(';').shift(); }

// --- NOVO BLOCO DE INICIALIZAÇÃO (Blindado) ---
// --- CORREÇÃO FINAL: INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {

    fetchCatalogData();

    loadCities();

    setupEventListeners();

    const savedId = localStorage.getItem('agil_client_id');
    const savedName = localStorage.getItem('agil_lead_name');
    const savedPhone = localStorage.getItem('agil_lead_phone');

    if (savedId) currentClientId = savedId;
    if (savedName) updateInputValue('lead-name', savedName);
    if (savedPhone) updateInputValue('lead-phone', savedPhone);
});

// Funções auxiliares que o DOMContentLoaded usa
function updateInputValue(id, val) {
    const el = document.getElementById(id);
    if(el) el.value = val;
}

function setupEventListeners() {
    const btnNext1 = document.getElementById('btn-next-1');
    const btnNext2 = document.getElementById('btn-next-2');
    const btnNext3 = document.getElementById('btn-next-3');

    if(btnNext1) btnNext1.addEventListener('click', handleStep1);
    if(btnNext2) btnNext2.addEventListener('click', handleStep2);
    if(btnNext3) btnNext3.addEventListener('click', handleStep3);

    const consumptionInput = document.getElementById('consumption-val');
    const modulesInput = document.getElementById('modules-count');
    if (consumptionInput) consumptionInput.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\D/g, ""));
    if (modulesInput) modulesInput.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\D/g, ""));

    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');
    if(themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if(themeToggleMobileBtn) themeToggleMobileBtn.addEventListener('click', toggleTheme);
    if (localStorage.getItem('color-theme') === 'dark') document.documentElement.classList.add('dark');

    // Revelação ao rolar (Animações)
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('active'); revealObserver.unobserve(entry.target); } }); }, { threshold: 0.1 });
    revealElements.forEach(element => { revealObserver.observe(element); });

    // Depoimentos (Carrossel)
    const testimonialTrack = document.getElementById('testimonial-track');
    if (testimonialTrack) {
        const cards = Array.from(testimonialTrack.children);

        // 1. Clona os cards 4 vezes para garantir que sempre sobra tela, mesmo em monitores gigantes
        for (let i = 0; i < 4; i++) {
            cards.forEach(card => testimonialTrack.appendChild(card.cloneNode(true)));
        }

        let isPaused = false;

        setInterval(() => {
            if (!isPaused) {
                // Rola 1 pixel
                testimonialTrack.scrollLeft += 1;

                // 2. Calcula a largura do bloco original (largura do card + 24px do gap-6)
                const currentBlockWidth = (cards[0].offsetWidth + 24) * cards.length;

                // 3. O Pulo do Gato: Volta pro começo sem dar "tranco"
                if (testimonialTrack.scrollLeft >= currentBlockWidth) {
                    testimonialTrack.scrollLeft -= currentBlockWidth;
                }
            }
        }, 30);

        // Pausa ao passar o mouse ou tocar na tela (Mobile)
        testimonialTrack.addEventListener('mouseenter', () => isPaused = true);
        testimonialTrack.addEventListener('mouseleave', () => isPaused = false);
        testimonialTrack.addEventListener('touchstart', () => isPaused = true, {passive: true});
        testimonialTrack.addEventListener('touchend', () => isPaused = false);
    }
    const stateSelect = document.getElementById('lead-state');
    if (stateSelect) {
        stateSelect.addEventListener('change', (e) => {
            const novoEstado = e.target.value;
            loadCities(novoEstado); // Chama a função passando o novo estado (SP, MS, etc)
        });
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('translate-x-full');
    document.body.style.overflow = menu.classList.contains('translate-x-full') ? '' : 'hidden';
}

// --- NOVA FUNÇÃO PARA DESTRAVAR O BOTÃO ---
function selectModule(id) {
    console.log("Módulo clicado:", id); // Para você ver no F12 se funcionou
    selectedModuleId = id;

    // 1. Destrava o botão "Avançar"
    const btn = document.getElementById('btn-next-2');
    if(btn) {
        btn.disabled = false;

        // Muda o visual do botão para "Ativo"
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:bg-orange-600');

        // Faz uma animaçãozinha para chamar atenção
        btn.classList.add('animate-pulse');
        setTimeout(() => btn.classList.remove('animate-pulse'), 500);
    }

    // 2. (Opcional) Coloca uma borda laranja no card selecionado
    // Remove de todos primeiro
    document.querySelectorAll('#modulos-list input').forEach(input => {
        const cardDiv = input.nextElementSibling;
        if(cardDiv) {
            // Volta ao original
            cardDiv.classList.remove('ring-2', 'ring-brand-orange', 'bg-orange-50');
        }
    });

    // Adiciona só no escolhido
    const selectedInput = document.querySelector(`input[value="${id}"]`);
    if(selectedInput) {
        const selectedCard = selectedInput.nextElementSibling;
        if(selectedCard) {
            selectedCard.classList.add('ring-2', 'ring-brand-orange', 'bg-orange-50');
        }
    }
}
// --- FUNÇÃO QUE FALTOU: Alterna entre Select e Input ---
function toggleCustomCity() {
    const select = document.getElementById('lead-city-select');
    const customDiv = document.getElementById('custom-city-div');
    const customInput = document.getElementById('lead-city-input');

    if (select && customDiv && customInput) {
        if (select.value === 'outra') {
            // Mostra o campo de digitar
            customDiv.classList.remove('hidden');
            customInput.focus();
        } else {
            // Esconde e limpa
            customDiv.classList.add('hidden');
            customInput.value = '';
        }
    }
}

// Substitua ou adicione esta função no final do seu script.js

async function loadCities(filterState = "SP") {
    const citySelect = document.getElementById('lead-city-select');
    if (!citySelect) return;

    // 1. Feedback visual enquanto carrega
    citySelect.innerHTML = `<option value="" disabled selected>Carregando cidades de ${filterState}...</option>`;

    // 2. Busca no Supabase com Filtro
    if (supabaseClient) {
        try {
            console.log(`🏙️ Buscando no Supabase: cidades de ${filterState}`);

            const { data, error } = await supabaseClient
                .from('cities')
                .select('*')
                .eq('uf', filterState) // 🚨 FILTRO REAL NO BANCO: Busca apenas onde a coluna 'uf' é igual ao estado
                .order('name', { ascending: true }); // Ou 'nome', dependendo da sua coluna

            if (!error && data && data.length > 0) {
                renderCityOptions(data);
                return; // Sucesso, sai da função
            } else if (error) {
                console.error("Erro no filtro do Supabase:", error.message);
            }
        } catch (err) {
            console.error("Erro crítico na busca:", err);
        }
    }

    // 3. Backup de Segurança (Caso o banco falhe ou não tenha cidades desse estado)
    console.warn("⚠️ Usando backup para cidades.");
    const backup = [
        { name: "Araçatuba", hsp: 5.15, uf: "SP" },
        { name: "Campo Grande", hsp: 5.30, uf: "MS" }
    ].filter(c => c.uf === filterState);

    renderCityOptions(backup);
}

// Função auxiliar para montar o HTML
function renderCityOptions(cities) {
    const citySelect = document.getElementById('lead-city-select');
    let html = `<option value="" disabled selected>Selecione a cidade...</option>`;

    cities.forEach(city => {
        // Ajuste 'nome' ou 'name' conforme seu banco
        const cityName = city.name || city.nome;
        html += `<option value="${cityName}" data-hsp="${city.hsp}">${cityName}</option>`;
    });

    html += `<option value="outra" class="text-brand-orange font-bold">+ Outra Cidade...</option>`;
    citySelect.innerHTML = html;
}

// --- MODAIS DE PRIVACIDADE E TERMOS DE USO ---

function openPolicy(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('policy-modal');
    const backdrop = document.getElementById('policy-backdrop');
    const panel = document.getElementById('policy-panel');

    modal.classList.remove('hidden');
    // Pequeno atraso para a animação de transição funcionar
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        panel.classList.remove('opacity-0', 'translate-y-4', 'sm:scale-95');
    }, 10);
}

function closePolicy() {
    const modal = document.getElementById('policy-modal');
    const backdrop = document.getElementById('policy-backdrop');
    const panel = document.getElementById('policy-panel');

    backdrop.classList.add('opacity-0');
    panel.classList.add('opacity-0', 'translate-y-4', 'sm:scale-95');

    // Espera a animação terminar para esconder a div
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function openTerms(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById('terms-modal');
    const backdrop = document.getElementById('terms-backdrop');
    const panel = document.getElementById('terms-panel');

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        panel.classList.remove('opacity-0', 'translate-y-4', 'sm:scale-95');
    }, 10);
}

function closeTerms() {
    const modal = document.getElementById('terms-modal');
    const backdrop = document.getElementById('terms-backdrop');
    const panel = document.getElementById('terms-panel');

    backdrop.classList.add('opacity-0');
    panel.classList.add('opacity-0', 'translate-y-4', 'sm:scale-95');

    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// Opcional: Funções do Banner de Cookies que também faltavam
function acceptEssential() {
    document.getElementById('cookie-banner').classList.add('translate-y-full');
}
function acceptAll() {
    document.getElementById('cookie-banner').classList.add('translate-y-full');
}