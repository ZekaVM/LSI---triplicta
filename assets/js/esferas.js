document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('esferas-rigidas') || document.getElementById('aula-5-virtual-lab');
  if (!container) return;

  // --- VARIÁVEIS GLOBAIS DA TRIPLICATA ---
  let historyX = [null, null, null];
  let historyY = [null, null, null];
  let historyR = [null, null, null];
  let currentWallFreqData = [[], [], []];
  let avgFreqs = [0, 0, 0];
  let simulationHistory = [];

  let totalSteps, numParticles, edgeLength, particleRadius, equilibriumStep;
  let isCalculating = false;
  let isPlaying = false;
  let currentFrame = 0;
  let animationId = null;

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

  // --- UTILS DE PERFORMANCE ---
  function getVisualSpeedMultiplier(T) {
    return Math.pow(T, 0.5) / 10;
  }

  // Substitui a lógica de fatias de probabilidade pesada
  function randomGaussian() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // --- INICIAR A SIMULAÇÃO ---
  btnRun.addEventListener('click', () => {
    if (isCalculating) return;
    isCalculating = true;

    numParticles = parseInt(document.getElementById("inp-n1").value);
    const T = parseFloat(document.getElementById("inp-T").value);
    const m = parseFloat(document.getElementById("inp-m1").value);
    edgeLength = parseFloat(document.getElementById("inp-edge").value);
    
    const inputSigma = document.getElementById('inp-sigma');
    const sigmaEffective = inputSigma ? parseFloat(inputSigma.value) : 1.0;
    const isHardSphereMode = !!inputSigma;
    
    const dt = parseFloat(document.getElementById("inp-dt")?.value || 0.005);
    totalSteps = parseInt(document.getElementById("inp-steps")?.value || 15000);
    
    particleRadius = sigmaEffective / 2;
    equilibriumStep = Math.floor(totalSteps * 0.20); // 20% do tempo para equilibrar

    const boost = getVisualSpeedMultiplier(T);
    const R = 8.314;

    let particlesAll = [[], [], []];

    // Prepara as 3 simulações
    for (let sim = 0; sim < 3; sim++) {
      // Aloca memória de alta velocidade (Typed Arrays)
      historyX[sim] = new Float32Array(numParticles * totalSteps);
      historyY[sim] = new Float32Array(numParticles * totalSteps);
      historyR[sim] = new Uint8Array(numParticles * totalSteps);
      currentWallFreqData[sim] = [];

      // --- 1. INITIALIZATION ---
      for (let i = 0; i < numParticles; i++) {
        let p;
        let overlap = true;
        let attempts = 0;
        
        while (overlap && attempts < 2000) {
          p = {
            x: particleRadius + Math.random() * (edgeLength - sigmaEffective),
            y: particleRadius + Math.random() * (edgeLength - sigmaEffective),
            vx: randomGaussian(),
            vy: randomGaussian()
          };
          
          overlap = false;
          if (isHardSphereMode && sigmaEffective > 0) {
            for (let j = 0; j < particlesAll[sim].length; j++) {
              let dx = p.x - particlesAll[sim][j].x;
              let dy = p.y - particlesAll[sim][j].y;
              if (dx*dx + dy*dy < sigmaEffective * sigmaEffective) {
                overlap = true;
                break;
              }
            }
          }
          attempts++;
        }
        particlesAll[sim].push(p);
      }

      // --- 2. TEMPERATURE SCALING ---
      let vCMx = 0, vCMy = 0;
      for (let p of particlesAll[sim]) { vCMx += p.vx; vCMy += p.vy; }
      vCMx /= numParticles; vCMy /= numParticles;
      for (let p of particlesAll[sim]) { p.vx -= vCMx; p.vy -= vCMy; }

      let currentKinetic = 0;
      for (let p of particlesAll[sim]) {
        currentKinetic += 0.5 * m * (p.vx * p.vx + p.vy * p.vy);
      }

      let targetKinetic = numParticles * R * T;
      let scaleFactor = Math.sqrt(targetKinetic / currentKinetic);

      for (let p of particlesAll[sim]) {
        p.vx *= scaleFactor * boost;
        p.vy *= scaleFactor * boost;
      }
    }

    btnRun.disabled = true;
    btnRun.innerText = "Calculando...";
    uiProgress.style.display = 'block';
    uiVis.style.display = 'none';

    let step = 0;
    let intervalCollisions = [0, 0, 0];
    let wallCollisionCount = [0, 0, 0];
    const intervalSteps = 50; 
    const maxExpectedV = Math.sqrt(R * T) * 1.5;

    // --- 3. SIMULATION LOOP (LAÇO OTIMIZADO) ---
    function computeChunk() {
      const chunkSize = 800;
      const end = Math.min(step + chunkSize, totalSteps);

      for (; step < end; step++) {
        let isEquilibrated = step >= equilibriumStep;

        // Reseta os dados ao atingir o equilíbrio térmico
        if (step === equilibriumStep) {
          intervalCollisions = [0, 0, 0];
          currentWallFreqData = [[], [], []];
        }

        // Roda a física para as 3 simulações no mesmo passo de tempo
        for (let sim = 0; sim < 3; sim++) {
          let collisionsThisStep = 0;
          let particles = particlesAll[sim];

          for (let i = 0; i < numParticles; i++) {
            let p = particles[i];
            p.x += p.vx * dt; p.y += p.vy * dt;

            // Colisões com as Paredes (Usado para a Pressão)
            if (p.x <= particleRadius) {
              p.x = particleRadius; 
              p.vx = Math.abs(p.vx); 
              if (isEquilibrated) { collisionsThisStep++; wallCollisionCount[sim]++; }
            } else if (p.x >= edgeLength - particleRadius) {
              p.x = edgeLength - particleRadius; 
              p.vx = -Math.abs(p.vx); 
              if (isEquilibrated) { collisionsThisStep++; wallCollisionCount[sim]++; }
            }

            if (p.y <= particleRadius) {
              p.y = particleRadius; 
              p.vy = Math.abs(p.vy); 
              if (isEquilibrated) { collisionsThisStep++; wallCollisionCount[sim]++; }
            } else if (p.y >= edgeLength - particleRadius) {
              p.y = edgeLength - particleRadius; 
              p.vy = -Math.abs(p.vy); 
              if (isEquilibrated) { collisionsThisStep++; wallCollisionCount[sim]++; }
            }

            // Colisões entre Partículas (Otimizado com Produto Escalar)
            if (isHardSphereMode && sigmaEffective > 0) {
              for (let j = i + 1; j < numParticles; j++) {
                let p2 = particles[j];
                let dx = p.x - p2.x; 
                let dy = p.y - p2.y;
                let distSq = dx*dx + dy*dy;
                
                if (distSq < sigmaEffective * sigmaEffective) {
                  let dvx = p.vx - p2.vx;
                  let dvy = p.vy - p2.vy;
                  
                  if (dx * dvx + dy * dvy < 0) {
                    let dotProduct = (dx * dvx + dy * dvy) / distSq;
                    p.vx -= dotProduct * dx;
                    p.vy -= dotProduct * dy;
                    p2.vx += dotProduct * dx;
                    p2.vy += dotProduct * dy;
                  }
                }
              }
            }
          }

          // Registro de Frequência para o Gráfico
          if (isEquilibrated) {
            intervalCollisions[sim] += collisionsThisStep;
            let equilibratedStep = step - equilibriumStep;
            if ((equilibratedStep + 1) % intervalSteps === 0) {
              let freqHz = intervalCollisions[sim] / (intervalSteps * dt);
              // Salva o passo real para o gráfico renderizar certinho
              currentWallFreqData[sim].push({ step: step, count: freqHz });
              intervalCollisions[sim] = 0;
            }
          }

          // Gravação na Memória de Alta Velocidade
          let offset = step * numParticles;
          for (let i = 0; i < numParticles; i++) {
            let p = particles[i];
            historyX[sim][offset+i] = p.x;
            historyY[sim][offset+i] = p.y;

            let vFisicaInstantanea = Math.sqrt(p.vx**2 + p.vy**2) / boost;
            let ratio = Math.min(1, vFisicaInstantanea / maxExpectedV);
            historyR[sim][offset + i] = Math.round(ratio * 255);
          }
        }
      }
      
      const pct = Math.floor((step/totalSteps)*100);
      if (step < equilibriumStep) {
        progText.innerText = `Termalizando o sistema: ${pct}%`;
      } else {
        progText.innerText = `Calculando as 3 simulações: ${pct}%`;
      }

      // Permite que o navegador respire antes de calcular o próximo bloco
      if (step < totalSteps) setTimeout(computeChunk, 0);
      else finishSimulation(wallCollisionCount, dt, T, m, sigmaEffective);
    }
    computeChunk();
  });

  // --- FINALIZAÇÃO E HISTÓRICO ---
  function finishSimulation(wallCollisionCount, dt, T, m, sigmaEffective) {
    uiProgress.style.display = "none";
    btnRun.disabled = false;
    btnRun.innerText = "Recalcular Novas 3 Simulações";
    uiVis.style.display = "flex";
    isCalculating = false;
    
    if (scrubber) { scrubber.max = totalSteps - 1; scrubber.value = 0; }
    
    const activeTime = (totalSteps - equilibriumStep) * dt; 
    
    // Calcula as médias das 3
    for(let sim = 0; sim < 3; sim++) {
        avgFreqs[sim] = wallCollisionCount[sim] / activeTime;
    }

    simulationHistory.unshift({
      n: numParticles, t: T, m: m, l: edgeLength, sigma: sigmaEffective,
      f1: isNaN(avgFreqs[0]) ? '--' : avgFreqs[0].toFixed(2),
      f2: isNaN(avgFreqs[1]) ? '--' : avgFreqs[1].toFixed(2),
      f3: isNaN(avgFreqs[2]) ? '--' : avgFreqs[2].toFixed(2)
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

    currentFrame = 0;
    drawFrame(0);
    updateCharts(0, totalSteps);
  }

  // --- RENDERIZAÇÃO DE FRAMES (LEITURA RÁPIDA) ---
  function drawFrame(idx) {
    const scale = canvasCtxs[0].canvas.width / edgeLength;
    const offset = idx * numParticles;

    for (let sim = 0; sim < 3; sim++) {
      const ctx = canvasCtxs[sim];
      if (!ctx || !historyX[sim]) continue;
      
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      for (let i = 0; i < numParticles; i++) {
        // A cor agora é tirada do Uint8Array (historyR) mapeada para um gradiente vermelho-azul
        const redVal = historyR[sim][offset+i];
        ctx.fillStyle = `rgb(${redVal}, 60, 100)`;
        
        ctx.beginPath();
        // Inversão do eixo Y opcional: se quiser manter o Y crescendo pra baixo igual o do seu prof, remova "(edgeLength - )"
        ctx.arc(historyX[sim][offset+i] * scale, historyY[sim][offset+i] * scale, particleRadius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 0.5; ctx.strokeStyle = '#333'; ctx.stroke();
      }
    }
  }

  // --- CONTROLE DE ANIMAÇÃO ---
  if (btnPlay) {
    btnPlay.onclick = () => {
      isPlaying = !isPlaying;
      btnPlay.innerText = isPlaying ? "Pausar" : "Reproduzir";
      
      if(isPlaying) {
        btnPlay.classList.remove('jsbox-btn-success');
        btnPlay.classList.add('jsbox-btn-warning');
        animate();
      } else {
        btnPlay.classList.remove('jsbox-btn-warning');
        btnPlay.classList.add('jsbox-btn-success');
      }
    };
  }

  function animate() {
    if(!isPlaying) return;
    currentFrame += 5; // Pula de 5 em 5 frames para ficar visualmente fluido
    if(currentFrame >= totalSteps) { 
      currentFrame = 0; 
      isPlaying = false; 
      btnPlay.innerText = "Reproduzir"; 
      btnPlay.classList.remove('jsbox-btn-warning');
      btnPlay.classList.add('jsbox-btn-success');
      return; 
    }
    
    if(scrubber) scrubber.value = currentFrame;
    drawFrame(currentFrame);
    updateCharts(currentFrame, totalSteps);
    requestAnimationFrame(animate);
  }

  if (scrubber) {
    scrubber.oninput = () => { 
      currentFrame = parseInt(scrubber.value); 
      drawFrame(currentFrame); 
      updateCharts(currentFrame, totalSteps);
    };
  }

  // --- RENDERIZAÇÃO DOS 3 GRÁFICOS (SVG) ---
  function updateCharts(fIdx, tSteps) {
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
                 <text x="${x}" y="320" text-anchor="middle" font-size="11" fill="#666">${Math.round((tSteps/5)*i)}</text>`;
      }
      return html;
    };

    const createPathStr = (data, maxYRef) => {
      if (!data || !data.length) return "";
      let d = `M 60 ${300 - (data[0].count / maxYRef) * 280}`;
      for (let point of data) {
        d += ` L ${60 + (point.step / tSteps) * 540} ${300 - (point.count / maxYRef) * 280}`;
      }
      return d;
    };

    for (let i = 0; i < 3; i++) {
      const svg = svgFreqs[i];
      if (!svg || currentWallFreqData[i].length === 0) continue;

      const simData = currentWallFreqData[i];
      const curFreq = simData.filter(d => d.step <= fIdx);
      
      const maxFreq = simData.length > 1 ? Math.max(...simData.map(d => d.count)) : 0;
      const frequencyMaxY = maxFreq > 0 ? maxFreq * 1.1 : 10;

      let freqHTML = drawAxes(frequencyMaxY);
      freqHTML += `<path d="${createPathStr(curFreq, frequencyMaxY)}" fill="none" stroke="#ff9800" stroke-width="2" />`;
      
      // Linha de média
      let avgY = 300 - (avgFreqs[i] / frequencyMaxY) * 280;
      // Impede que a linha de média fuja do limite do SVG
      avgY = Math.max(20, Math.min(300, avgY));
      
      freqHTML += `<line x1="60" y1="${avgY}" x2="600" y2="${avgY}" stroke="#d9534f" stroke-width="2" stroke-dasharray="5,5" opacity="0.7"/>`;
      freqHTML += `<text x="595" y="${avgY - 5}" text-anchor="end" font-size="12" fill="#d9534f" font-weight="bold">f = ${avgFreqs[i].toFixed(2)}</text>`;
      
      svg.innerHTML = freqHTML;
    }
  }

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
