import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "./firebaseConfig.js";

// 파이어베이스 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 브라우저 강제 다크모드 방지 (라이트 테마 고정)
const metaColorScheme = document.createElement("meta");
metaColorScheme.name = "color-scheme";
metaColorScheme.content = "light only";
document.head.appendChild(metaColorScheme);

const { Engine, Render, Runner, World, Bodies, Body, Events } = Matter;

// 1. 엔진 및 렌더러 초기화
const engine = Engine.create();
const world = engine.world;

const gameArea = document.getElementById("game-area");
const width = 480;
const height = 700;

const render = Render.create({
  element: gameArea,
  engine: engine,
  options: {
    width: width,
    height: height,
    wireframes: false, // 와이어프레임 끄기 (색상 채우기)
    background: "transparent", // CSS에서 배경색 제어하도록 투명으로 변경
  },
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 2. 벽 생성 (바닥, 왼쪽, 오른쪽)
const wallOptions = {
  isStatic: true,
  render: { fillStyle: "#8B4513" },
};
const ground = Bodies.rectangle(width / 2, height, width, 60, wallOptions);
const leftWall = Bodies.rectangle(0, height / 2, 20, height, wallOptions);
const rightWall = Bodies.rectangle(width, height / 2, 20, height, wallOptions);

World.add(world, [ground, leftWall, rightWall]);

// 3. 과일 데이터 정의
const FRUITS = [
  {
    name: "체리",
    radius: 15,
    color: "rgb(240, 89, 89)",
    score: 10,
    face: "smile",
  },
  { name: "딸기", radius: 25, color: "#F88", score: 20, face: "wink" },
  { name: "포도", radius: 35, color: "#A0F", score: 30, face: "surprised" },
  { name: "한라봉", radius: 45, color: "#FA0", score: 40, face: "sleepy" },
  { name: "오렌지", radius: 55, color: "#F80", score: 50, face: "neutral" },
  { name: "사과", radius: 65, color: "#F00", score: 60, face: "laugh" },
  { name: "배", radius: 75, color: "#FF8", score: 70, face: "worried" },
  { name: "복숭아", radius: 85, color: "#FBC", score: 80, face: "happy" },
  { name: "파인애플", radius: 95, color: "#FF0", score: 90, face: "confused" },
  { name: "멜론", radius: 105, color: "#8F8", score: 100, face: "excited" },
  {
    name: "수박",
    radius: 115,
    color: "#0F0",
    score: 110,
    face: "big_smile",
  },
];

let currentFruit = null;
let isClickable = true;
let score = 0;
const scoreElement = document.getElementById("score");
let dropCount = 0;
let nextFruitIndex = null; // 다음에 나올 과일 인덱스
const nextFruitElement = document.getElementById("next-fruit");
const recentScoresElement = document.getElementById("recent-scores");
const latestScoresElement = document.getElementById("latest-scores");
const gameOverModal = document.getElementById("game-over-modal");
const finalScoreElement = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");
const bgmBtn = document.getElementById("bgm-btn");
const bgmVolumeSlider = document.getElementById("bgm-volume");
const shakeBtn = document.getElementById("shake-btn");
const evolutionList = document.getElementById("evolution-list");
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const themeBtn = document.getElementById("theme-btn");
const shareBtn = document.getElementById("share-btn");

// 콤보 시스템 변수
let comboCount = 0;
let comboTimer = null;

// 기록 불러오기 함수
async function loadRecords() {
  if (!firebaseConfig.apiKey) return;
  // 내 점수 ID 목록 가져오기
  const myScoreIds = JSON.parse(
    localStorage.getItem("suika-my-score-ids") || "[]",
  );

  // 파이어베이스(서버)에서 상위 5개 점수 가져오기 (점수 내림차순)
  const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(5));
  const querySnapshot = await getDocs(q);

  const scores = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // 5칸 고정 (데이터가 없어도 빈 칸 유지)
  const fixedTop5 = Array.from({ length: 5 }, (_, i) => scores[i] || null);

  recentScoresElement.innerHTML = fixedTop5
    .map((entry, index) => {
      let rank = `${index + 1}위`;
      if (index === 0) rank = "🥇";
      if (index === 1) rank = "🥈";
      if (index === 2) rank = "🥉";

      if (!entry) {
        return `<li>${rank} <span style="color: rgba(255,255,255,0.5);">-</span></li>`;
      }

      const isMine = myScoreIds.includes(entry.id);
      const style = isMine
        ? 'style="color: #ffeaa7; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"'
        : "";
      return `<li ${style}>${rank} ${entry.name}: ${entry.score}</li>`;
    })
    .join("");

  // 최근 기록 20개 가져오기 (날짜 내림차순)
  const qRecent = query(
    collection(db, "scores"),
    orderBy("date", "desc"),
    limit(20),
  );
  const querySnapshotRecent = await getDocs(qRecent);
  const recentScores = querySnapshotRecent.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // 20칸 고정 (데이터가 없어도 빈 칸 유지)
  const fixedRecent10 = Array.from(
    { length: 20 },
    (_, i) => recentScores[i] || null,
  );

  latestScoresElement.innerHTML = fixedRecent10
    .map((entry) => {
      if (!entry) {
        return `<li style="color: rgba(255,255,255,0.5);">-</li>`;
      }

      const isMine = myScoreIds.includes(entry.id);
      const style = isMine
        ? 'style="color: #ffeaa7; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"'
        : "";
      return `<li ${style}>${entry.name}: ${entry.score}</li>`;
    })
    .join("");
}
loadRecords();

// 진화 가이드 생성
FRUITS.forEach((fruit, index) => {
  const li = document.createElement("li");

  const icon = document.createElement("canvas");
  icon.className = "fruit-icon";
  icon.width = 32;
  icon.height = 32;

  const ctx = icon.getContext("2d");
  const radius = 14;
  ctx.translate(16, 16);
  drawFruitDecoration(ctx, radius, fruit, fruit.face);
  ctx.translate(-16, -16);

  const name = document.createElement("span");
  name.textContent = fruit.name;

  li.appendChild(icon);
  li.appendChild(name);
  evolutionList.appendChild(li);

  if (index < FRUITS.length - 1) {
    const arrow = document.createElement("li");
    arrow.className = "evolution-arrow";
    arrow.textContent = "▼";
    evolutionList.appendChild(arrow);
  }
});

// 과일 생성 함수
function createFruit(x, y, index, isStatic = false) {
  const fruitData = FRUITS[index];
  const fruit = Bodies.circle(x, y, fruitData.radius, {
    label: "fruit",
    isStatic: isStatic,
    restitution: 0.3, // 탄성 높임 (충돌 시 반발력 증가)
    friction: 0.0005, // 마찰력 더 감소 (아주 잘 구르도록)
    frictionStatic: 0.0005, // 정지 마찰력 더 감소
    render: { fillStyle: fruitData.color },
  });
  fruit.fruitIndex = index; // 과일 단계 저장
  return fruit;
}

// Next Fruit 결정 및 UI 업데이트 함수
function setNextFruit() {
  let maxIndex = 5;
  if (dropCount < 10) {
    maxIndex = 2;
  }
  nextFruitIndex = Math.floor(Math.random() * (maxIndex + 1));

  // UI 업데이트
  const nextFruitData = FRUITS[nextFruitIndex];
  const ctx = nextFruitElement.getContext("2d");
  const width = nextFruitElement.width;
  const height = nextFruitElement.height;

  ctx.clearRect(0, 0, width, height);
  const radius = width / 2 - 2; // 캔버스 크기에 맞춰 꽉 차게 그림 (고정 크기)
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.translate(centerX, centerY);
  drawFruitDecoration(ctx, radius, nextFruitData, nextFruitData.face);
  ctx.translate(-centerX, -centerY);
}

// 대기 중인 과일 생성 (상단)
function addCurrentFruit() {
  // 처음 실행 시 nextFruit이 없으면 생성
  if (nextFruitIndex === null) {
    setNextFruit();
  }

  const fruit = createFruit(width / 2, 30, nextFruitIndex, true); // 생성 위치를 조금 더 위로(30) 올림
  currentFruit = fruit;
  World.add(world, fruit);

  // 다음 과일 미리 준비
  setNextFruit();
}

// 4. 조작 이벤트 (마우스/터치)
gameArea.addEventListener("mousemove", (e) => {
  if (!isClickable || !currentFruit) return;

  const rect = render.canvas.getBoundingClientRect();
  const scaleX = rect.width / width;
  let x = (e.clientX - rect.left) / scaleX;

  // 벽 밖으로 나가지 않게 제한
  const radius = currentFruit.circleRadius;
  if (x < 20 + radius) x = 20 + radius;
  if (x > width - 20 - radius) x = width - 20 - radius;

  Body.setPosition(currentFruit, { x: x, y: 30 }); // 이동 위치도 30으로 조정
});

gameArea.addEventListener(
  "touchstart",
  (e) => {
    if (!isClickable || !currentFruit) return;
    e.preventDefault(); // 스크롤 방지

    const rect = render.canvas.getBoundingClientRect();
    const scaleX = rect.width / width;
    let x = (e.touches[0].clientX - rect.left) / scaleX;

    // 벽 밖으로 나가지 않게 제한
    const radius = currentFruit.circleRadius;
    if (x < 20 + radius) x = 20 + radius;
    if (x > width - 20 - radius) x = width - 20 - radius;

    Body.setPosition(currentFruit, { x: x, y: 30 });
  },
  { passive: false },
);

gameArea.addEventListener(
  "touchmove",
  (e) => {
    if (!isClickable || !currentFruit) return;
    e.preventDefault(); // 스크롤 방지

    const rect = render.canvas.getBoundingClientRect();
    const scaleX = rect.width / width;
    let x = (e.touches[0].clientX - rect.left) / scaleX;

    // 벽 밖으로 나가지 않게 제한
    const radius = currentFruit.circleRadius;
    if (x < 20 + radius) x = 20 + radius;
    if (x > width - 20 - radius) x = width - 20 - radius;

    Body.setPosition(currentFruit, { x: x, y: 30 });
  },
  { passive: false },
);

gameArea.addEventListener("click", (e) => {
  if (isClickable && currentFruit) {
    const rect = render.canvas.getBoundingClientRect();
    const scaleX = rect.width / width;
    let x = (e.clientX - rect.left) / scaleX;

    // 벽 밖으로 나가지 않게 제한
    const radius = currentFruit.circleRadius;
    if (x < 20 + radius) x = 20 + radius;
    if (x > width - 20 - radius) x = width - 20 - radius;

    Body.setPosition(currentFruit, { x: x, y: 30 });
    dropFruit();
  }
});

gameArea.addEventListener("touchend", (e) => {
  if (isClickable) dropFruit();
});

// 과일 떨어뜨리기
function dropFruit() {
  if (!currentFruit) return;
  isClickable = false;

  dropCount++;
  Body.setStatic(currentFruit, false); // 물리 효과 활성화 (떨어짐)
  playDropSound();
  currentFruit = null;

  // 1초 뒤에 다음 과일 생성
  setTimeout(() => {
    addCurrentFruit();
    isClickable = true;
  }, 1000);
}

// 5. 충돌 감지 및 합체 로직
Events.on(engine, "collisionStart", (event) => {
  const pairs = event.pairs;

  pairs.forEach((pair) => {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    // 두 물체가 모두 과일인 경우
    if (bodyA.label === "fruit" && bodyB.label === "fruit") {
      // 같은 단계의 과일이면
      if (bodyA.fruitIndex === bodyB.fruitIndex) {
        const index = bodyA.fruitIndex;

        // 수박(마지막 단계)이면 합쳐지지 않음
        if (index === FRUITS.length - 1) return;

        // 이미 제거된 물체인지 확인 (중복 실행 방지)
        if (!world.bodies.includes(bodyA) || !world.bodies.includes(bodyB))
          return;

        // 충돌 위치 중간값 계산
        const midX = (bodyA.position.x + bodyB.position.x) / 2;
        const midY = (bodyA.position.y + bodyB.position.y) / 2;

        // 기존 과일 제거
        World.remove(world, [bodyA, bodyB]);

        // 콤보 계산
        comboCount++;
        if (comboTimer) clearTimeout(comboTimer);
        comboTimer = setTimeout(() => {
          comboCount = 0;
        }, 1000); // 1초 내에 연속 합체 시 콤보 유지

        // 효과음 및 파티클 실행
        playPopSound();
        createParticles(midX, midY, FRUITS[index].color);

        // 다음 단계 과일 생성
        const newFruit = createFruit(midX, midY, index + 1);
        World.add(world, newFruit);

        // 수박(index 9 -> 10) 탄생 시 축하 효과
        if (index === FRUITS.length - 2) {
          celebrateWatermelon();
        }

        // 점수 증가
        let scoreToAdd = FRUITS[index].score * 2;
        if (comboCount > 1) {
          scoreToAdd += (comboCount - 1) * 10; // 콤보당 10점 추가 보너스
        }
        score += scoreToAdd;
        scoreElement.textContent = score;

        // 점수 애니메이션
        showFloatingScore(midX, midY, scoreToAdd, comboCount);
      }
    }
  });
});

// 6. 게임 오버 로직 (상단 라인 넘었을 때)
const limitLineY = 100; // 게임 오버 기준선을 더 위로 올림 (공간 확보)
let gameOverTimestamp = 0; // 게임 오버 타이머

Events.on(engine, "afterUpdate", () => {
  // 물리 시뮬레이션 업데이트 후 실행
  const fruits = world.bodies.filter((body) => {
    // 과일이면서, 고정된 대기 과일이 아니고, 기준선보다 위에 있는 경우
    return (
      body.label === "fruit" && !body.isStatic && body.position.y < limitLineY
    );
  });

  if (fruits.length > 0) {
    // 기준선 넘은 과일이 있으면 시간 측정 시작
    if (gameOverTimestamp === 0) {
      gameOverTimestamp = Date.now();
    } else {
      // 2초 동안 계속 넘어가 있으면 게임 오버
      if (Date.now() - gameOverTimestamp > 2000) {
        Runner.stop(runner); // 게임 중지
        isClickable = false; // 조작 차단

        playGameOverSound(); // 게임 오버 효과음 재생
        // 모달 띄우기
        finalScoreElement.textContent = score;
        gameOverModal.classList.remove("hidden");
      }
    }
  } else {
    // 기준선 넘은 과일이 없으면 타이머 초기화
    gameOverTimestamp = 0;
  }
});

// 기준선 그리기 (렌더링 루프에 추가)
Events.on(render, "afterRender", () => {
  const ctx = render.context;
  ctx.beginPath();
  ctx.moveTo(0, limitLineY);
  ctx.lineTo(width, limitLineY);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // 점선
  ctx.stroke();
  ctx.setLineDash([]); // 점선 초기화

  // 과일 표정 그리기
  const bodies = world.bodies;
  bodies.forEach((body) => {
    if (body.label === "fruit") {
      const { x, y } = body.position;
      const radius = body.circleRadius;
      const fruitData = FRUITS[body.fruitIndex];
      const face = fruitData ? fruitData.face : "smile";
      const name = fruitData ? fruitData.name : "";

      ctx.translate(x, y);
      ctx.rotate(body.angle);

      drawFruitDecoration(ctx, radius, fruitData, face);

      ctx.rotate(-body.angle);
      ctx.translate(-x, -y);
    }
  });
});

// 7. 효과음 및 파티클 시스템
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPopSound() {
  // 브라우저 정책상 사용자 인터랙션 후 오디오 컨텍스트 활성화 필요
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    600,
    audioCtx.currentTime + 0.1,
  );

  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
}

