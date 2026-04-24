function iniciarLaboratorioGraficos() {
    // Busca os elementos essenciais da interface
    const selVar = document.getElementById('sel-var');
    const btnPlot = document.getElementById('btn-plot');
    
    // TRAVA DE SEGURANÇA
    if (!selVar || !btnPlot) return; 

    console.log("Laboratório de Gráficos (Aula 2) detectado e iniciado!");

    const K1 = 2.54;
    const K2 = 6.46;

    // Caixas de texto da coluna 1 (Valores Fixos)
    const baseInputs = {
        'N': document.getElementById('base-n'),
        'L': document.getElementById('base-l'),
        'T': document.getElementById('base-t'),
        'm': document.getElementById('base-m')
    };
    
    // Caixas de texto da coluna 2 (Valores para o Gráfico)
    const valInputs = [
        document.getElementById('val-1'),
        document.getElementById('val-2'),
        document.getElementById('val-3'),
        document.getElementById('val-4'),
        document.getElementById('val-5')
    ];

    // Elementos de texto que mudam dinamicamente
    const lblTestVar = document.getElementById('lbl-var-test');
    const lblsEixoX = document.querySelectorAll('.lbl-eixo-x');

    // Variáveis que vão guardar as instâncias dos gráficos
    let chartFreqInstance = null;
    let chartPressInstance = null;

    // Valores padrão
    const defaultTestValues = {
        'N': [50, 100, 150, 200, 250],
        'L': [30, 50, 70, 90, 110],
        'T': [100, 200, 300, 400, 500],
        'm': [10, 30, 50, 70, 90]
    };


    selVar.addEventListener('change', function() {
        const v = selVar.value; // 'N', 'L', 'T' ou 'm'
        
        // Atualiza os títulos visuais
        lblTestVar.innerText = v;
        lblsEixoX.forEach(lbl => lbl.innerText = v);

        // Libera todos os campos fixos e bloqueia apenas o que virou eixo X
        for (let key in baseInputs) {
            baseInputs[key].disabled = false;
            baseInputs[key].style.opacity = '1';
        }
        baseInputs[v].disabled = true;
        baseInputs[v].style.opacity = '0.5';

        // Preenche automaticamente os 5 pontos com os valores padrão
        for(let i = 0; i < 5; i++) {
            valInputs[i].value = defaultTestValues[v][i];
        }
    });

    btnPlot.addEventListener('click', function() {
        // Verifica se a biblioteca Chart.js carregou corretamente pelo base.html
        if (typeof Chart === 'undefined') {
            console.warn("Aguardando carregamento da biblioteca Chart.js...");
            return;
        }

        const v = selVar.value;
        
        // Pega os valores da configuração base
        const bN = parseFloat(baseInputs['N'].value);
        const bL = parseFloat(baseInputs['L'].value);
        const bT = parseFloat(baseInputs['T'].value);
        const bm = parseFloat(baseInputs['m'].value);

        let eixoX = [];
        let eixoFreq = [];
        let eixoPressao = [];

        // Para cada um dos 5 pontos, faz os cálculos teóricos
        for(let i = 0; i < 5; i++) {
            let xVal = parseFloat(valInputs[i].value);
            eixoX.push(xVal);

            // Define se a variável vai usar o valor do teste (eixo X) ou o valor fixo
            let N = (v === 'N') ? xVal : bN;
            let L = (v === 'L') ? xVal : bL;
            let T = (v === 'T') ? xVal : bT;
            let m = (v === 'm') ? xVal : bm;

            let f = K1 * (N / L) * Math.sqrt(T / m);
            let P = K2 * (N * T) / (L * L); 

            // Guarda formatado com 2 casas decimais
            eixoFreq.push(f.toFixed(2));
            eixoPressao.push(P.toFixed(2));
        }

        //desenhar os gráficos
        desenharGraficoFreq(eixoX, eixoFreq, v);
        desenharGraficoPressao(eixoX, eixoPressao, v);
    });

    function desenharGraficoFreq(xData, yData, labelX) {
        const ctx = document.getElementById('chart-freq').getContext('2d');
        if (chartFreqInstance) chartFreqInstance.destroy();

        // Garante que ambos são números para o plano cartesiano
        const dadosReais = xData.map((xVal, index) => ({ 
            x: parseFloat(xVal), 
            y: parseFloat(yData[index]) 
        }));

        chartFreqInstance = new Chart(ctx, {
            type: 'scatter', 
            data: {
                datasets: [{
                    label: 'Frequência (f)',
                    data: dadosReais,
                    showLine: true,  
                    borderColor: '#003366',
                    backgroundColor: 'rgba(0, 51, 102, 0.1)',
                    borderWidth: 3, 
                    pointRadius: 6, 
                    fill: false, 
                    tension: 0.3
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        type: 'linear', 
                        title: { display: true, text: `Variável ${labelX}` } 
                    },
                    y: { 
                        title: { display: true, text: 'Frequência' } 
                    }
                }
            }
        });
    }

    function desenharGraficoPressao(xData, yData, labelX) {
        const ctx = document.getElementById('chart-press').getContext('2d');
        if (chartPressInstance) chartPressInstance.destroy();

        const dadosReais = xData.map((xVal, index) => ({ 
            x: parseFloat(xVal), 
            y: parseFloat(yData[index]) 
        }));

        chartPressInstance = new Chart(ctx, {
            type: 'scatter', 
            data: {
                datasets: [{
                    label: 'Pressão (p)',
                    data: dadosReais,
                    showLine: true,  
                    borderColor: '#d9534f',
                    backgroundColor: 'rgba(217, 83, 79, 0.1)',
                    borderWidth: 3, 
                    pointRadius: 6, 
                    fill: false, 
                    tension: 0.3
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        type: 'linear', 
                        title: { display: true, text: `Variável ${labelX}` } 
                    },
                    y: { 
                        title: { display: true, text: 'Pressão' } 
                    }
                }
            }
        });
    }

    // Desenha automaticamente ao abrir
    setTimeout(() => { 
        if(btnPlot) btnPlot.click(); 
    }, 500); 
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarLaboratorioGraficos);
} else {
    iniciarLaboratorioGraficos();
}
