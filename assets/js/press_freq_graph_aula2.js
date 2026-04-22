document.addEventListener('DOMContentLoaded', function() {
    
    // Constantes do modelo
    const K1 = 2.54;
    const K2 = 6.46;

    // Elementos da Interface
    const selVar = document.getElementById('sel-var');
    const baseInputs = {
        'N': document.getElementById('base-n'),
        'L': document.getElementById('base-l'),
        'T': document.getElementById('base-t'),
        'm': document.getElementById('base-m')
    };
    
    const valInputs = [
        document.getElementById('val-1'),
        document.getElementById('val-2'),
        document.getElementById('val-3'),
        document.getElementById('val-4'),
        document.getElementById('val-5')
    ];

    const btnPlot = document.getElementById('btn-plot');
    
    // Textos que atualizam dinamicamente
    const lblTestVar = document.getElementById('lbl-var-test');
    const lblsEixoX = document.querySelectorAll('.lbl-eixo-x');

    // Variáveis para guardar as instâncias dos gráficos da Chart.js
    let chartFreqInstance = null;
    let chartPressInstance = null;

    // Valores padrões sugeridos (para facilitar a vida do aluno ao trocar a variável)
    const defaultTestValues = {
        'N': [50, 100, 150, 200, 250],
        'L': [30, 50, 70, 90, 110],
        'T': [100, 200, 300, 400, 500],
        'm': [10, 30, 50, 70, 90]
    };

    // 1. Lógica de alteração do Menu (Dropdown)
    selVar.addEventListener('change', function() {
        const v = selVar.value; // 'N', 'L', 'T' ou 'm'
        
        // Atualiza os títulos
        lblTestVar.innerText = v;
        lblsEixoX.forEach(lbl => lbl.innerText = v);

        // Habilita todos, e desabilita apenas o que virou Eixo X
        for (let key in baseInputs) {
            baseInputs[key].disabled = false;
            baseInputs[key].style.opacity = '1';
        }
        baseInputs[v].disabled = true;
        baseInputs[v].style.opacity = '0.5';

        // Preenche com os valores sugeridos
        for(let i = 0; i < 5; i++) {
            valInputs[i].value = defaultTestValues[v][i];
        }
    });

    // 2. Lógica de Cálculo e Desenho
    btnPlot.addEventListener('click', function() {
        const v = selVar.value;
        
        // Pega valores base
        const bN = parseFloat(baseInputs['N'].value);
        const bL = parseFloat(baseInputs['L'].value);
        const bT = parseFloat(baseInputs['T'].value);
        const bm = parseFloat(baseInputs['m'].value);

        // Prepara arrays para o gráfico
        let eixoX = [];
        let eixoFreq = [];
        let eixoPressao = [];

        // Para cada um dos 5 pontos...
        for(let i = 0; i < 5; i++) {
            let xVal = parseFloat(valInputs[i].value);
            eixoX.push(xVal);

            // Substitui apenas a variável que está variando
            let N = (v === 'N') ? xVal : bN;
            let L = (v === 'L') ? xVal : bL;
            let T = (v === 'T') ? xVal : bT;
            let m = (v === 'm') ? xVal : bm;

            // Cálculos teóricos (Eq. TC2.6 e TC2.7)
            let f = K1 * (N / L) * Math.sqrt(T / m);
            let P = K2 * (N * T) / (L * L); // A = L^2

            eixoFreq.push(f.toFixed(2));
            eixoPressao.push(P.toFixed(2));
        }

        // Desenha os gráficos
        desenharGraficoFreq(eixoX, eixoFreq, v);
        desenharGraficoPressao(eixoX, eixoPressao, v);
    });

    // --- FUNÇÕES DE DESENHO (CHART.JS) ---
    function desenharGraficoFreq(xData, yData, labelX) {
        const ctx = document.getElementById('chart-freq').getContext('2d');
        
        // Se já existir um gráfico, destrói para desenhar o novo
        if (chartFreqInstance) chartFreqInstance.destroy();

        chartFreqInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xData,
                datasets: [{
                    label: 'Frequência (f)',
                    data: yData,
                    borderColor: '#003366',
                    backgroundColor: 'rgba(0, 51, 102, 0.1)',
                    borderWidth: 3,
                    pointRadius: 6,
                    fill: true,
                    tension: 0.3 // Deixa a linha suave
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: `Variável ${labelX}` } },
                    y: { title: { display: true, text: 'Frequência' } }
                }
            }
        });
    }

    function desenharGraficoPressao(xData, yData, labelX) {
        const ctx = document.getElementById('chart-press').getContext('2d');
        
        if (chartPressInstance) chartPressInstance.destroy();

        chartPressInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xData,
                datasets: [{
                    label: 'Pressão (P)',
                    data: yData,
                    borderColor: '#d9534f',
                    backgroundColor: 'rgba(217, 83, 79, 0.1)',
                    borderWidth: 3,
                    pointRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: `Variável ${labelX}` } },
                    y: { title: { display: true, text: 'Pressão' } }
                }
            }
        });
    }

    // Ao carregar a página, já gera os gráficos iniciais automaticamente
    btnPlot.click();
});