function playDropSound() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    300,
    audioCtx.currentTime + 0.1,
  );

  gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
}

function playGameOverSound() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = "triangle"; // 부드러운 소리
  oscillator.frequency.setValueAtTime(330, audioCtx.currentTime); // E4
  oscillator.frequency.linearRampToValueAtTime(165, audioCtx.currentTime + 0.8); // 부드럽게 하강

  gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.8);
}

function playClapSound() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // 노이즈 버퍼 생성 (박수 소리 시뮬레이션)
  const bufferSize = audioCtx.sampleRate * 2; // 2초 길이
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  // 여러 번의 박수 소리를 랜덤한 타이밍에 재생
  for (let i = 0; i < 15; i++) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const gainNode = audioCtx.createGain();
    // 1.5초 내에서 랜덤하게 시작
    const startTime = audioCtx.currentTime + Math.random() * 1.5;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01); // 소리 커짐
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1); // 빠르게 사라짐

    noise.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noise.start(startTime);
    noise.stop(startTime + 0.15);
  }
}

function celebrateWatermelon() {
  playClapSound();

  // 폭죽 연발 (0.2초 간격으로 10번)
  let count = 0;
  const interval = setInterval(() => {
    const x = Math.random() * width;
    const y = (Math.random() * height) / 2; // 화면 상단 절반 영역
    const color = FRUITS[Math.floor(Math.random() * FRUITS.length)].color;
    createParticles(x, y, color);
    count++;
    if (count >= 10) clearInterval(interval);
  }, 200);
}

function createParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const particle = Bodies.circle(x, y, 4, {
      render: { fillStyle: color },
      isSensor: true, // 물리적 충돌 무시 (시각 효과만)
      frictionAir: 0.05,
    });

    const angle = (Math.PI * 2 * i) / 8;
    const force = 0.002;
    Body.applyForce(particle, particle.position, {
      x: Math.cos(angle) * force,
      y: Math.sin(angle) * force,
    });

    World.add(world, particle);

    // 0.6초 후 제거
    setTimeout(() => {
      World.remove(world, particle);
    }, 600);
  }
}

// 8. 재시작 버튼 이벤트
restartBtn.addEventListener("click", async () => {
  // 점수 저장 로직 이동
  const currentScore = score;
  const playerName = document.getElementById("player-name").value || "익명";

  restartBtn.disabled = true;
  restartBtn.textContent = "저장 중...";

  // 게임을 먼저 초기화 (저장 지연으로 인한 멈춤 방지)
  resetGame();

  // 서버(파이어베이스)에 점수 저장 (백그라운드 처리)
  try {
    const docRef = await addDoc(collection(db, "scores"), {
      name: playerName,
      score: currentScore,
      date: new Date().toISOString(),
    });

    // 내 점수 ID를 로컬 스토리지에 저장 (하이라이트용)
    const myScoreIds = JSON.parse(
      localStorage.getItem("suika-my-score-ids") || "[]",
    );
    myScoreIds.push(docRef.id);
    localStorage.setItem("suika-my-score-ids", JSON.stringify(myScoreIds));

    // 저장이 완료되면 랭킹 목록 갱신
    loadRecords();
  } catch (e) {
    console.error("점수 저장 실패:", e);
    alert("점수 저장 실패! (게임은 초기화되었습니다)\n" + e.message);
  }
});

