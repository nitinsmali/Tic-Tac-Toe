// student-friendly Tic Tac Toe (separate file)
// features: separate files, minimax (hard), easy CPU, localStorage persistence,
// dynamic win-line (getTotalLength), aria-live updates, confetti, theme toggle.

(() => {
  // --- Constants & state ---
  const STORAGE = 'tic-tac-toe-student-v1';
  const WIN_COMBINATIONS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  let boardState = Array(9).fill(null); // null | 'X' | 'O'
  let turn = 'X';
  let starting = 'X';
  let gameOver = false;
  let vsCPU = false;
  let aiLevel = 'easy'; // 'easy' or 'hard'
  let scores = { X:0, O:0, T:0 };
  let confettiAnimating = false;

  // --- DOM refs ---
  const cells = Array.from(document.querySelectorAll('.cell'));
  const startBtn = document.getElementById('startBtn');
  const swapBtn = document.getElementById('swapBtn');
  const clearBtn = document.getElementById('clearBtn');
  const resetBtn = document.getElementById('resetBtn');
  const newRoundBtn = document.getElementById('newRoundBtn');
  const aiToggle = document.getElementById('aiToggle');
  const aiLevelSel = document.getElementById('aiLevel');
  const playerXInput = document.getElementById('playerX');
  const playerOInput = document.getElementById('playerO');
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreTEl = document.getElementById('scoreT');
  const nameXEl = document.getElementById('nameX');
  const nameOEl = document.getElementById('nameO');
  const turnAvatar = document.getElementById('turnAvatar');
  const turnName = document.getElementById('turnName');
  const turnSub = document.getElementById('turnSub');
  const gameState = document.getElementById('gameState');
  const lastAction = document.getElementById('lastAction');
  const winLinePath = document.getElementById('winLine');
  const overlaySVG = document.getElementById('overlaySVG');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const hintBtn = document.getElementById('hintBtn');
  const aiPlayBtn = document.getElementById('aiPlayBtn');
  const themeBtn = document.getElementById('themeBtn');

  // audio using WebAudio (simple)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function buzz(freq, t=0.06){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = 0.05;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t);
    setTimeout(()=> o.stop(), t*1000 + 30);
  }

  // confetti canvas setup
  const ctx = confettiCanvas.getContext('2d');
  function resizeCanvas(){ confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; }
  window.addEventListener('resize', resizeCanvas); resizeCanvas();
  let confettiParticles = [];

  // --- Storage helpers ---
  function loadStorage(){
    try {
      const raw = localStorage.getItem(STORAGE);
      if(!raw) return;
      const data = JSON.parse(raw);
      if(data.scores) scores = data.scores;
      if(data.names){
        playerXInput.value = data.names.X || '';
        playerOInput.value = data.names.O || '';
      }
      if(data.starting) starting = data.starting;
      if(typeof data.vsCPU === 'boolean') vsCPU = data.vsCPU;
      if(data.aiLevel) aiLevel = data.aiLevel;
      if(data.theme) document.documentElement.setAttribute('data-theme', data.theme);
    } catch(e){ console.warn(e) }
  }
  function saveStorage(){
    try {
      localStorage.setItem(STORAGE, JSON.stringify({
        scores,
        names: { X: playerXInput.value.trim(), O: playerOInput.value.trim() },
        starting,
        vsCPU,
        aiLevel,
        theme: document.documentElement.getAttribute('data-theme') || 'dark'
      }));
    } catch(e){ console.warn(e) }
  }

  loadStorage();

  // --- UI helpers ---
  function getPlayerName(mark){ return (mark === 'X' ? (playerXInput.value.trim() || 'X') : (playerOInput.value.trim() || 'O')); }
  function renderScores(){
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    scoreTEl.textContent = scores.T;
    nameXEl.textContent = playerXInput.value.trim() || 'X';
    nameOEl.textContent = playerOInput.value.trim() || 'O';
  }

  function renderTurn(){
    turnAvatar.textContent = turn;
    turnAvatar.style.background = (turn === 'X') ? 'linear-gradient(135deg,var(--accent),transparent)' : 'linear-gradient(135deg,var(--accent-2),transparent)';
    turnName.textContent = getPlayerName(turn);
    turnSub.textContent = (turn === starting) ? 'Starting player' : 'Playing';
  }

  // draw board UI
  function updateBoardUI(){
    cells.forEach((c, idx) => {
      const v = boardState[idx];
      c.classList.remove('x','o','taken','win');
      c.textContent = '';
      if(v){
        c.classList.add('taken', v.toLowerCase());
        c.textContent = v === 'X' ? '✕' : '◯';
      }
    });
    renderScores();
  }

  // --- Game logic ---
  function checkWinnerState(boardArr = boardState){
    for(const comb of WIN_COMBINATIONS){
      const [a,b,c] = comb;
      if(boardArr[a] && boardArr[a] === boardArr[b] && boardArr[a] === boardArr[c]){
        return { winner: boardArr[a], combo: comb };
      }
    }
    return null;
  }

  function makeMove(i, mark){
    if(boardState[i] || gameOver) return false;
    boardState[i] = mark;
    lastAction.textContent = `${getPlayerName(mark)} placed ${mark} in cell ${i+1}`;
    buzz(600); // small sound
    updateBoardUI();
    const result = checkWinnerState();
    if(result){
      handleResult(result);
      return true;
    }
    if(boardState.every(Boolean)){
      // draw
      scores.T += 1;
      saveStorage();
      renderScores();
      gameOver = true;
      gameState.textContent = 'Draw';
      lastAction.textContent = 'Game ended in a draw';
      flashDraw();
      return true;
    }
    // next turn
    turn = (turn === 'X') ? 'O' : 'X';
    renderTurn();
    if(vsCPU && turn === 'O' && !gameOver){
      setTimeout(()=> cpuMove(), 480);
    }
    return true;
  }

  function handleResult(result){
    const winner = result.winner;
    gameOver = true;
    // add win classes
    for(const idx of result.combo){
      const el = cells[idx];
      el.classList.add('win');
    }
    // animate win-line
    drawWinLine(result.combo);
    // update scores
    scores[winner] += 1;
    saveStorage();
    renderScores();
    gameState.textContent = `${getPlayerName(winner)} wins!`;
    lastAction.textContent = `${getPlayerName(winner)} got a ${winner === 'X' ? '✕' : '◯'} three-in-a-row!`;
    buzz(220, 0.18);
    launchConfetti();
  }

  // win-line uses getTotalLength for smooth dash animation
  function drawWinLine(combo){
    const coord = (i) => {
      const row = Math.floor(i/3);
      const col = i % 3;
      const gap = 300/3;
      const x = col * gap + gap/2;
      const y = row * gap + gap/2;
      return [x,y];
    };
    const [a,,c] = combo;
    const [ax,ay] = coord(a);
    const [cx,cy] = coord(c);
    const d = `M ${ax} ${ay} L ${cx} ${cy}`;
    winLinePath.setAttribute('d', d);
    winLinePath.setAttribute('stroke', getComputedStyle(document.documentElement).getPropertyValue('--win') || '#ffd166');
    winLinePath.setAttribute('stroke-width', 8);
    winLinePath.setAttribute('stroke-linecap', 'round');
    winLinePath.setAttribute('opacity', 1);
    // ensure path length is computed after attribute set
    requestAnimationFrame(()=>{
      try {
        const length = winLinePath.getTotalLength();
        winLinePath.style.transition = 'stroke-dashoffset 700ms cubic-bezier(.2,.9,.3,1), opacity 220ms';
        winLinePath.style.strokeDasharray = length;
        winLinePath.style.strokeDashoffset = length;
        setTimeout(()=> winLinePath.style.strokeDashoffset = 0, 30);
        // fade after 2.2s
        setTimeout(()=> { winLinePath.style.opacity = 0; }, 2200);
      } catch(e){
        // fallback animation
        winLinePath.style.opacity = 0;
      }
    });
  }

  function flashDraw(){
    boardAnimate([
      { transform: 'scale(1)', boxShadow: '0 12px 40px rgba(0,0,0,0)' },
      { transform: 'scale(1.01)', boxShadow: '0 18px 40px rgba(255,255,255,0.02)' },
      { transform: 'scale(1)', boxShadow: '0 12px 40px rgba(0,0,0,0)' }
    ], 600);
  }
  function boardAnimate(keyframes, duration){
    const board = document.getElementById('board');
    board.animate(keyframes, { duration, easing: 'ease-in-out' });
  }

  // --- CPU logic ---
  function cpuMove(){
    if(gameOver) return;
    const empty = boardState.map((v,i)=> v?null:i).filter(n=>n!==null);

    if(aiLevel === 'hard'){
      // Minimax for 'O' (cpu)
      const move = bestMoveMinimax(boardState.slice(), 'O');
      if(move !== null) { makeMove(move, 'O'); return; }
    } else {
      // easy heuristic (win/block/center/corners/edges)
      // try winning
      for(const idx of empty){
        const copy = boardState.slice(); copy[idx] = 'O';
        if(checkWin(copy, 'O')) { makeMove(idx, 'O'); return; }
      }
      // block
      for(const idx of empty){
        const copy = boardState.slice(); copy[idx] = 'X';
        if(checkWin(copy, 'X')) { makeMove(idx, 'O'); return; }
      }
      if(boardState[4] === null){ makeMove(4,'O'); return; }
      const corners = [0,2,6,8].filter(i=>boardState[i]===null);
      if(corners.length){ makeMove(corners[Math.floor(Math.random()*corners.length)], 'O'); return; }
      const edges = [1,3,5,7].filter(i=>boardState[i]===null);
      if(edges.length){ makeMove(edges[Math.floor(Math.random()*edges.length)], 'O'); return; }
    }

    // fallback random
    if(empty.length){
      makeMove(empty[Math.floor(Math.random()*empty.length)], 'O');
    }
  }

  function checkWin(boardArr, mark){
    for(const comb of WIN_COMBINATIONS){
      const [a,b,c] = comb;
      if(boardArr[a] === mark && boardArr[b] === mark && boardArr[c] === mark) return true;
    }
    return false;
  }

  // Minimax implementation (student style, small & readable)
  function bestMoveMinimax(boardArr, player){
    // returns index or null
    const opponent = (player === 'O') ? 'X' : 'O';
    // terminal check
    const winner = checkWinnerState(boardArr);
    if(winner) return null; // no move on terminal in top-level
    const moves = boardArr.map((v,i)=> v?null:i).filter(n=>n!==null);
    if(moves.length === 0) return null;

    let bestScore = -Infinity;
    let bestIdx = null;
    for(const idx of moves){
      boardArr[idx] = player;
      const score = minimax(boardArr, false, player, opponent);
      boardArr[idx] = null;
      if(score > bestScore){ bestScore = score; bestIdx = idx; }
    }
    return bestIdx;
  }

  function minimax(boardArr, isMaximizing, player, opponent){
    const res = checkWinnerState(boardArr);
    if(res){
      if(res.winner === player) return 10;
      if(res.winner === opponent) return -10;
    }
    if(boardArr.every(Boolean)) return 0;

    const moves = boardArr.map((v,i)=> v?null:i).filter(n=>n!==null);
    if(isMaximizing){
      let best = -Infinity;
      for(const idx of moves){
        boardArr[idx] = player;
        best = Math.max(best, minimax(boardArr, false, player, opponent));
        boardArr[idx] = null;
      }
      return best - 0.01; // prefer faster wins
    } else {
      let best = Infinity;
      for(const idx of moves){
        boardArr[idx] = opponent;
        best = Math.min(best, minimax(boardArr, true, player, opponent));
        boardArr[idx] = null;
      }
      return best + 0.01;
    }
  }

  // --- Confetti (basic) ---
  function launchConfetti(){
    if(confettiAnimating) return;
    confettiAnimating = true;
    confettiParticles = [];
    const colors = ['#ffd166','#06d6a0','#7b61ff','#ff6b6b','#00e0a8'];
    const count = 80;
    for(let i=0;i<count;i++){
      confettiParticles.push({
        x: Math.random()*window.innerWidth,
        y: -Math.random()*200,
        vx: (Math.random()-0.5)*6,
        vy: Math.random()*3+2,
        size: 6 + Math.random()*10,
        rot: Math.random()*360,
        vr: (Math.random()-0.5)*10,
        color: colors[Math.floor(Math.random()*colors.length)]
      });
    }
    requestAnimationFrame(confettiTick);
    setTimeout(()=> confettiAnimating = false, 3200);
  }
  function confettiTick(){
    ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(p=>{
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      ctx.restore();
    });
    confettiParticles = confettiParticles.filter(p => p.y < window.innerHeight + 100);
    if(confettiAnimating || confettiParticles.length) requestAnimationFrame(confettiTick);
    else ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  }

  // --- Event listeners / UI interactions ---
  startBtn.addEventListener('click', () => {
    starting = starting || 'X';
    turn = starting;
    boardState = Array(9).fill(null);
    gameOver = false;
    updateBoardUI();
    renderTurn();
    gameState.textContent = 'Game in progress';
    lastAction.textContent = `Started: ${getPlayerName(turn)} goes first.`;
    saveStorage();
    if(vsCPU && turn === 'O'){ setTimeout(cpuMove, 520); }
  });

  swapBtn.addEventListener('click', ()=> {
    starting = (starting === 'X') ? 'O' : 'X';
    turn = starting;
    gameState.textContent = 'Starting player swapped';
    lastAction.textContent = `${getPlayerName(starting)} will start next round.`;
    saveStorage();
  });

  clearBtn.addEventListener('click', ()=> {
    boardState = Array(9).fill(null);
    gameOver = false;
    updateBoardUI();
    winLinePath.setAttribute('opacity', 0);
    gameState.textContent = 'Board cleared';
    lastAction.textContent = 'Board was cleared';
  });

  resetBtn.addEventListener('click', ()=> {
    scores = { X:0, O:0, T:0 }; saveStorage(); renderScores();
    gameState.textContent = 'Scores reset';
    lastAction.textContent = 'Scores set to zero';
  });

  newRoundBtn.addEventListener('click', ()=> {
    starting = (starting === 'X') ? 'O' : 'X';
    turn = starting;
    boardState = Array(9).fill(null);
    gameOver = false;
    updateBoardUI();
    renderTurn();
    gameState.textContent = 'New round';
    lastAction.textContent = `New round started. ${getPlayerName(turn)} starts.`;
    saveStorage();
    if(vsCPU && turn === 'O') setTimeout(cpuMove, 480);
  });

  aiToggle.addEventListener('click', ()=> {
    vsCPU = !vsCPU;
    aiToggle.textContent = vsCPU ? 'Playing vs CPU' : 'Play vs CPU';
    gameState.textContent = vsCPU ? 'CPU enabled' : 'CPU disabled';
    saveStorage();
    if(vsCPU && turn === 'O' && !gameOver) setTimeout(cpuMove, 480);
  });

  aiLevelSel.value = aiLevel;
  aiLevelSel.addEventListener('change', (e)=> {
    aiLevel = e.target.value;
    saveStorage();
  });

  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      const i = Number(cell.dataset.index);
      if(gameOver) return;
      if(boardState[i]) return;
      if(vsCPU && turn === 'O') return;
      const moved = makeMove(i, turn);
      if(moved && !gameOver) gameState.textContent = `Turn: ${getPlayerName(turn)}`;
    });
  });

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if(e.key === 'r') newRoundBtn.click();
    if(e.key === 'c') clearBtn.click();
    if(e.key === 's') swapBtn.click();
  });

  // focusable cells for accessibility
  cells.forEach(c => {
    c.tabIndex = 0;
    c.addEventListener('keydown', (ev) => {
      if(ev.key === 'Enter' || ev.key === ' ') c.click();
    });
  });

  // inputs
  [playerXInput, playerOInput].forEach(inp => {
    inp.addEventListener('keyup', (e) => {
      if(e.key === 'Enter') startBtn.click();
    });
    inp.addEventListener('input', ()=> { renderScores(); saveStorage(); });
  });

  // hint button: shows suggested move for current player (if CPU off)
  hintBtn.addEventListener('click', ()=> {
    if(gameOver) return;
    if(vsCPU && turn === 'O'){ gameState.textContent = 'Hint disabled while CPU is active'; return; }
    const hint = (aiLevel === 'hard') ? bestMoveMinimax(boardState.slice(), turn) : heuristicHint(turn);
    if(hint !== null){
      lastAction.textContent = `Hint: consider cell ${hint+1}`;
      const el = cells[hint];
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 420 });
    } else {
      lastAction.textContent = 'No hint available';
    }
  });

  aiPlayBtn.addEventListener('click', ()=> {
    if(!vsCPU) { lastAction.textContent = 'Enable CPU first'; return; }
    if(turn === 'O') cpuMove();
  });

  // theme toggle
  themeBtn.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const nxt = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nxt);
    saveStorage();
  });

  // simple heuristic for hint
  function heuristicHint(mark){
    const empty = boardState.map((v,i)=> v?null:i).filter(n=>n!==null);
    for(const idx of empty){ const copy = boardState.slice(); copy[idx] = mark; if(checkWin(copy, mark)) return idx; }
    for(const idx of empty){ const copy = boardState.slice(); copy[idx] = (mark==='X'?'O':'X'); if(checkWin(copy, mark==='X'?'O':'X')) return idx; }
    if(boardState[4] === null) return 4;
    const corners = [0,2,6,8].filter(i=>boardState[i]===null);
    if(corners.length) return corners[0];
    const edges = [1,3,5,7].filter(i=>boardState[i]===null);
    return edges.length ? edges[0] : null;
  }

  // --- init render ---
  renderScores();
  renderTurn();
  updateBoardUI();
  aiToggle.textContent = vsCPU ? 'Playing vs CPU' : 'Play vs CPU';
  aiLevelSel.value = aiLevel;
  gameState.textContent = 'Ready';
  lastAction.textContent = 'Enter names and press Start';
  saveStorage();

  // expose small functions for debugging from console (student convenience)
  window.ttt = { boardState, makeMove, cpuMove, reset: ()=> { resetBtn.click(); } };

})();
