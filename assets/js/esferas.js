document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('esferas-rigidas') || document.getElementById('aula-5-virtual-lab');
  if (!container) return;

  // --- VARIÁVEIS GLOBAIS ---
  let isCalculating = false;
  let allSimsData = []; // Guardará os dados das 3 simulações
  let simulationHistory = [];

  // Reprodução Sincronizada
  let isPlaying = false;
  let currentFrameIdx = 0;
  let exactFrame = 0;
  let animId = null;

  // Elementos DOM
  const btnRun = document.getElementById('btn-run');
  const uiProgress = document.getElementById('ui-progress');
  const uiVis = document.getElementById('ui-visualization');
  const progText = document.getElementById('progress-text');
  
  const btnPlay = document.getElementById('btn-play');
  const scrubber = document.getElementById('inp-scrubber');

  // Canvas e SVGs das 3 instâncias
  const canvasCtxs = [
    document.getElementById('sim-canvas-1')?.getContext('2d'),
    document.getElementById('sim-canvas-2')?.getContext('2d'),
    document.getElementById('sim-canvas-3')?.getContext('2d')
  ];
  const svgFreqs = [
    document.getElementById('svg-freq-1'),
    document.getElementById('svg-freq-2'),
    document.getElementById('svg-freq-3')
  ];

  // --- UTILS ---
  function randomUniform(min, max) { return Math.random() * (max - min) + min; }
  function gaussian(a, b, v) { return a * Math.exp(-b*(v**2)); }
  function getSpeedColor(vx, vy, vmax) {
    const speed = Math.hypot(vx, vy);
    let ratio = speed / (vmax * 0.8);
    if (ratio > 1) ratio = 1; 
    const r = Math.round(255 * ratio);
    const b = Math.round(255 * (1 - ratio));
    return `rgb(${r}, 0, ${b})`;
  }

  // --- CLASSE BOLA ---
  class Bola {
    constructor(radius, mass, x, y, vx, vy, color) {
      this.radius = radius; this.mass = mass;
      this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color;
    }
    advance(dt, edge, simRef) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.x + this.radius >= edge) { this.x = edge - this.radius; this.vx *= -1; simRef.colisaoContador++; } 
      if (this.x - this.radius <= 0) { this.x = this.radius; this.vx *= -1; simRef.colisaoContador++; }
      if (this.y + this.radius >= edge) { this.y = edge - this.radius; this.vy *= -1; simRef.colisaoContador++; } 
      if (this.y - this.radius <= 0) { this.y = this.radius; this.vy *= -1; simRef.colisaoContador++; }
    }
  }

  // --- SIMULAÇÃO ---
  async function runSimulation() {
    if (isCalculating) return;
    isCalculating = true;

    const inputSigma = document.getElementById('inp-sigma');
    const sigma = inputSigma ? parseFloat(inputSigma.value) : null;
    
    const params = {
      n1: Number(document.getElementById('inp-n1').value),
      r1: sigma !== null ? (sigma / 2.0) : Number(document.getElementById('inp-r1').value),
      m1: Number(document.getElementById('inp-m1').value),
      n2: Number(document.getElementById('inp-n2').value),
      r2: Number(document.getElementById('inp-r2').value),
      m2: Number(document.getElementById('inp-m2').value),
      T: Number(document.getElementById('inp-T').value),
      steps: Number(document.getElementById('inp-steps').value),
      edge: Number(document.getElementById('inp-edge').value),
      dt: Number(document.getElementById('inp-dt').value),
      freqInterval: Number(document.getElementById('inp-freqInterval').value)
    };

    btnRun.disabled = true;
    btnRun.innerText = "Calculando...";
    uiProgress.style.display = 'block';
    uiVis.style.display = 'none';
    
    allSimsData = []; // Limpa os dados anteriores
    
    const k1 = 5.0;
    const sigma1 = Math.sqrt(k1 * params.T / params.m1);
    const vmaxHist = 3.5 * sigma1;

    // LAÇO PRINCIPAL: RODAR 3 VEZES
    for (let simIndex = 0; simIndex < 3; simIndex++) {
      
      let frames = []; 
      let frequencyData = [{ step: 0, count: 0 }]; 
      const particles = [];
      const simObj = { colisaoContador: 0 }; 

      const placeParticles = (count, r, m, baseColor) => {
        let placed = 0; let attempts = 0;
        const maxAttempts = count * 2000;
        const sigmaLocal = Math.sqrt(k1 * params.T / m);
        const b = 1 / (sigmaLocal**2);
        const a = Math.sqrt(b/Math.PI);
        const vmax = 3*sigmaLocal; const vmin = -vmax;
        const slices = 40; const window = (vmax - vmin)/slices;
        const prob_wind = [];

        for (let i = 0; i < slices; i++) {        
          const l_bound = vmin + i * window;
          const u_bound = l_bound + window;
          prob_wind.push((gaussian(a,b,u_bound) + gaussian(a,b,l_bound))*window/2);
        }

        while (placed < count && attempts < maxAttempts) {
          attempts++;
          const x = Math.random() * (params.edge - 2*r) + r;
          const y = Math.random() * (params.edge - 2*r) + r;
          
          let overlap = false;
          for (let p of particles) {
            if (Math.hypot(x - p.x, y - p.y) <= (r + p.radius)) { overlap = true; break; }
          }
          
          if (!overlap) {
            let vx, vy;
            while (true) {
              vx = randomUniform(vmin,vmax); vy = randomUniform(vmin,vmax);
              const wx = Math.random(); const wy = Math.random();
              let ix = Math.floor(((vx - vmin) / (vmax - vmin)) * slices);
              let iy = Math.floor(((vy - vmin) / (vmax - vmin)) * slices);
              ix = Math.max(0, Math.min(ix, slices - 1));
              iy = Math.max(0, Math.min(iy, slices - 1));
              if (wx <= prob_wind[ix] && wy <= prob_wind[iy]) break;
            }    
            particles.push(new Bola(r, m, x, y, vx, vy, baseColor));
            placed++;
          }
        }
      };

      // Coloca as partículas para esta instância específica
      placeParticles(params.n1, params.r1, params.m1, '#4caf50');
      
      const chunkSize = 100; 
      let lastCollisionCount = 0;

      // O LOOP DE TEMPO DA FÍSICA
      for (let step = 0; step < params.steps; step++) {
        for (let p of particles) p.advance(params.dt, params.edge, simObj);
        
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i]; const p2 = particles[j];
            const dx = p2.x - p1.x; const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const sumRadius = p1.radius + p2.radius;

            if (dist <= sumRadius) {
               const safeDist = dist === 0 ? 1e-8 : dist;
               const theta = Math.atan2(dy, dx);
               const vn1 = Math.cos(theta) * p1.vx + Math.sin(theta) * p1.vy;
               const vn2 = Math.cos(theta) * p2.vx + Math.sin(theta) * p2.vy;
               const vt1 = -Math.sin(theta) * p1.vx + Math.cos(theta) * p1.vy;
               const vt2 = -Math.sin(theta) * p2.vx + Math.cos(theta) * p2.vy;
               
               const un1 = ((p1.mass - p2.mass) * vn1 + 2 * p2.mass * vn2) / (p1.mass + p2.mass);
               const un2 = ((p2.mass - p1.mass) * vn2 + 2 * p1.mass * vn1) / (p1.mass + p2.mass);
               
               p1.vx = Math.cos(theta) * un1 - Math.sin(theta) * vt1;
               p1.vy = Math.sin(theta) * un1 + Math.cos(theta) * vt1;
               p2.vx = Math.cos(theta) * un2 - Math.sin(theta) * vt2;
               p2.vy = Math.sin(theta) * un2 + Math.cos(theta) * vt2;

               const overlap = sumRadius - safeDist;
               if (overlap > 0) {
                 p1.x -= (dx / safeDist) * (overlap / 2); p1.y -= (dy / safeDist) * (overlap / 2);
                 p2.x += (dx / safeDist) * (overlap / 2); p2.y += (dy / safeDist) * (overlap / 2);
               }
            }
          }
        }
        
        const stride = Math.max(1, Math.floor(params.steps / 1000));
        
        // Salva os frames para o Canvas
        if (step % stride === 0 || step === params.steps - 1) {
          frames.push(particles.map(p => ({ x: p.x, y: p.y, r: p.radius, c: getSpeedColor(p.vx, p.vy, vmaxHist) })));
        }

        // Frequência de Colisões
        if (step > 0 && step % params.freqInterval === 0) {
          frequencyData.push({ step, count: simObj.colisaoContador - lastCollisionCount });
          lastCollisionCount = simObj.colisaoContador;
        }

        // Atualiza a barra de progresso Global (0 a 100% cobrindo as 3 sims)
        if (step % chunkSize === 0) {
          const totalStepsGlobal = params.steps * 3;
          const currentStepGlobal = (simIndex * params.steps) + step;
          const p = (currentStepGlobal / totalStepsGlobal) * 100;
          progText.innerText = `Progresso: ${p.toFixed(1)}% (Calculando Simulação ${simIndex + 1}/3)`;
          await new Promise(r => setTimeout(r, 0)); // Evita travamento da UI
        }
      }

      // Calcula a média dos 80% finais para esta simulação específica
      let avg = 0; 
      if (frequencyData && frequencyData.length > 5) {
        const startIdx = Math.floor(frequencyData.length * 0.2);
        const last80 = frequencyData.slice(startIdx);
        const sum = last80.reduce((acc, d) => acc + d.count, 0);
        avg = sum / last80.length;
      }

      // Salva tudo no array global
      allSimsData.push({
        frames: frames,
        frequencyData: frequencyData,
        avgFreq: avg
      });
    }

    // --- PÓS-CÁLCULO E HISTÓRICO ---
    const currentN = params.n1;
    const currentT = params.T;
    const currentM = params.m1;
    const currentL = params.edge;
    const currentSigma = sigma;

    // Adiciona ao histórico os 3 f encontrados
    simulationHistory.unshift({
      n: currentN, t: currentT, m: currentM, l: currentL, sigma: currentSigma,
      f1: isNaN(allSimsData[0].avgFreq) ? '--' : allSimsData[0].avgFreq.toFixed(2),
      f2: isNaN(allSimsData[1].avgFreq) ? '--' : allSimsData[1].avgFreq.toFixed(2),
      f3: isNaN(allSimsData[2].avgFreq) ? '--' : allSimsData[2].avgFreq.toFixed(2)
    });

    if (simulationHistory.length > 3) simulationHistory.pop();

    const historyContainer = document.getElementById('history-box-content');
    if (historyContainer) {
      historyContainer.innerHTML = simulationHistory.map((sim, index) => {
        let parametrosTexto = `N=${sim.n}, T=${sim.t}, m=${sim.m}, L=${sim.l}, &sigma;=${sim.sigma}`;
        return `
        <div style="font-size: 0.85em; border-bottom: ${index === simulationHistory.length - 1 ? 'none' : '1px solid #eee'}; padding: 6px 0;">
          <span style="color: ${index === 0 ? '#ff9800' : '#888'}; font-weight: bold;">
            ${index === 0 ? 'ATUAL' : 'Anterior'}
          </span>: 
          ${parametrosTexto} <br>
          &rarr; <b>f1:</b> ${sim.f1} | <b>f2:</b> ${sim.f2} | <b>f3:</b> ${sim.f3}
        </div>
        `;
      }).join('');
    }

    isCalculating = false;
    btnRun.disabled = false;
    btnRun.innerText = "Recalcular Novas 3 Simulações";
    uiProgress.style.display = 'none';
    uiVis.style.display = 'flex';
    
    // Configura o Scrubber com base no tamanho dos frames da primeira simulação (todas têm o mesmo tamanho)
    scrubber.max = allSimsData[0].frames.length - 1;
    currentFrameIdx = 0;
    exactFrame = 0;
    
    drawFrame(0);
    updateCharts(0, params.steps);
  } 

  // --- DESENHO EM TRIPLICATA ---
  function drawFrame(idx) {
    const edge = Number(document.getElementById('inp-edge').value);
    
    // Loop nas 3 telas
    for (let i = 0; i < 3; i++) {
      const ctx = canvasCtxs[i];
      if (!ctx || !allSimsData[i] || !allSimsData[i].frames[idx]) continue;
      
      const canvas = ctx.canvas;
      const scale = canvas.width / edge;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let p of allSimsData[i].frames[idx]) {
        const drawRadius = p.r === 0 ? 0.5 : p.r;
        ctx.beginPath();
        ctx.arc(p.x * scale, (edge - p.y) * scale, drawRadius * scale, 0, Math.PI * 2);
        ctx.fillStyle = p.c; ctx.fill();
        ctx.lineWidth = 0.5; ctx.strokeStyle = '#333'; ctx.stroke();
      }
    }
  }

  // Animação Mestra
  function playLoop() {
    const scaleV = document.getElementById('inp-scaleV').checked;
    const T = Number(document.getElementById('inp-T').value);
    const speedFactor = scaleV ? Math.sqrt(Math.max(1, T) / 1000) : 1.0;
    
    const maxFrames = allSimsData[0].frames.length;

    if (exactFrame < maxFrames - 1) {
      exactFrame += speedFactor;
      if (exactFrame >= maxFrames - 1) { exactFrame = maxFrames - 1; isPlaying = false; }
      
      currentFrameIdx = Math.floor(exactFrame);
      scrubber.value = currentFrameIdx;
      drawFrame(currentFrameIdx);
      updateCharts(currentFrameIdx, Number(document.getElementById('inp-steps').value));
      
      if (isPlaying) animId = requestAnimationFrame(playLoop);
      else { resetPlayBtn(); }
    } else {
      isPlaying = false;
      resetPlayBtn();
    }
  }

  function resetPlayBtn() {
    btnPlay.innerText = 'Reproduzir';
    btnPlay.classList.remove('jsbox-btn-warning');
    btnPlay.classList.add('jsbox-btn-success');
  }

  btnPlay.addEventListener('click', () => {
    if (isPlaying) {
      cancelAnimationFrame(animId);
      isPlaying = false;
      resetPlayBtn();
    } else {
      isPlaying = true;
      btnPlay.innerText = 'Pausar';
      btnPlay.classList.remove('jsbox-btn-success');
      btnPlay.classList.add('jsbox-btn-warning');
      
      const maxFrames = allSimsData[0].frames.length;
      if (currentFrameIdx >= maxFrames - 1) { currentFrameIdx = 0; exactFrame = 0; }
      else { exactFrame = currentFrameIdx; }
      playLoop();
    }
  });

  scrubber.addEventListener('input', (e) => {
    currentFrameIdx = Number(e.target.value);
    exactFrame = currentFrameIdx;
    drawFrame(currentFrameIdx);
    updateCharts(currentFrameIdx, Number(document.getElementById('inp-steps').value));
  });

  // --- RENDERIZAÇÃO DOS 3 GRÁFICOS (SVG) ---
  function updateCharts(fIdx, totalSteps) {
    const drawAxes = (maxY) => {
      let html = `
        <line x1="60" y1="300" x2="600" y2="300" stroke="#ccc" />
        <line x1="60" y1="300" x2="60" y2="20" stroke="#ccc" />
        <text x="55" y="25" text-anchor="end" font-size="12" fill="#555">${maxY.toFixed(0)}</text>
        <text x="55" y="300" text-anchor="end" font-size="12" fill="#555">0</text>
        <text x="30" y="160" text-anchor="middle" transform="rotate(-90, 30, 160)" font-size="12" fill="#888">Colisões</text>
      `;
      for (let i = 0; i <= 5; i++) {
        let x = 60 + (i / 5) * 540;
        html += `<line x1="${x}" y1="300" x2="${x}" y2="305" stroke="#aaa" />
                 <text x="${x}" y="320" text-anchor="middle" font-size="11" fill="#666">${Math.round((totalSteps/5)*i)}</text>`;
      }
      return html;
    };

    const createPathStr = (data, maxYRef) => {
      if (!data || !data.length) return "";
      let d = `M 60 ${300 - (data[0].count / maxYRef) * 280}`;
      for (let point of data) {
        d += ` L ${60 + (point.step / totalSteps) * 540} ${300 - (point.count / maxYRef) * 280}`;
      }
      return d;
    };

    // Atualiza os 3 SVGs
    for (let i = 0; i < 3; i++) {
      const svg = svgFreqs[i];
      if (!svg || !allSimsData[i]) continue;

      const simData = allSimsData[i].frequencyData;
      
      // Filtra o passo atual com base no fIdx
      const maxRenderStep = (fIdx / (allSimsData[i].frames.length - 1)) * totalSteps;
      const curFreq = simData.filter(d => d.step <= maxRenderStep);
      
      const maxFreq = simData.length > 1 ? Math.max(...simData.map(d => d.count)) : 0;
      const frequencyMaxY = maxFreq > 0 ? maxFreq * 1.1 : 10;

      let freqHTML = drawAxes(frequencyMaxY);
      freqHTML += `<path d="${createPathStr(curFreq, frequencyMaxY)}" fill="none" stroke="#ff9800" stroke-width="2" />`;
      
      // Linha de média
      let avgY = 300 - (allSimsData[i].avgFreq / frequencyMaxY) * 280;
      freqHTML += `<line x1="60" y1="${avgY}" x2="600" y2="${avgY}" stroke="#d9534f" stroke-width="2" stroke-dasharray="5,5" opacity="0.7"/>`;
      freqHTML += `<text x="595" y="${avgY - 5}" text-anchor="end" font-size="12" fill="#d9534f" font-weight="bold">f = ${allSimsData[i].avgFreq.toFixed(2)}</text>`;
      
      svg.innerHTML = freqHTML;
    }
  }

  btnRun.addEventListener('click', runSimulation);

  // BOTÃO DE LIMPAR HISTÓRICO
  const btnClearHistory = document.getElementById('btn-clear-history');
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      simulationHistory = []; 
      const historyContainer = document.getElementById('history-box-content');
      if (historyContainer) historyContainer.innerHTML = '<p style="color: #999; font-style: italic; font-size: 0.85em;">Nenhuma simulação realizada.</p>';
    });
  }
});