// 게임 초기화 함수 (새로고침 없이 재시작)
function resetGame() {
  // 1. 물리 엔진 초기화
  World.clear(world); // 모든 물체 제거
  World.add(world, [ground, leftWall, rightWall]); // 벽 다시 추가

  // 2. 게임 상태 변수 초기화
  score = 0;
  scoreElement.textContent = score;
  dropCount = 0;
  comboCount = 0;
  gameOverTimestamp = 0;
  currentFruit = null;
  isClickable = true;
  nextFruitIndex = null;

  // 흔들기 초기화
  shakeCount = 3;
  isShakeCooldown = false;
  if (shakeTimer) {
    clearInterval(shakeTimer);
    shakeTimer = null;
  }
  shakeBtn.disabled = false;
  shakeBtn.textContent = "🫨 흔들기 (3)";

  // 3. UI 초기화
  gameOverModal.classList.add("hidden");
  restartBtn.disabled = false;
  restartBtn.textContent = "기록 저장 및 재시작";

  // 4. 게임 다시 시작
  Runner.run(runner, engine);
  addCurrentFruit();
  loadRecords(); // 랭킹 갱신
}

// 9. BGM 기능
let bgmTimer = null;
let bgmIndex = 0;
let bgmState = 0; // 0: OFF, 1: BGM1, 2: BGM2, 3: BGM3
let bgmVolume = 1.0; // 기본 볼륨

