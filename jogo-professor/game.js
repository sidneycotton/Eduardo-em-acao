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
  scene.fog = new THREE.FogExp2(0xe4e0d4, 0.022);
  scene.background = new THREE.Color(0xe4e0d4);

  // ---------- Procedural textures (to mimic the reference photo) ----------
  function makeTileTexture({
    base = "#e9e7df",
    grout = "#b9b4a5",
    cols = 10,
    rows = 220,
    repeatX = 9,
    repeatY = 200,
    dirty = false
  }) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (dirty) {
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(120,110,90,${Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 12 + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const cw = canvas.width / cols;
    const rh = canvas.height / rows;
    ctx.strokeStyle = grout;
    ctx.lineWidth = 1.4;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rh);
      ctx.lineTo(canvas.width, r * rh);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  function makeMarbleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#cabfa4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Blotchy granite speckle
    for (let i = 0; i < 3200; i++) {
      const shade = Math.random();
      if (shade < 0.5) {
        ctx.fillStyle = `rgba(90,75,55,${Math.random() * 0.25})`;
      } else if (shade < 0.8) {
        ctx.fillStyle = `rgba(230,220,200,${Math.random() * 0.3})`;
      } else {
        ctx.fillStyle = `rgba(60,50,35,${Math.random() * 0.35})`;
      }
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const s = Math.random() * 3 + 0.5;
      ctx.fillRect(x, y, s, s);
    }

    // Vein-like streaks
    ctx.strokeStyle = "rgba(80,65,45,0.18)";
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      const x0 = Math.random() * canvas.width;
      let y0 = Math.random() * canvas.height;
      ctx.moveTo(x0, y0);
      for (let s = 0; s < 6; s++) {
        y0 += canvas.height / 6;
        ctx.lineTo(x0 + (Math.random() - 0.5) * 60, y0);
      }
      ctx.lineWidth = Math.random() * 1.5 + 0.4;
      ctx.stroke();
    }

    // Tile grid (large granite slabs)
    const cols = 4;
    const rows = 24;
    ctx.strokeStyle = "rgba(40,35,25,0.5)";
    ctx.lineWidth = 2;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo((c * canvas.width) / cols, 0);
      ctx.lineTo((c * canvas.width) / cols, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, (r * canvas.height) / rows);
      ctx.lineTo(canvas.width, (r * canvas.height) / rows);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // ---------- Toon shading (same technique as Hero Vortex) ----------
  // 4-step brightness ramp baked into a tiny gradient texture, fed to
  // THREE.MeshToonMaterial as gradientMap - identical pattern to
  // makeLocalToonGradient() in Hero Vortex's js/battlefields/*.js files.
  function makeLocalToonGradient(baseRgb) {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 1;
    const ctx = c.getContext("2d");
    const steps = [0.35, 0.6, 0.85, 1.0];
    steps.forEach((f, i) => {
      ctx.fillStyle = `rgb(${Math.floor(baseRgb[0] * f)},${Math.floor(baseRgb[1] * f)},${Math.floor(baseRgb[2] * f)})`;
      ctx.fillRect(i, 0, 1, 1);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  function hexToRgb(hex) {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }

  // Builds a MeshToonMaterial with a gradient tinted to its own base color,
  // mirroring how Hero Vortex shades every prop and character.
  function toonMat(color, extra = {}) {
    return new THREE.MeshToonMaterial({
      color,
      gradientMap: makeLocalToonGradient(hexToRgb(color)),
      ...extra
    });
  }

  const floorTexture = makeTileTexture({
    base: "#eceae2",
    grout: "#c3beb0",
    cols: 9,
    rows: 220,
    dirty: true
  });
  floorTexture.repeat.set(1, 22);

  const ceilTexture = makeTileTexture({
    base: "#f6f5f1",
    grout: "#d8d4c8",
    cols: 9,
    rows: 220
  });
  ceilTexture.repeat.set(1, 22);

  const marbleTexture = makeMarbleTexture();
  marbleTexture.repeat.set(1, 22);

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

  // Lights - bright institutional fluorescent corridor, like the reference photo
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a8f7d, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff6e0, 1.15);
  key.position.set(6, 14, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  scene.add(key);

  const rim = new THREE.PointLight(0x8fd8ff, 0.6, 40);
  rim.position.set(0, 6, -10);
  scene.add(rim);

  // ---------- Corridor (based on reference photo: white tile floor with
  // a wood strip divider, beige/granite marbled wall on one side, plain
  // white wall with windows on the other, white ceramic-tiled ceiling) ----------
  const corridorGroup = new THREE.Group();
  scene.add(corridorGroup);

  const floorMat = toonMat(0xeceae2, { map: floorTexture });
  const floorGeo = new THREE.PlaneGeometry(9, 200);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -80;
  floor.receiveShadow = true;
  corridorGroup.add(floor);

  // Low step/riser along the left side of the walkway (as in the photo)
  const riserMat = toonMat(0xd9d6cc);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 200), riserMat);
  riser.position.set(-3.3, 0.07, -80);
  riser.receiveShadow = true;
  corridorGroup.add(riser);

  // Wood strip dividing the corridor lengthwise (like the photo)
  const woodMat = toonMat(0x8a5a2e);
  const woodStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 200), woodMat);
  woodStrip.rotation.x = -Math.PI / 2;
  woodStrip.position.set(0.9, 0.025, -80);
  corridorGroup.add(woodStrip);

  // Right wall: beige/granite marbled slab with a dark accent band
  const marbleWallMat = toonMat(0xcabfa4, { map: marbleTexture });
  const marbleWall = new THREE.Mesh(new THREE.PlaneGeometry(200, 10), marbleWallMat);
  marbleWall.position.set(4.6, 5, -80);
  marbleWall.rotation.y = -Math.PI / 2;
  scene.add(marbleWall);

  const accentBandMat = toonMat(0x2b2b2b);
  const accentBand = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.55), accentBandMat);
  accentBand.position.set(4.58, 7.55, -80);
  accentBand.rotation.y = -Math.PI / 2;
  scene.add(accentBand);

  // Small wall outlet / plate details on the marble wall (like the photo)
  const outletGroup = new THREE.Group();
  scene.add(outletGroup);
  function spawnOutlet(z) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), toonMat(0xf2efe6));
    plate.position.set(4.55, 1.3, z);
    plate.rotation.y = -Math.PI / 2;
    outletGroup.add(plate);
  }
  for (let z = -14; z > SPAWN_Z * 2; z -= 11) spawnOutlet(z);

  // Left wall: plain white wall with recessed window panels
  const wallMat = toonMat(0xf5f4f0);
  function makeWall(x, rotY) {
    const geo = new THREE.PlaneGeometry(200, 10);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(x, 5, -80);
    wall.rotation.y = rotY;
    scene.add(wall);
    return wall;
  }
  makeWall(-4.6, Math.PI / 2);

  // Window panels on the left wall (dark reflective glass with a soft highlight)
  const windowMat = toonMat(0x2a3138, { emissive: 0x3b4550, emissiveIntensity: 0.4 });
  const windowFrameMat = toonMat(0xdedad0);
  const windowGroup = new THREE.Group();
  scene.add(windowGroup);
  function spawnWindow(z, small) {
    const w = small ? 0.5 : 0.9;
    const h = small ? 0.9 : 1.7;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, h + 0.08), windowFrameMat);
    frame.position.set(-4.56, small ? 6.6 : 5.3, z);
    frame.rotation.y = Math.PI / 2;
    windowGroup.add(frame);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w, h), windowMat);
    win.position.set(-4.54, small ? 6.6 : 5.3, z);
    win.rotation.y = Math.PI / 2;
    windowGroup.add(win);
  }

  // Wood classroom doors set into the left wall, framed like the photo
  // (dark wood door slab + light frame + small nameplate above).
  const doorMat = toonMat(0x6b4326);
  const doorFrameMat = toonMat(0xe9e6dc);
  const doorHandleMat = toonMat(0xc9a24a);
  const doorPlateMat = toonMat(0x2f5faa, { emissive: 0x1c3a6b, emissiveIntensity: 0.25 });
  const doorGroup = new THREE.Group();
  scene.add(doorGroup);
  function spawnDoor(z) {
    const w = 1.1;
    const h = 2.35;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.16, h + 0.14), doorFrameMat);
    frame.position.set(-4.57, GROUND_Y + h / 2 + 0.02, z);
    frame.rotation.y = Math.PI / 2;
    doorGroup.add(frame);

    const door = new THREE.Mesh(new THREE.PlaneGeometry(w, h), doorMat);
    door.position.set(-4.55, GROUND_Y + h / 2, z);
    door.rotation.y = Math.PI / 2;
    doorGroup.add(door);

    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), doorHandleMat);
    handle.position.set(-4.5, GROUND_Y + h * 0.45, z - 0.35);
    doorGroup.add(handle);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), doorPlateMat);
    plate.position.set(-4.56, GROUND_Y + h + 0.22, z);
    plate.rotation.y = Math.PI / 2;
    doorGroup.add(plate);
  }

  // Occasional big "janelão" showing a night courtyard outside - a wide
  // opening in the wall using a procedural night-scene texture (sky,
  // silhouetted trees, lit building, parked cars) instead of glass.
  function makeCourtyardTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 384;
    const ctx = c.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, "#0c1220");
    sky.addColorStop(1, "#1c2436");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, c.width, c.height);

    // ground / plaza
    ctx.fillStyle = "#3a3f46";
    ctx.fillRect(0, c.height * 0.72, c.width, c.height * 0.28);

    // lit building block on the right
    ctx.fillStyle = "#2a2e38";
    ctx.fillRect(c.width * 0.58, c.height * 0.15, c.width * 0.42, c.height * 0.6);
    for (let ry = 0; ry < 6; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        ctx.fillStyle = Math.random() < 0.4 ? "#ffe9a8" : "#12161f";
        ctx.fillRect(
          c.width * 0.6 + rx * 18,
          c.height * 0.2 + ry * 14,
          10,
          9
        );
      }
    }

    // a bright light flare
    const flare = ctx.createRadialGradient(c.width * 0.63, c.height * 0.22, 2, c.width * 0.63, c.height * 0.22, 60);
    flare.addColorStop(0, "rgba(255,255,255,0.9)");
    flare.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = flare;
    ctx.fillRect(c.width * 0.4, 0, c.width * 0.5, c.height * 0.5);

    // tree silhouettes on the left
    ctx.fillStyle = "#10140f";
    for (let i = 0; i < 3; i++) {
      const tx = c.width * (0.08 + i * 0.14);
      const ty = c.height * 0.62;
      ctx.fillRect(tx - 3, ty, 6, c.height * 0.18);
      ctx.beginPath();
      ctx.arc(tx, ty - 10 - i * 6, 34 + i * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // parked car silhouettes
    ctx.fillStyle = "#15181d";
    for (let i = 0; i < 4; i++) {
      const cx = c.width * (0.02 + i * 0.13);
      const cy = c.height * 0.84;
      ctx.fillRect(cx, cy, 44, 16);
      ctx.fillRect(cx + 8, cy - 8, 26, 10);
    }

    const tex = new THREE.CanvasTexture(c);
    return tex;
  }
  const courtyardTexture = makeCourtyardTexture();
  const courtyardMat = new THREE.MeshBasicMaterial({ map: courtyardTexture });
  const courtyardFrameMat = toonMat(0xe9e6dc);
  const courtyardGroup = new THREE.Group();
  scene.add(courtyardGroup);
  // Sits on the right (marble) wall, in front of it like a balcony opening
  // with a granite sill - matching the reference photos where the big
  // outside view is on the right side of the corridor, not the left.
  function spawnCourtyardWindow(z) {
    const w = 2.6;
    const h = 3.2;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, h + 0.2), courtyardFrameMat);
    frame.position.set(4.57, GROUND_Y + h / 2 + 0.6, z);
    frame.rotation.y = -Math.PI / 2;
    courtyardGroup.add(frame);
    const view = new THREE.Mesh(new THREE.PlaneGeometry(w, h), courtyardMat);
    view.position.set(4.55, GROUND_Y + h / 2 + 0.6, z);
    view.rotation.y = -Math.PI / 2;
    courtyardGroup.add(view);
    // granite sill/railing along the bottom of the opening
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, w), marbleWallMat);
    sill.position.set(4.5, GROUND_Y + 0.45, z);
    courtyardGroup.add(sill);
  }

  // Lay out the left wall as an alternating rhythm of doors and small
  // windows, and the right (marble) wall with occasional big "janelões" -
  // matching the photographed hallway.
  {
    let z = -8;
    let stepIndex = 0;
    while (z > SPAWN_Z * 2) {
      if (stepIndex % 2 === 0) {
        spawnDoor(z);
      } else {
        spawnWindow(z, Math.random() < 0.4);
      }
      z -= 4.2;
      stepIndex++;
    }
  }
  {
    let z = -14;
    while (z > SPAWN_Z * 2) {
      spawnCourtyardWindow(z);
      z -= 15;
    }
  }

  // Ceiling: white ceramic tile grid with a recessed duct band (matches photo)
  const ceilGeo = new THREE.PlaneGeometry(9, 200);
  const ceilMat = toonMat(0xf6f5f1, { map: ceilTexture });
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 9.5, -80);
  scene.add(ceiling);

  const ductMat = toonMat(0xe7e4da);
  const duct = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 200), ductMat);
  duct.position.set(2.6, 9.2, -80);
  scene.add(duct);

  // Fluorescent tube light fixtures along the ceiling
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tubeGroup = new THREE.Group();
  scene.add(tubeGroup);
  function spawnTube(z) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 3.2), tubeMat);
    tube.position.set(0, 9.35, z);
    tubeGroup.add(tube);
  }
  for (let z = -10; z > SPAWN_Z * 2; z -= 9) spawnTube(z);

  // ---------- Professor character (low-poly stylized) ----------
  function buildProfessor() {
    const g = new THREE.Group();

    const skinMat = toonMat(0xe0b48c);
    const shirtMat = toonMat(0x2563c9);
    const pantsMat = toonMat(0x1b1f2b);
    const shoeMat = toonMat(0x111318);

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

    // Fuller receding hair (horseshoe band of tufts around the sides/back,
    // two rows for volume) - only the very top and front stay bald/shiny,
    // like Dario's partial hairCap technique in Hero Vortex but built from
    // overlapping tufts instead of one solid dome.
    const hairMat = toonMat(0x5a5048);
    const hairTuftsGroup = new THREE.Group();
    hairTuftsGroup.position.copy(head.position);
    g.add(hairTuftsGroup);
    [
      { r: 0.34, yBase: 0.0, scale: 1.15 },
      { r: 0.32, yBase: -0.09, scale: 1.0 }
    ].forEach(({ r, yBase, scale }) => {
      for (let deg = 65; deg <= 295; deg += 13) {
        const theta = (deg * Math.PI) / 180;
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 5), hairMat);
        tuft.position.set(
          Math.sin(theta) * r,
          yBase + Math.sin(deg * 3) * 0.015,
          Math.cos(theta) * r
        );
        tuft.scale.set(1, 0.6, 0.75);
        hairTuftsGroup.add(tuft);
      }
    });

    // Glasses
    const glassMat = toonMat(0x111111);
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
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.03), toonMat(0x0d1b33));
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
  // The rig is modeled facing local +z (glasses/torso front); the world
  // scrolls toward the camera to simulate the professor running toward -z,
  // so the whole body is turned 180° here to actually face forward (away
  // from the camera) instead of walking backwards staring at the player.
  professor.rotation.y = Math.PI;
  scene.add(professor);

  // ---------- Student obstacle (stylized, looking at phone) ----------
  const studentColors = [0x5b6478, 0x8a6a4e, 0xd6d1c4, 0x3a5a78, 0x6b4a3a, 0x4a5240];

  function buildStudent() {
    const g = new THREE.Group();
    const shirtColor = studentColors[Math.floor(Math.random() * studentColors.length)];
    const skinMat = toonMat(0xd9a879);
    const shirtMat = toonMat(shirtColor);
    const pantsMat = toonMat(0x22242e);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), skinMat);
    head.position.set(0, 1.55, 0);
    head.rotation.x = 0.5; // looking down at phone
    g.add(head);

    // simple hair blob
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      toonMat(0x2b2116)
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

    // phone (glowing screen, angled up toward the lowered face so it
    // reads clearly at a glance as "aluno olhando pro celular")
    const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.025), toonMat(0x1a1c22));
    phoneBody.position.set(0, 1.32, 0.46);
    phoneBody.rotation.x = -0.75;
    g.add(phoneBody);

    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.3),
      toonMat(0x9fe8ff, { emissive: 0x4fd8ff, emissiveIntensity: 1.4 })
    );
    phoneScreen.position.set(0, 1.325, 0.475);
    phoneScreen.rotation.x = -0.75;
    g.add(phoneScreen);

    g.userData.hitRadius = 0.45;
    return g;
  }

  // ---------- Dragãozinho (collectible, gives bonus points) ----------
  // Built to read clearly as a dragon rather than a bird: elongated
  // serpentine body/tail, clawed legs, back spikes, horns + a long snout,
  // and bat-style membrane wings with rib struts instead of solid teardrops.
  function buildDragon() {
    const g = new THREE.Group();
    const bodyMat = toonMat(0x2e8f4a, { emissive: 0x0f5a2a, emissiveIntensity: 0.3 });
    const bellyMat = toonMat(0xd9c56a);
    const spikeMat = toonMat(0x8a6a2e);
    const clawMat = toonMat(0xe8dcb0);
    const wingMat = toonMat(0x3a2e5c, {
      emissive: 0x1c1638,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    const wingRibMat = toonMat(0x241c40);

    // ---- Serpentine body: three tapering segments (chest -> waist -> hip) ----
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bodyMat);
    chest.scale.set(1, 0.8, 1.1);
    chest.position.set(0, 0.02, 0.08);
    g.add(chest);

    const waist = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bodyMat);
    waist.scale.set(0.85, 0.7, 1);
    waist.position.set(0, -0.02, -0.14);
    g.add(waist);

    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bodyMat);
    hip.scale.set(0.7, 0.6, 0.9);
    hip.position.set(0, -0.03, -0.32);
    g.add(hip);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), bellyMat);
    belly.position.set(0, -0.07, 0.06);
    belly.scale.set(0.85, 0.55, 1.15);
    g.add(belly);

    // ---- Head: bigger skull, brow ridge, elongated snout, nostrils ----
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), bodyMat);
    head.position.set(0, 0.1, 0.28);
    g.add(head);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), spikeMat);
    brow.position.set(0, 0.16, 0.33);
    g.add(brow);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 8), bodyMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.05, 0.44);
    snout.scale.set(1, 0.75, 1);
    g.add(snout);

    [-0.025, 0.025].forEach((x) => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0x140c08 }));
      nostril.position.set(x, 0.04, 0.53);
      g.add(nostril);
    });

    const hornGeo = new THREE.ConeGeometry(0.022, 0.14, 6);
    const hornL = new THREE.Mesh(hornGeo, spikeMat);
    hornL.position.set(-0.06, 0.2, 0.24);
    hornL.rotation.set(-0.3, 0, -0.4);
    const hornR = hornL.clone();
    hornR.position.x = 0.06;
    hornR.rotation.z = 0.4;
    g.add(hornL, hornR);

    // eyes
    const eyeGeo = new THREE.SphereGeometry(0.02, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x110d05 });
    [-0.06, 0.06].forEach((x) => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 0.13, 0.36);
      g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), pupilMat);
      pupil.position.set(x, 0.13, 0.375);
      g.add(pupil);
    });

    // ---- Spikes down the spine, from neck to tail tip ----
    const spineSpikePositions = [0.24, 0.12, 0, -0.12, -0.24, -0.36, -0.46];
    spineSpikePositions.forEach((z, i) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028 - i * 0.002, 0.09 - i * 0.006, 5), spikeMat);
      spike.position.set(0, 0.14 - i * 0.012, z);
      spike.rotation.x = -0.25;
      g.add(spike);
    });

    // ---- Tail: long tapering cone ending in a spade tip ----
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 8), bodyMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, -0.04, -0.5);
    g.add(tail);
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), spikeMat);
    tailTip.rotation.x = -Math.PI / 2;
    tailTip.rotation.z = Math.PI / 4;
    tailTip.position.set(0, -0.05, -0.72);
    g.add(tailTip);

    // ---- Four tiny clawed legs, tucked under the body mid-flight ----
    [-1, 1].forEach((side) => {
      [0.06, -0.22].forEach((z) => {
        const leg = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), bodyMat);
        leg.scale.set(0.8, 1.3, 0.8);
        leg.position.set(side * 0.11, -0.13, z);
        g.add(leg);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 5), clawMat);
        claw.position.set(side * 0.11, -0.18, z + 0.03);
        claw.rotation.x = Math.PI / 2.4;
        g.add(claw);
      });
    });

    // ---- Wings: leathery membrane with visible rib struts, bat-style ----
    function makeWing(sign) {
      const wingGroup = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(sign * 0.16, 0.22);
      shape.lineTo(sign * 0.34, 0.16);
      shape.lineTo(sign * 0.44, -0.02);
      shape.lineTo(sign * 0.34, -0.1);
      shape.lineTo(sign * 0.2, -0.16);
      shape.lineTo(sign * 0.08, -0.1);
      shape.lineTo(0, -0.04);
      const geo = new THREE.ShapeGeometry(shape);
      const membrane = new THREE.Mesh(geo, wingMat);
      wingGroup.add(membrane);

      // rib struts fanning out from the shoulder, like finger bones
      const ribTips = [
        [sign * 0.16, 0.22],
        [sign * 0.34, 0.16],
        [sign * 0.44, -0.02],
        [sign * 0.34, -0.1]
      ];
      ribTips.forEach(([tx, ty]) => {
        const len = Math.hypot(tx, ty);
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, len, 4), wingRibMat);
        rib.position.set(tx / 2, ty / 2, 0.002);
        rib.rotation.z = Math.atan2(ty, tx) - Math.PI / 2;
        wingGroup.add(rib);
      });

      wingGroup.position.set(sign * 0.1, 0.08, -0.04);
      return wingGroup;
    }
    const wingL = makeWing(-1);
    const wingR = makeWing(1);
    g.add(wingL, wingR);

    g.userData.wings = { wingL, wingR };
    g.userData.flap = Math.random() * Math.PI * 2;
    g.scale.setScalar(1.5);
    return g;
  }

  // ---------- Object pools ----------
  const obstacles = []; // {mesh, lane}
  const coins = []; // {mesh, lane} -- small dragons, kept name for internal simplicity

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

    // spawn a small flying dragon in a free lane sometimes
    const freeLanes = [0, 1, 2].filter((l) => !blocked.includes(l));
    if (freeLanes.length && Math.random() < 0.55) {
      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      const dragon = buildDragon();
      dragon.position.set(LANE_X[lane], 1.1, SPAWN_Z - 2);
      scene.add(dragon);
      coins.push({ mesh: dragon, lane });
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
  let distance = 0; // internal metres travelled, drives difficulty ramp
  let score = 0; // points shown to the player
  let dragonsCollected = 0;
  const POINTS_PER_METER = 1;
  const POINTS_PER_DRAGON = 50;
  let best = Number(localStorage.getItem("professorGameBestScore") || 0);
  let spawnTimer = 0;
  let elapsed = 0;
  let runId = 0;

  bestEl.textContent = `Recorde: ${Math.floor(best)} pts`;

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
    score = 0;
    dragonsCollected = 0;
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
    if (score > best) {
      best = score;
      localStorage.setItem("professorGameBestScore", String(Math.floor(best)));
    }
    goScoreEl.textContent = `Você fez ${Math.floor(score)} pontos (${dragonsCollected} dragõezinhos coletados).`;
    goMsgEl.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    bestEl.textContent = `Recorde: ${Math.floor(best)} pts`;
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
        dragonsCollected++;
        score += POINTS_PER_DRAGON;
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
    score += speed * delta * 0.6 * POINTS_PER_METER;

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
      c.mesh.rotation.y += delta * 2.2;
      c.mesh.position.y = 1.1 + Math.sin(elapsed * 4 + c.mesh.position.x) * 0.18;
      const flap = Math.sin((elapsed + c.mesh.userData.flap) * 14);
      const { wingL, wingR } = c.mesh.userData.wings;
      wingL.rotation.y = flap * 0.9;
      wingR.rotation.y = -flap * 0.9;
    });
    windowGroup.children.forEach((s) => {
      s.position.z += move;
      if (s.position.z > 10) s.position.z -= (Math.abs(SPAWN_Z) * 2 + 20);
    });
    tubeGroup.children.forEach((s) => {
      s.position.z += move;
      if (s.position.z > 10) s.position.z -= (Math.abs(SPAWN_Z) * 2 + 20);
    });
    outletGroup.children.forEach((s) => {
      s.position.z += move;
      if (s.position.z > 10) s.position.z -= (Math.abs(SPAWN_Z) * 2 + 20);
    });
    doorGroup.children.forEach((s) => {
      s.position.z += move;
      if (s.position.z > 10) s.position.z -= (Math.abs(SPAWN_Z) * 2 + 20);
    });
    courtyardGroup.children.forEach((s) => {
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
    scoreEl.textContent = `${Math.floor(score)} pts`;
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
