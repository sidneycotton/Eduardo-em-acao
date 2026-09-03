/* ============================================================
   O CORREDOR DO PROFESSOR
   Jogo infinito estilo Subway Surfers feito com Three.js.
   3 faixas, pulo, obstáculos "alunos no celular", dificuldade
   progressiva, HUD neon no estilo Hero Vortex.
   ============================================================ */

(() => {
  "use strict";

  // ---------- Config ----------
  const LANE_X = [-2.4, 0, 2.4];
  const LANE_CHANGE_SPEED = 12;
  const GRAVITY = -32;
  const JUMP_VELOCITY = 11;
  const GROUND_Y = 0;
  const START_SPEED = 11;
  const MAX_SPEED = 30;
  const SPEED_RAMP = 0.055; // per second
  const SPAWN_Z = -60;
  const DESPAWN_Z = 10;
  const LANE_COUNT = 3;

  // ---------- DOM ----------
  const wrap = document.getElementById("canvas-wrap");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const centerMsg = document.getElementById("center-msg");
  const startScreen = document.getElementById("startscreen");
  const gameoverBox = document.getElementById("gameover-box");
  const goScoreEl = document.getElementById("go-score");
  const goTitleEl = document.getElementById("go-title");
  const goMsgEl = document.getElementById("go-msg");
  const btnStart = document.getElementById("btn-start");
  const btnRestart = document.getElementById("btn-restart");
  const flashEl = document.getElementById("flash");
  const touchLeft = document.getElementById("touch-left");
  const touchRight = document.getElementById("touch-right");

  const QUOTES = [
    '"Um dia eu queria que vocês sentissem como é ser eu."',
    '"O corredor nunca acaba, mas a gente continua tentando chegar."',
    '"Todo dia é desviar de mais um aluno no celular."',
    '"Ele só queria dar a aula. É pedir muito?",',
    '"Cada sino é um recomeço."'
  ];

  // ---------- Three.js setup ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.028);

  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 5.4, 8.2);
  camera.lookAt(0, 1.6, -6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrap.appendChild(renderer.domElement);

  // Lights - neon blue vibe like Hero Vortex
  const hemi = new THREE.HemisphereLight(0x3ea6ff, 0x0a0a14, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0x8fd8ff, 1.1);
  key.position.set(6, 14, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  scene.add(key);

  const rim = new THREE.PointLight(0x00e5ff, 1.4, 40);
  rim.position.set(0, 6, -10);
  scene.add(rim);

  // ---------- Corridor (floor + walls + neon strips) ----------
  const corridorGroup = new THREE.Group();
  scene.add(corridorGroup);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x10131f,
    roughness: 0.65,
    metalness: 0.35
  });
  const floorGeo = new THREE.PlaneGeometry(9, 200);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -80;
  floor.receiveShadow = true;
  corridorGroup.add(floor);

  // Neon lane lines
  function makeNeonLine(x) {
    const geo = new THREE.PlaneGeometry(0.06, 200);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3ea6ff,
      transparent: true,
      opacity: 0.85
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, -80);
    return m;
  }
  [-3.6, -1.2, 1.2, 3.6].forEach((x) => corridorGroup.add(makeNeonLine(x)));

  // Side walls with locker-like neon panels
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e18,
    roughness: 0.8,
    metalness: 0.2
  });
  function makeWall(x, rotY) {
    const geo = new THREE.PlaneGeometry(200, 10);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(x, 5, -80);
    wall.rotation.y = rotY;
    scene.add(wall);
    return wall;
  }
  makeWall(-4.6, Math.PI / 2);
  makeWall(4.6, -Math.PI / 2);

  // Locker glow strips
  const lockerStripGroup = new THREE.Group();
  scene.add(lockerStripGroup);
  function spawnLockerStrip(z) {
    [-4.55, 4.55].forEach((x) => {
      const geo = new THREE.PlaneGeometry(0.15, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0x00e5ff : 0x3ea6ff,
        transparent: true,
        opacity: 0.5
      });
      const strip = new THREE.Mesh(geo, mat);
      strip.position.set(x, 4, z);
      strip.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      strip.userData.isStrip = true;
      lockerStripGroup.add(strip);
    });
  }
  for (let z = -10; z > SPAWN_Z * 2; z -= 8) spawnLockerStrip(z);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(9, 200);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x05060c, roughness: 1 });
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 9.5, -80);
  scene.add(ceiling);

  // ---------- Professor character (low-poly stylized) ----------
  function buildProfessor() {
    const g = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b48c, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2563c9, roughness: 0.55, metalness: 0.15 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.6 });

    // Head (bald)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), skinMat);
    head.position.set(0, 1.72, 0);
    head.castShadow = true;
    g.add(head);

    // subtle shine on bald head
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    shine.position.set(0.08, 1.9, 0.2);
    g.add(shine);

    // Glasses
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const lensGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
    const lensL = new THREE.Mesh(lensGeo, glassMat);
    lensL.position.set(-0.13, 1.72, 0.3);
    const lensR = lensL.clone();
    lensR.position.x = 0.13;
    g.add(lensL, lensR);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirtMat);
    torso.position.set(0, 1.2, 0);
    torso.castShadow = true;
    g.add(torso);

    // Tie
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x0d1b33 })
    );
    tie.position.set(0, 1.25, 0.2);
    g.add(tie);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
    const armL = new THREE.Mesh(armGeo, shirtMat);
    armL.position.set(-0.42, 1.15, 0);
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.42;
    g.add(armL, armR);

    // Hands
    const handGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const handL = new THREE.Mesh(handGeo, skinMat);
    handL.position.set(-0.42, 0.85, 0);
    const handR = handL.clone();
    handR.position.x = 0.42;
    g.add(handL, handR);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.65, 0.22);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.16, 0.55, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legL, legR);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.22, 0.12, 0.32);
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.16, 0.2, 0.05);
    const shoeR = shoeL.clone();
    shoeR.position.x = 0.16;
    g.add(shoeL, shoeR);

    g.userData.parts = { armL, armR, legL, legR, head, torso };
    g.castShadow = true;
    return g;
  }

  const professor = buildProfessor();
  professor.position.set(LANE_X[1], GROUND_Y, 2.6);
  scene.add(professor);

  // ---------- Student obstacle (stylized, looking at phone) ----------
  const studentColors = [0xff5c7a, 0x8b5cf6, 0xffa93e, 0x22c55e, 0xf472b6, 0x60a5fa];

  function buildStudent() {
    const g = new THREE.Group();
    const shirtColor = studentColors[Math.floor(Math.random() * studentColors.length)];
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a879, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.7 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), skinMat);
    head.position.set(0, 1.55, 0);
    head.rotation.x = 0.5; // looking down at phone
    g.add(head);

    // simple hair blob
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2b2116, roughness: 0.9 })
    );
    hair.position.set(0, 1.68, 0.02);
    hair.rotation.x = 0.5;
    g.add(hair);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.34), shirtMat);
    torso.position.set(0, 1.08, 0);
    torso.rotation.x = 0.15;
    g.add(torso);

    const legGeo = new THREE.BoxGeometry(0.19, 0.62, 0.2);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.15, 0.5, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    g.add(legL, legR);

    // arms bent holding phone
    const armGeo = new THREE.BoxGeometry(0.14, 0.4, 0.14);
    const armL = new THREE.Mesh(armGeo, shirtMat);
    armL.position.set(-0.32, 1.15, 0.18);
    armL.rotation.x = -0.9;
    const armR = armL.clone();
    armR.position.x = 0.32;
    g.add(armL, armR);

    // phone (glowing)
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.28, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0x9fe8ff,
        emissive: 0x2ec9ff,
        emissiveIntensity: 0.9
      })
    );
    phone.position.set(0, 1.35, 0.42);
    phone.rotation.x = -0.6;
    g.add(phone);

    g.userData.hitRadius = 0.45;
    return g;
  }

  // ---------- Coin (collectible, optional score boost) ----------
  function buildCoin() {
    const geo = new THREE.TorusGeometry(0.22, 0.08, 10, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xffb700,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.3
    });
    const coin = new THREE.Mesh(geo, mat);
    coin.rotation.x = Math.PI / 2;
    coin.userData.spin = 0;
    return coin;
  }

  // ---------- Object pools ----------
  const obstacles = []; // {mesh, lane}
  const coins = []; // {mesh, lane}

  function spawnObstacleRow() {
    // choose how many lanes blocked (never all 3, to keep it winnable)
    const blockCount = Math.random() < 0.7 ? 1 : 2;
    const lanesShuffled = [0, 1, 2].sort(() => Math.random() - 0.5);
    const blocked = lanesShuffled.slice(0, blockCount);

    blocked.forEach((lane) => {
      const student = buildStudent();
      student.position.set(LANE_X[lane], GROUND_Y, SPAWN_Z);
      student.castShadow = true;
      scene.add(student);
      obstacles.push({ mesh: student, lane, passed: false });
    });

    // spawn a coin in a free lane sometimes
    const freeLanes = [0, 1, 2].filter((l) => !blocked.includes(l));
    if (freeLanes.length && Math.random() < 0.55) {
      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      const coin = buildCoin();
      coin.position.set(LANE_X[lane], 1.1, SPAWN_Z - 2);
      scene.add(coin);
      coins.push({ mesh: coin, lane });
    }
  }

  // ---------- Game state ----------
  let running = false;
  let gameOver = false;
  let currentLane = 1;
  let targetX = LANE_X[1];
  let velY = 0;
  let isJumping = false;
  let speed = START_SPEED;
  let distance = 0;
  let best = Number(localStorage.getItem("professorGameBest") || 0);
  let spawnTimer = 0;
  let elapsed = 0;
  let runId = 0;

  bestEl.textContent = `Recorde: ${Math.floor(best)} m`;

  function resetGame() {
    // clear obstacles/coins
    obstacles.forEach((o) => scene.remove(o.mesh));
    coins.forEach((c) => scene.remove(c.mesh));
    obstacles.length = 0;
    coins.length = 0;

    currentLane = 1;
    targetX = LANE_X[1];
    professor.position.set(targetX, GROUND_Y, 2.6);
    velY = 0;
    isJumping = false;
    speed = START_SPEED;
    distance = 0;
    spawnTimer = 0;
    elapsed = 0;
    gameOver = false;
    runId++;
  }

  function startGame() {
    resetGame();
    running = true;
    centerMsg.style.display = "none";
    startScreen.style.display = "none";
    gameoverBox.style.display = "none";
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (distance > best) {
      best = distance;
      localStorage.setItem("professorGameBest", String(Math.floor(best)));
    }
    goScoreEl.textContent = `Você percorreu ${Math.floor(distance)} metros pelo corredor.`;
    goMsgEl.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    bestEl.textContent = `Recorde: ${Math.floor(best)} m`;
    centerMsg.style.display = "flex";
    startScreen.style.display = "none";
    gameoverBox.style.display = "flex";

    flashEl.style.opacity = "1";
    setTimeout(() => (flashEl.style.opacity = "0"), 250);
  }

  // ---------- Controls ----------
  function changeLane(dir) {
    if (!running) return;
    const next = currentLane + dir;
    if (next < 0 || next >= LANE_COUNT) return;
    currentLane = next;
    targetX = LANE_X[currentLane];
  }

  function doJump() {
    if (!running || isJumping) return;
    isJumping = true;
    velY = JUMP_VELOCITY;
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        changeLane(-1);
        break;
      case "ArrowRight":
      case "KeyD":
        changeLane(1);
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
        doJump();
        break;
      case "Enter":
        if (!running) {
          if (gameOver) startGame();
          else startGame();
        }
        break;
    }
  });

  // Touch: swipe to change lane, tap to jump
  let touchStartX = null;
  let touchStartY = null;
  let touchStartT = 0;

  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartT = Date.now();
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartT;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        changeLane(dx > 0 ? 1 : -1);
      } else if (dy < -40 && Math.abs(dy) > Math.abs(dx)) {
        doJump();
      } else if (dt < 250 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        doJump();
      }
      touchStartX = null;
    },
    { passive: true }
  );

  // On-screen tap zones (also help desktop click)
  touchLeft.addEventListener("click", () => changeLane(-1));
  touchRight.addEventListener("click", () => changeLane(1));

  btnStart.addEventListener("click", startGame);
  btnRestart.addEventListener("click", startGame);

  // ---------- Simple beep via WebAudio (no external assets) ----------
  let audioCtx = null;
  function beep(freq, dur, type = "sine", vol = 0.15) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.stop(audioCtx.currentTime + dur);
    } catch (err) {
      /* audio not available, ignore */
    }
  }

  // ---------- Animation helpers ----------
  const clock = new THREE.Clock();
  let runCycle = 0;

  function animateRun(delta, onGround) {
    const { armL, armR, legL, legR, head, torso } = professor.userData.parts;
    if (onGround) {
      runCycle += delta * speed * 1.3;
      const swing = Math.sin(runCycle) * 0.6;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing;
      armR.rotation.x = swing;
      torso.rotation.z = Math.sin(runCycle) * 0.03;
      professor.position.y = GROUND_Y + Math.abs(Math.sin(runCycle)) * 0.03;
    } else {
      legL.rotation.x = 0.4;
      legR.rotation.x = -0.3;
      armL.rotation.x = -0.5;
      armR.rotation.x = 0.6;
    }
  }

  // ---------- Collision helpers ----------
  function checkCollisions() {
    const px = professor.position.x;
    const pz = professor.position.z;
    const py = professor.position.y;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      const dz = Math.abs(o.mesh.position.z - pz);
      const dx = Math.abs(o.mesh.position.x - px);
      if (dz < 0.55 && dx < 0.55) {
        // jump avoidance window: must clear ~1.15 height
        if (py > 1.05) continue;
        return true; // hit
      }
    }
    return false;
  }

  function checkCoins() {
    const px = professor.position.x;
    const pz = professor.position.z;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      const dz = Math.abs(c.mesh.position.z - pz);
      const dx = Math.abs(c.mesh.position.x - px);
      if (dz < 0.6 && dx < 0.5) {
        scene.remove(c.mesh);
        coins.splice(i, 1);
        distance += 5;
        beep(880, 0.12, "triangle", 0.12);
      }
    }
  }

  // ---------- Main loop ----------
  function tick() {
    const delta = Math.min(clock.getDelta(), 0.05);
    requestAnimationFrame(tick);

    // idle bob animation on start/gameover screens
    if (!running) {
      professor.position.x += (targetX - professor.position.x) * 0.1;
      renderer.render(scene, camera);
      return;
    }

    elapsed += delta;
    speed = Math.min(MAX_SPEED, START_SPEED + elapsed * SPEED_RAMP * 10);
    distance += speed * delta * 0.6;

    // lane movement (smooth lerp)
    professor.position.x += (targetX - professor.position.x) * Math.min(1, LANE_CHANGE_SPEED * delta);
    professor.rotation.z = (targetX - professor.position.x) * -0.12;

    // jump physics
    if (isJumping) {
      velY += GRAVITY * delta;
      professor.position.y += velY * delta;
      if (professor.position.y <= GROUND_Y) {
        professor.position.y = GROUND_Y;
        isJumping = false;
        velY = 0;
      }
    }

    animateRun(delta, !isJumping);

    // move world instead of player forward (classic runner trick)
    const move = speed * delta;

    obstacles.forEach((o) => {
      o.mesh.position.z += move;
    });
    coins.forEach((c) => {
      c.mesh.position.z += move;
      c.mesh.rotation.y += delta * 6;
      c.mesh.position.y = 1.1 + Math.sin(elapsed * 4 + c.mesh.position.x) * 0.08;
    });
    lockerStripGroup.children.forEach((s) => {
      s.position.z += move;
      if (s.position.z > 10) s.position.z -= (Math.abs(SPAWN_Z) * 2 + 20);
    });

    // remove passed obstacles/coins
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].mesh.position.z > DESPAWN_Z) {
        scene.remove(obstacles[i].mesh);
        obstacles.splice(i, 1);
      }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      if (coins[i].mesh.position.z > DESPAWN_Z) {
        scene.remove(coins[i].mesh);
        coins.splice(i, 1);
      }
    }

    // spawn new rows
    spawnTimer -= delta;
    const spawnInterval = Math.max(0.55, 1.15 - speed / MAX_SPEED * 0.6);
    if (spawnTimer <= 0) {
      spawnObstacleRow();
      spawnTimer = spawnInterval;
    }

    checkCoins();
    if (checkCollisions()) {
      beep(120, 0.35, "sawtooth", 0.25);
      endGame();
    }

    // camera slight sway
    camera.position.x = professor.position.x * 0.35;
    camera.lookAt(professor.position.x * 0.6, 1.6, professor.position.z - 6);

    // HUD
    scoreEl.textContent = `${Math.floor(distance)} m`;
    speedEl.textContent = `Velocidade: ${(speed / START_SPEED).toFixed(1)}x`;

    renderer.render(scene, camera);
  }

  // ---------- Resize ----------
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Initial idle render loop starts immediately
  requestAnimationFrame(tick);
})();