const bgmTracks = [
  {
    name: "🎵 BGM 1 (Original)",
    tempo: 400,
    type: "sine",
    notes: [
      261.63,
      329.63,
      392.0,
      329.63, // C E G E
      261.63,
      329.63,
      392.0,
      329.63,
      349.23,
      440.0,
      523.25,
      440.0, // F A C A
      349.23,
      440.0,
      523.25,
      440.0,
    ],
  },
  {
    name: "🎵 BGM 2 (Exciting)",
    tempo: 150,
    type: "triangle",
    notes: [
      261.63,
      329.63,
      392.0,
      523.25,
      392.0,
      329.63, // C E G C5 G E
      293.66,
      349.23,
      440.0,
      587.33,
      440.0,
      349.23, // D F A D5 A F
      329.63,
      392.0,
      493.88,
      659.25,
      493.88,
      392.0, // E G B E5 B G
      349.23,
      440.0,
      523.25,
      698.46,
      523.25,
      440.0, // F A C5 F5 C A
    ],
  },
  {
    name: "🎵 BGM 3 (Lovely)",
    name: "🎵 BGM 3 (Playful)",
    tempo: 180,
    type: "sine",
    notes: [
      261.63,
      329.63,
      392.0,
      523.25, // C E G C5
      440.0,
      392.0,
      349.23,
      329.63, // A G F E
      293.66,
      329.63,
      349.23,
      293.66, // D E F D
      261.63,
      392.0,
      261.63,
      0, // C G C
      440.0,
      392.0,
      349.23,
      329.63, // A G F E
      293.66,
      329.63,
      349.23,
      293.66, // D E F D
      261.63,
      392.0,
      261.63,
      0, // C G C
    ],
  },
];

function playBGM(trackIndex) {
  if (bgmTimer) clearInterval(bgmTimer);
  if (audioCtx.state === "suspended") audioCtx.resume();

  const track = bgmTracks[trackIndex];
  bgmIndex = 0;

  bgmTimer = setInterval(() => {
    const note = track.notes[bgmIndex % track.notes.length];
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = track.type;
    oscillator.frequency.value = note;

    // 볼륨 및 페이드 아웃
    gainNode.gain.setValueAtTime(0.02 * bgmVolume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + track.tempo / 1000,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + track.tempo / 1000);
    bgmIndex++;
  }, track.tempo);
}

bgmBtn.addEventListener("click", () => {
  bgmState = (bgmState + 1) % 4; // 0 -> 1 -> 2 -> 3 -> 0

  if (bgmState === 0) {
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = null;
    bgmBtn.textContent = "🎵 BGM OFF";
  } else {
    playBGM(bgmState - 1);
    bgmBtn.textContent = bgmTracks[bgmState - 1].name;
  }
});

// 볼륨 슬라이더 이벤트
if (bgmVolumeSlider) {
  bgmVolumeSlider.addEventListener("input", (e) => {
    bgmVolume = parseFloat(e.target.value);
  });
}

// 10. 흔들기 기능
let shakeCount = 3;
let isShakeCooldown = false;
let shakeTimer = null;

shakeBtn.addEventListener("click", () => {
  if (shakeCount > 0 && !isShakeCooldown) {
    shakeCount--;

    world.bodies.forEach((body) => {
      if (body.label === "fruit" && !body.isStatic) {
        const forceMagnitude = 0.05 * body.mass;

        // 데드라인 근처(150px 여유)에 있는 과일은 위로 튕기지 않도록 힘 조절
        let forceY = -forceMagnitude;
        if (body.position.y < limitLineY + 150) {
          forceY = 0;
        }

        Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * forceMagnitude,
          y: forceY, // 위로 튕기기
        });
      }
    });

    // 화면 흔들기 효과
    const gameContainer = document.querySelector(".game-container");
    gameContainer.classList.add("shaking");
    setTimeout(() => {
      gameContainer.classList.remove("shaking");
    }, 500);

    if (shakeCount === 0) {
      shakeBtn.disabled = true;
      shakeBtn.textContent = `🫨 흔들기 (0)`;
    } else {
      isShakeCooldown = true;
      shakeBtn.disabled = true;
      let cooldown = 3;
      shakeBtn.textContent = `⏳ ${cooldown}s`;

      shakeTimer = setInterval(() => {
        cooldown--;
        if (cooldown > 0) {
          shakeBtn.textContent = `⏳ ${cooldown}s`;
        } else {
          clearInterval(shakeTimer);
          shakeTimer = null;
          isShakeCooldown = false;
          shakeBtn.disabled = false;
          shakeBtn.textContent = `🫨 흔들기 (${shakeCount})`;
        }
      }, 1000);
    }
  }
});

// 11. 점수 애니메이션 함수
function showFloatingScore(x, y, score, combo = 0) {
  const el = document.createElement("div");
  el.className = "floating-score";

  if (combo > 1) {
    el.innerHTML = `+${score}<br><span style="font-size: 0.6em; color: #ff4757;">COMBO x${combo}</span>`;
  } else {
    el.textContent = `+${score}`;
  }

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.textAlign = "center";
  gameArea.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 1000);
}

// 12. 게임 시작 버튼 이벤트
startBtn.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  addCurrentFruit();
  // 오디오 컨텍스트 활성화 (브라우저 정책 대응)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // 게임 시작 시 BGM 1 자동 재생
  bgmState = 1;
  playBGM(0);
  bgmBtn.textContent = bgmTracks[0].name;
});

// 13. 테마 변경 기능
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("night-mode");
  if (document.body.classList.contains("night-mode")) {
    themeBtn.textContent = "🌞 Day";
  } else {
    themeBtn.textContent = "🌙 Night";
  }
});

// 15. 공유하기 버튼 기능
shareBtn.addEventListener("click", async () => {
  // 1. 모바일/지원되는 브라우저: 네이티브 공유 창 띄우기 (카카오톡 등 앱 연동)
  if (navigator.share) {
    try {
      await navigator.share({
        title: "수박 게임 🍉",
        text: "친구와 함께 수박 게임을 즐겨보세요! 누가 더 높은 점수를 받을까요?",
        url: window.location.href,
      });
      return; // 공유 성공 시 종료
    } catch (err) {
      // 사용자가 공유를 취소한 경우는 에러로 처리하지 않음
      if (err.name === "AbortError") return;
      console.log("네이티브 공유 실패, 클립보드 복사로 전환합니다.", err);
    }
  }

  // 2. 미지원 브라우저(PC 등): 클립보드에 주소 복사
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("게임 주소가 복사되었습니다! 친구들에게 공유해보세요 🔗");
  } catch (err) {
    console.error("공유 실패:", err);
    // 보안상 이유로 클립보드 접근이 안될 경우 대비
    prompt("이 주소를 복사해서 공유하세요:", window.location.href);
  }
});

// 14. 개발자 전용 치트키 (Shift + Alt + W)
window.addEventListener("keydown", (e) => {
  if (
    e.shiftKey &&
    e.altKey &&
    (e.key.toLowerCase() === "w" || e.key === "ㅈ")
  ) {
    if (currentFruit && isClickable) {
      World.remove(world, currentFruit);
      const { x, y } = currentFruit.position;
      // 수박은 배열의 마지막 요소
      currentFruit = createFruit(x, y, FRUITS.length - 1, true);
      World.add(world, currentFruit);
      console.log("🍉 시크릿 모드: 수박 장전 완료!");
    }
  }
});

function drawFruitDecoration(ctx, radius, fruitData, face) {
  const name = fruitData.name;

  // 배경 원 그리기 (UI 및 게임 화면 공통)
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = fruitData.color;
  ctx.fill();

  // 0. 과일 특징 그리기 (줄기, 잎, 무늬 등)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (name === "체리") {
    // 줄기
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.8);
    ctx.quadraticCurveTo(
      radius * 0.2,
      -radius * 1.5,
      radius * 0.8,
      -radius * 2,
    );
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (name === "딸기") {
    // 씨앗
    ctx.fillStyle = "rgba(255, 235, 59, 0.6)";
    [
      [-0.4, 0.2],
      [0.4, 0.2],
      [0, 0.6],
      [-0.3, -0.2],
      [0.3, -0.2],
    ].forEach((pos) => {
      ctx.beginPath();
      ctx.arc(radius * pos[0], radius * pos[1], radius * 0.08, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (name === "한라봉") {
    // 꼭지 (볼록한 부분)
    ctx.beginPath();
    ctx.arc(0, -radius * 0.9, radius * 0.35, Math.PI, 0);
    ctx.fillStyle = fruitData.color;
    ctx.fill();
    // 잎
    ctx.beginPath();
    ctx.ellipse(
      radius * 0.2,
      -radius * 1.1,
      radius * 0.2,
      radius * 0.1,
      -Math.PI / 4,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#4CAF50";
    ctx.fill();
  } else if (name === "사과" || name === "오렌지" || name === "복숭아") {
    // 잎
    ctx.beginPath();
    ctx.ellipse(
      0,
      -radius * 0.95,
      radius * 0.2,
      radius * 0.1,
      -Math.PI / 4,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#4CAF50";
    ctx.fill();
    // 줄기 (사과만)
    if (name === "사과") {
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.8);
      ctx.lineTo(0, -radius * 1.1);
      ctx.strokeStyle = "#6d4c41";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  } else if (name === "배") {
    // 줄기
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.9);
    ctx.lineTo(radius * 0.1, -radius * 1.2);
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (name === "파인애플") {
    // 뾰족한 잎
    ctx.fillStyle = "#4CAF50";
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.9);
    ctx.lineTo(-radius * 0.3, -radius * 1.4);
    ctx.lineTo(radius * 0.3, -radius * 1.4);
    ctx.fill();
  } else if (name === "멜론") {
    // 그물 무늬
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, -radius * 0.5);
    ctx.lineTo(radius * 0.5, -radius * 0.5);
    ctx.moveTo(-radius * 0.5, radius * 0.5);
    ctx.lineTo(radius * 0.5, radius * 0.5);
    ctx.moveTo(0, -radius * 0.8);
    ctx.lineTo(0, radius * 0.8);
    ctx.stroke();
    // T자 줄기
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, -radius * 1.2);
    ctx.moveTo(-radius * 0.15, -radius * 1.2);
    ctx.lineTo(radius * 0.15, -radius * 1.2);
    ctx.stroke();
  } else if (name === "수박") {
    // 줄무늬
    ctx.strokeStyle = "#1b5e1f85"; // 진한 초록
    ctx.lineWidth = radius * 0.1;
    ctx.beginPath();
    for (let i = -0.8; i <= 0.85; i += 0.4) {
      const yLen = Math.sqrt(1 - i * i) * 0.8;
      ctx.moveTo(radius * i, -radius * yLen);
      ctx.bezierCurveTo(
        radius * (i - 0.3),
        -radius * 0.2,
        radius * (i + 0.3),
        radius * 0.2,
        radius * i,
        radius * yLen,
      );
    }
    ctx.stroke();
  }

  // 1. 볼터치 (귀여움 포인트)
  ctx.fillStyle = "rgba(255, 100, 100, 0.4)"; // 연한 분홍색
  const blushX = radius * 0.45;
  const blushY = radius * 0.1;
  const blushSize = radius * 0.18; // 볼터치 크기 증가

  ctx.beginPath();
  ctx.arc(-blushX, blushY, blushSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(blushX, blushY, blushSize, 0, Math.PI * 2);
  ctx.fill();

  // 2. 눈과 입 스타일 설정
  ctx.fillStyle = "#444"; // 진한 회색 (더 선명하게)
  ctx.strokeStyle = "#444";
  ctx.lineWidth = Math.max(2, radius * 0.08); // 크기에 비례한 두께
  ctx.lineCap = "round";

  const eyeX = radius * 0.3;
  const eyeY = -radius * 0.15;
  const eyeSize = radius * 0.13;

  // 눈 그리기 헬퍼 (반짝이는 하이라이트 포함)
  const drawCuteEye = (ex, ey, es) => {
    ctx.beginPath();
    ctx.arc(ex, ey, es, 0, Math.PI * 2);
    ctx.fillStyle = "#444";
    ctx.fill();
    // 하이라이트 (흰색 점)
    ctx.beginPath();
    ctx.arc(ex - es * 0.3, ey - es * 0.3, es * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  };

  if (face === "smile") {
    // 기본 스마일
    drawCuteEye(-eyeX, eyeY, eyeSize);
    drawCuteEye(eyeX, eyeY, eyeSize);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (face === "wink") {
    // 윙크
    drawCuteEye(-eyeX, eyeY, eyeSize);
    // 윙크하는 눈 (> 모양)
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeSize, eyeY);
    ctx.quadraticCurveTo(eyeX, eyeY - eyeSize, eyeX + eyeSize, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (face === "surprised") {
    // 놀람 (O 입)
    // 눈 (작은 점)
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY, eyeSize * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "#444";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // 입 (동그란 O)
    ctx.beginPath();
    ctx.ellipse(
      0,
      radius * 0.2,
      radius * 0.1,
      radius * 0.15,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (face === "sleepy") {
    // 졸림 (- - 눈)
    ctx.beginPath();
    ctx.moveTo(-eyeX - eyeSize, eyeY);
    ctx.lineTo(-eyeX + eyeSize, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeSize, eyeY);
    ctx.lineTo(eyeX + eyeSize, eyeY);
    ctx.stroke();
    // 입 (작은 o)
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (face === "neutral") {
    // 무표정 (- 입)
    drawCuteEye(-eyeX, eyeY, eyeSize);
    drawCuteEye(eyeX, eyeY, eyeSize);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.2, radius * 0.2);
    ctx.lineTo(radius * 0.2, radius * 0.2);
    ctx.stroke();
  } else if (face === "laugh") {
    // 웃음 (> < 눈)
    ctx.beginPath();
    ctx.moveTo(-eyeX - eyeSize, eyeY - eyeSize / 2);
    ctx.lineTo(-eyeX, eyeY + eyeSize / 2);
    ctx.lineTo(-eyeX + eyeSize, eyeY - eyeSize / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeSize, eyeY - eyeSize / 2);
    ctx.lineTo(eyeX, eyeY + eyeSize / 2);
    ctx.lineTo(eyeX + eyeSize, eyeY - eyeSize / 2);
    ctx.stroke();
    // 입 (반달 채움)
    ctx.beginPath();
    ctx.arc(0, radius * 0.1, radius * 0.25, 0, Math.PI, false);
    ctx.fillStyle = "#444";
    ctx.fill();
  } else if (face === "worried") {
    // 걱정 (ㅅ 입)
    drawCuteEye(-eyeX, eyeY, eyeSize);
    drawCuteEye(eyeX, eyeY, eyeSize);
    // 눈썹
    ctx.beginPath();
    ctx.moveTo(-eyeX - eyeSize, eyeY - eyeSize * 1.5);
    ctx.lineTo(-eyeX + eyeSize / 2, eyeY - eyeSize * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeX + eyeSize, eyeY - eyeSize * 1.5);
    ctx.lineTo(eyeX - eyeSize / 2, eyeY - eyeSize * 2);
    ctx.stroke();
    // 입 (물결)
    ctx.beginPath();
    ctx.arc(0, radius * 0.4, radius * 0.2, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();
  } else if (face === "happy") {
    // 행복 (^ ^ 눈)
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY + eyeSize / 2, eyeSize, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY + eyeSize / 2, eyeSize, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (face === "confused") {
    // 혼란 (짝짝이 눈)
    drawCuteEye(-eyeX, eyeY, eyeSize * 0.8);
    drawCuteEye(eyeX, eyeY, eyeSize * 1.2);
    // 입 (지그재그)
    ctx.beginPath();
    ctx.moveTo(-radius * 0.1, radius * 0.2);
    ctx.lineTo(radius * 0.2, radius * 0.1);
    ctx.stroke();
  } else if (face === "excited") {
    // 신남 (X X 눈)
    ctx.beginPath();
    ctx.moveTo(-eyeX - eyeSize, eyeY - eyeSize);
    ctx.lineTo(-eyeX + eyeSize, eyeY + eyeSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-eyeX + eyeSize, eyeY - eyeSize);
    ctx.lineTo(-eyeX - eyeSize, eyeY + eyeSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(eyeX - eyeSize, eyeY - eyeSize);
    ctx.lineTo(eyeX + eyeSize, eyeY + eyeSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeX + eyeSize, eyeY - eyeSize);
    ctx.lineTo(eyeX - eyeSize, eyeY + eyeSize);
    ctx.stroke();

    // 입 (D 모양)
    ctx.beginPath();
    ctx.arc(0, radius * 0.1, radius * 0.25, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = "#444";
    ctx.fill();
  } else if (face === "big_smile") {
    // 왕 스마일
    drawCuteEye(-eyeX, eyeY, eyeSize * 1.2);
    drawCuteEye(eyeX, eyeY, eyeSize * 1.2);
    // 입 (큰 D)
    ctx.beginPath();
    ctx.arc(0, radius * 0.1, radius * 0.3, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = "#444";
    ctx.fill();
    // 혀
    ctx.beginPath();
    ctx.arc(0, radius * 0.3, radius * 0.15, Math.PI, 0);
    ctx.fillStyle = "#ff6b6b";
    ctx.fill();
  }
}

// 17. 화면 크기에 맞춰 게임 스케일 조절 (반응형)
function resizeGame() {
  const gameContainer = document.querySelector(".game-container");

  // 게임 컨테이너의 기본 크기 (캔버스 480x700 + 패딩/헤더 고려)
  const baseWidth = 520; // 480 + 40(padding)
  const baseHeight = 850; // 700 + 150(header + padding)

  // 화면 크기
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 스케일 계산 (너비만 맞춰서 모바일 대응, 높이는 스크롤 허용)
  let scale = (windowWidth - 20) / baseWidth;

  // 최대 1배까지만 확대 (깨짐 방지), 화면이 작으면 축소
  if (scale > 1) scale = 1;

  gameContainer.style.transform = `scale(${scale})`;
  gameContainer.style.transformOrigin = "top center";
}

window.addEventListener("resize", resizeGame);
window.addEventListener("orientationchange", resizeGame); // 화면 회전 감지 추가
// 초기 실행 (레이아웃 안정화 후 실행)
setTimeout(resizeGame, 0);

// 18. 동적 파비콘 및 공유 이미지 설정
function setDynamicImages() {
  // 1. 파비콘 설정 (탭 아이콘)
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // 수박 데이터 가져오기 (FRUITS 배열의 마지막)
  const watermelon = FRUITS[FRUITS.length - 1];

  // 캔버스 중앙으로 이동
  ctx.translate(32, 32);

  // 수박 그리기 (반지름 26 정도로 설정)
  drawFruitDecoration(ctx, 26, watermelon, watermelon.face);

  // 기존 파비콘 링크를 찾아서 교체하거나 새로 생성
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL();

  // 2. OG 이미지 설정 (공유 미리보기)
  // 주의: 카카오톡 등 봇은 JS를 실행하지 않아 기본 이미지가 뜰 수 있습니다.
  const ogCanvas = document.createElement("canvas");
  ogCanvas.width = 512;
  ogCanvas.height = 512;
  const ogCtx = ogCanvas.getContext("2d");

  ogCtx.translate(256, 256);
  drawFruitDecoration(ogCtx, 200, watermelon, watermelon.face); // 반지름 200으로 크게 그리기

  const ogImage = document.querySelector("meta[property='og:image']");
  if (ogImage) {
    ogImage.content = ogCanvas.toDataURL();
  }
}

// 설정 실행
setDynamicImages();

// --- UI 효과음 (귀여운 테마) ---
function playUIHoverSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playUIClickSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // 물방울 소리 느낌 (주파수 급강하)
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

document.querySelectorAll("button, input[type='range']").forEach((el) => {
  el.addEventListener("mouseenter", playUIHoverSound);
  el.addEventListener("click", playUIClickSound); // 슬라이더는 클릭 시에도 소리 발생
});

// --- 뒤로 가기 버튼 기능 ---
const backBtnStart = document.getElementById("back-btn-start");
const backBtnIngame = document.getElementById("back-btn-ingame");

if (backBtnStart) {
  backBtnStart.addEventListener(
    "click",
    () => (window.location.href = "../game-list.html"),
  );
}
if (backBtnIngame) {
  backBtnIngame.addEventListener(
    "click",
    () => (window.location.href = "../game-list.html"),
  );
}

// --- 게임 방법 모달 기능 ---
const howtoBtn = document.getElementById("howto-btn");
const howtoModal = document.getElementById("howto-modal");
const closeHowtoBtn = document.getElementById("close-howto-btn");

if (howtoBtn && howtoModal) {
  howtoBtn.addEventListener("click", () =>
    howtoModal.classList.remove("hidden"),
  );
}

if (closeHowtoBtn && howtoModal) {
  closeHowtoBtn.addEventListener("click", () =>
    howtoModal.classList.add("hidden"),
  );
}
