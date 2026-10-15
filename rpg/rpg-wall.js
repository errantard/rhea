/* ═══════════════════════════════════════════════════════════════
   RheaOps · 모험가(RPG) 모듈 — 미니게임 2 "캐슬 디펜스" (23차, 2026-10-15 · v222 지팡이 = 느리고 한 방, 옛 이름 성벽 수비대)
   세로 9:16 디펜스. 오른쪽 = 우리 성벽(사다리 2개) · 왼쪽 = 하늘·들판에서 몬스터가 몰려옴
   - 원거리 무기(지팡이·슬링샷·석궁·장궁) = 화면 어디든 눌러서 한 마리 (탑 위에서 날아감)
   - 근접 무기(칼·창·몽둥이·룬마검) = 사다리 꼭대기 / 성벽 아래(오크 대장) 판정 원 안의 적을 여러 마리 한 번에
   - 사다리 꼭대기에 닿으면 ❗ 1.5초 → 못 막으면 성벽 내구도 −1 · 박쥐가 성벽에 닿으면 −1 · 오크 대장이 성벽을 찍으면 −2
   - 1파(0~15초) 고블린·박쥐 / 2파(15~30초) 해골 추가 / 3파(30초~) 오크 대장 → 대장 처치 = 승리, 내구도 0 = 실패
   - v216 바위 병사: 처치·콤보로 게이지 = 병사가 바위를 들고 오른쪽 아래 길 → 계단 → 성벽 위로 걸어옴(멀어질수록 작아짐)
     도착하면 [🪨 바위 투척] 버튼 (PC는 마우스 오른쪽도) → 적이 제일 많은 사다리로 던져 사다리 따라 굴러떨어짐 + 바닥 쿵(범위) · 한 판 2번
   - v216 PC(가로 화면): 넓은 배경(왼쪽 숲 ~ 오른쪽 성) 위 가운데 세로판. 몬스터는 왼쪽 숲에서 미리 걸어 나옴(판 안에 들어오는 시간은 폰과 같음)
     누르기 판정은 가운데 판 안만. 세로판 배경 = 넓은 배경의 가운데를 잘라낸 것(x 950, 배율 .5575)이라 좌표가 그대로 맞음
   연결: window.RheaWall.open({ current, weaponHtml, weaponName, tier, figHtml, name, title, getDaily, onStart, onEnd(win, score) → {reward, best, newBest}, onReset, onClose })
   좌표는 세로판 배경 그림 픽셀(1536×2752) 기준 → 화면에선 비율로 (판 밖 = 음수·1536 넘는 값). 밸런스는 W_CFG 한 곳에서
   이펙트는 rpg-pangpang.css 의 .pp-* (던전팡팡과 같은 모양) 재사용
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const BW = 1536, BH = 2752; // 배경 그림 크기
    const W_CFG = {
        hp: 5, warnMs: 1500, boss: 30, // 3파(대장) 시작 초
        waves: [ // [시작 초, 나오는 간격(초), 고블린·해골·박쥐 비율]
            { t: 0, gap: 1.55, mix: { g: .72, s: 0, b: .28 } },
            { t: 15, gap: 1.2, mix: { g: .45, s: .3, b: .25 } },
            { t: 30, gap: 1.7, mix: { g: .45, s: .3, b: .25 } }
        ],
        // v215 (대장님): 체력 100 기준 — 근접 한 방 100 · 원거리 한 발 50(v218, 고블린 2방) (+ 쏘는 간격 등급별 1초/0.8초/0.5초)
        hpOf: { g: 100, s: 150, b: 60, o: 500 },
        score: { g: 100, s: 150, b: 80, o: 2000 },
        walk: { g: [3.4, 4.2], s: [4.6, 5.6] }, // 사다리 아래까지 걷는 시간(초) [가까운, 먼]
        climb: { g: [3.4, 4.2], s: [4.0, 4.9] }, // 사다리 오르는 시간
        bat: 3.6, orcWalk: 10, orcHit: 4, orcDmg: 2,
        meleeDmg: 100, rangedDmg: 50, // v218: 원거리(활 계열) = 고블린 2방
        staffDmg: 100, staffCd: { novice: 1200, common: 1000, rare: 800, master: 600 }, // v222 (대장님): 지팡이 계열 = 한 방에 고블린, 대신 느림
        rangedCd: { novice: 600, common: 500, rare: 400, master: 300 }, meleeCd: 300, // 쏘는/휘두르는 간격(ms) — v221 (대장님): 원거리 0.6 · 0.5 · 0.4초 (마스터 0.3)
        meleeMul: { novice: 1, common: 1.15, rare: 1.3, master: 1.5 }, // 근접 등급별 대미지 배수 (원거리는 간격으로 차이)
        gaugeKill: 9, gaugeCombo: 2, rockMax: 2, rockDmg: 300, rockAoe: 330, // 바위: 한 판 2번 · 대미지 · 바닥 쿵 반지름
        solSpeed: .2, // 병사 걷는 빠르기 (길 전체 = 1, 초당)
        pre: 4.5 // PC: 몬스터가 왼쪽 숲에서 판까지 미리 걷는 시간(초)
    };
    // v216 바위 병사 길 (세로판 좌표 [x, 발 y, 키]) — 넓은 배경의 오른쪽 아래 길 → 계단 아래 → 계단 위 → 성벽 위 탑 앞 (두 번째 사다리 꼭대기 오른쪽)
    // v218 (대장님): 끝 = 두 번째(오른쪽) 사다리 옆 탑 앞 돌 위. 탑 뒤로 돌아가기·탑 가림 조각 없앰
    const SOL_PATH = [[2726, 2866, 640], [2332, 2113, 560], [1964, 1844, 470], [1790, 1262, 390], [1345, 1045, 360]];
    const SOL_IN = 3; // v219: 계단 위 → 탑 앞 돌 위 구간 = 성 안으로 들어갔다 나오는 것처럼 사라졌다 나타남 (벽 위를 걷는 것처럼 안 보이게) · 키는 고블린(300)보다 크게
    const SOL_STAIR = 2; // 이 구간(계단)은 발을 크게 들썩
    // 사다리 (배경 픽셀): bot = 땅에 닿은 곳, top = 꼭대기, sc = 그 사다리 몬스터 크기, zr = 근접 판정 반지름
    const LADDERS = [
        { bot: [612, 2205], top: [828, 1300], sc: .78, zr: 220, far: 1 }, // v215: 근접 판정 25% 넓힘
        { bot: [792, 2688], top: [1180, 1065], sc: 1, zr: 255, far: 0 }
    ];
    const ORC_AT = [905, 2470], ORC_ZR = 320; // 오크 대장이 멈춰서 성벽 찍는 곳 · 근접 판정
    const SHOOT = [1010, 1185]; // 원거리 무기가 있는 곳 — v218: 두 사다리 사이 성벽 위 (예전 1455,1290 은 탑 벽에 붙어 보여 어색)
    const RANGED = {
        wood_staff: { k: 'magic', c: '#7CE05A', c2: '#E8FFD0', lv: 'sm' }, magic_wand: { k: 'magic', c: '#4FB2FF', c2: '#E2F4FF', lv: 'md' },
        gem_staff: { k: 'magic', c: '#B266FF', c2: '#F6E6FF', spark: 3 }, slingshot: { k: 'stone', c: '#9A8E84' },
        crossbow: { k: 'bolt', c: '#C9D3DC' }, longbow: { k: 'arrow', c: '#E8D6B0' }
    };
    const MELEE = { wood_sword: 'blade', wood_blade: 'blade', longsword: 'blade', katana: 'blade', hwando: 'blade', greatsword: 'blade', guandao: 'blade', master_sword: 'blade',
        bamboo_spear: 'spear', glaive: 'spear', club: 'blunt' };
    const TIER_FX = { novice: { c: '#EFE2C6', c2: '#A88A62', lv0: true }, common: { c: '#FFF2D6', c2: '#C9A06A' }, rare: { c: '#FFFFFF', c2: '#B8D2F2', glint: true }, master: { c: '#FFE6D6', c2: '#FF5A3A', glint: true, trail: true } };
    const ARC_SVG = '<svg viewBox="-50 -50 100 100"><path d="M-46 14 Q0 -52 46 14 Q0 -30 -46 14Z" fill="var(--c2)" opacity=".55"/><path d="M-42 12 Q0 -44 42 12 Q0 -32 -42 12Z" fill="var(--c)"/></svg>';
    const SHOT_SVG = {
        stone: '<svg viewBox="-10 -10 20 20"><ellipse cx="0" cy="0" rx="8" ry="6.5" fill="#8A7E74" stroke="#2A2420" stroke-width="1.6"/><ellipse cx="-2.5" cy="-2.2" rx="3" ry="2" fill="#C8BCB0" opacity=".7"/></svg>',
        bolt: '<svg viewBox="-30 -6 60 12"><path d="M-28 0H18" stroke="#5A3A20" stroke-width="2.6"/><path d="M-28 -4L-20 0-28 4" fill="#8A9AA8" stroke="#2A3440" stroke-width="1"/><path d="M16 -4.5L28 0 16 4.5Z" fill="#DDE6EE" stroke="#2A3440" stroke-width="1.2"/></svg>',
        arrow: '<svg viewBox="-40 -7 80 14"><path d="M-38 0H26" stroke="#A8783E" stroke-width="2.2"/><path d="M-38 -5L-28 0-38 5M-32 -5L-22 0-32 5" fill="none" stroke="#E8E2D2" stroke-width="2"/><path d="M24 -5L38 0 24 5 27 0Z" fill="#CFD8E0" stroke="#2A3440" stroke-width="1.2"/></svg>'
    };
    const BURST = '<svg viewBox="-50 -50 100 100"><g fill="#FFF4D0"><path d="M0-46L7-9 46 0 7 9 0 46-7 9-46 0-7-9z"/></g><g fill="#FFB84A" opacity=".9"><path d="M-30-30L-4-4-30 30-1 6 30 30 4 4 30-30 1-6z" transform="scale(.8)"/></g><circle r="10" fill="#fff"/></svg>';
    const IMG = (() => { const s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, '') + 'img/' : 'rpg/img/'; })();
    const SPR = { g: 'wall_gob', gc: 'wall_gob_c', s: 'wall_skel', sc: 'wall_skel_c', b: 'wall_bat', o: 'wall_orc' };
    // 몬스터 그림 크기 (배경 픽셀 기준 높이) · 그림 가로세로 비율
    const SIZE = { g: 300, gc: 310, s: 320, sc: 330, b: 190, o: 680 };
    const RATIO = { g: 224 / 320, gc: 228 / 320, s: 248 / 320, sc: 198 / 320, b: 320 / 212, o: 310 / 320, sol: 309 / 340, rock: 161 / 150 };
    const PHONE = '(orientation: portrait) and (max-width: 820px)'; // 이 화면이면 세로판만 (CSS 와 같은 기준)
    const isWide = () => !(window.matchMedia && matchMedia(PHONE).matches);

    let opts = {}, root, stage, world, layer, fx, els = {}, G = null, raf = 0, timers = [];
    function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
    function clearAll() { cancelAnimationFrame(raf); raf = 0; timers.forEach(clearTimeout); timers = []; }
    const lerp = (a, b, t) => a + (b - a) * t;
    const pct = (x, y) => `left:${(x / BW * 100).toFixed(3)}%;top:${(y / BH * 100).toFixed(3)}%`;

    function build() {
        root = document.createElement('div');
        root.className = 'sw-dim';
        root.innerHTML = `<div class="sw-wide"><div class="sw-back"><img class="sw-wbg" alt="" draggable="false"></div><div class="sw-stage">
            <div class="sw-world"><img class="sw-bg" alt="" draggable="false">
                <div class="sw-zones"></div><div class="sw-layer"></div>
                <div class="sw-sol"><img class="sw-rk" src="${IMG}wall_rock.webp" alt="" draggable="false"><img class="sw-sp" src="${IMG}wall_soldier.webp" alt="" draggable="false"></div>
                <div class="sw-rw"></div><div class="sw-fx"></div></div>
            <div class="sw-hud">
                <div class="sw-por"><div class="sw-fw"></div></div><div class="sw-wslot"></div>
                <div class="sw-nm"><b></b><small></small></div>
                <div class="sw-hp"><span>성벽 내구도</span><div class="sw-hearts"></div></div>
                <div class="sw-wave"><span class="sw-wl">1파</span><div class="sw-pips"><i></i><i></i><i></i></div></div>
                <button class="sw-balbtn" type="button"><i class="sw-bg2"><i></i></i><span>🪨 바위 투척</span><b class="sw-baln"></b></button>
                <div class="sw-sc"><small>점수</small><b class="sw-score">0</b><small class="sw-best"></small></div>
                <div class="sw-boss"><span>오크 대장</span><div class="sw-bbar"><i></i></div></div>
            </div>
            <div class="sw-combo"></div><div class="sw-banner"></div>
            <div class="sw-aim"></div>
            <div class="sw-panel"></div>
            <button class="sw-x" type="button" aria-label="닫기"></button><button class="sw-reset" type="button" title="마스터 테스트용: 오늘 기록 지우기">↺ 게임 초기화</button>
        </div></div>`;
        document.body.appendChild(root);
        stage = root.querySelector('.sw-stage'); world = root.querySelector('.sw-world');
        layer = root.querySelector('.sw-layer'); fx = root.querySelector('.sw-fx');
        els = { zones: root.querySelector('.sw-zones'), sol: root.querySelector('.sw-sol'), balbtn: root.querySelector('.sw-balbtn'), gauge: root.querySelector('.sw-bg2 i'), baln: root.querySelector('.sw-baln'),
            rw: root.querySelector('.sw-rw'), hearts: root.querySelector('.sw-hearts'), wl: root.querySelector('.sw-wl'), pips: [...root.querySelectorAll('.sw-pips i')],
            score: root.querySelector('.sw-score'), best: root.querySelector('.sw-best'), boss: root.querySelector('.sw-boss'), bbar: root.querySelector('.sw-bbar i'),
            combo: root.querySelector('.sw-combo'), banner: root.querySelector('.sw-banner'), aim: root.querySelector('.sw-aim'), panel: root.querySelector('.sw-panel'),
            bg: root.querySelector('.sw-bg'), wbg: root.querySelector('.sw-wbg') };
        els.rw.style.cssText = pct(SHOOT[0], SHOOT[1]);
        els.zones.innerHTML = LADDERS.map((L, i) => `<i class="sw-zone" data-z="${i}" style="${pct(L.top[0], L.top[1])};width:${(L.zr * 2 / BW * 100).toFixed(2)}%"></i>`).join('') +
            `<i class="sw-zone o" data-z="o" style="${pct(ORC_AT[0], ORC_AT[1] - 200)};width:${(ORC_ZR * 2 / BW * 100).toFixed(2)}%"></i>`;
        root.querySelector('.sw-x').addEventListener('click', close);
        els.balbtn.addEventListener('click', (e) => { e.stopPropagation(); throwRock(); });
        root.querySelector('.sw-reset').addEventListener('click', async () => {
            if (!opts.onReset || (G && G.on)) return;
            if (!confirm('오늘 캐슬 디펜스 기록(남은 도전·정복)을 지울까요? (마스터 테스트용, 최고 점수는 남김)')) return;
            await opts.onReset(); showIntro();
        });
        root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
        if (window.matchMedia) { const mq = matchMedia(PHONE); const f = () => setMode(); mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f); }
        stage.addEventListener('pointermove', (e) => { if (G && G.on && G.ranged) aimAt(e.clientX, e.clientY); });
        stage.addEventListener('pointerdown', onPointer);
        root.addEventListener('contextmenu', (e) => e.preventDefault()); // 오른쪽 메뉴·폰 길게 누르기 메뉴 막기
        document.addEventListener('keydown', (e) => { if (root.classList.contains('open') && e.key === 'Escape') close(); });
    }

    // v216: PC(넓은 배경) ↔ 폰 세로(세로판 배경) — 필요한 배경만 불러옴
    function setMode() {
        if (!root) return;
        const wide = isWide();
        root.classList.toggle('is-wide', wide);
        const want = wide ? els.wbg : els.bg, src = IMG + (wide ? 'wall_bg_wide.webp' : 'wall_bg.webp');
        if (want.getAttribute('src') !== src) want.setAttribute('src', src);
    }
    // ── 좌표: 화면 → 배경 픽셀 ──
    function toBG(cx, cy) { const r = world.getBoundingClientRect(); return [(cx - r.left) / r.width * BW, (cy - r.top) / r.height * BH]; }
    function aimAt(cx, cy) {
        const s = stage.getBoundingClientRect();
        els.aim.style.left = (cx - s.left) + 'px'; els.aim.style.top = (cy - s.top) + 'px';
        const [x, y] = toBG(cx, cy), a = Math.atan2(y - SHOOT[1], x - SHOOT[0]) * 180 / Math.PI;
        els.rw.style.setProperty('--aim', (a + 45) + 'deg');
    }

    // ── 몬스터 ──
    function spawn(type) {
        const e = { type, hp: W_CFG.hpOf[type], t: -G.pre, id: ++G.uid, warn: 0 }; // PC: t<0 = 왼쪽 숲에서 미리 걷는 중
        if (type === 'b') {
            e.y0 = 620 + Math.random() * 900; e.y1 = 960 + Math.random() * 380; e.dur = W_CFG.bat * (.85 + Math.random() * .3); e.ph = Math.random() * 6;
        } else if (type === 'o') {
            e.dur = W_CFG.orcWalk; e.y0 = 2470;
        } else {
            e.L = Math.random() < .5 ? 0 : 1;
            const L = LADDERS[e.L];
            e.y0 = L.bot[1] - 40 - Math.random() * 60; e.x0 = -140;
            e.walk = W_CFG.walk[type][L.far] * (.9 + Math.random() * .2);
            e.climb = W_CFG.climb[type][L.far] * (.9 + Math.random() * .2);
            e.stage = 'walk';
        }
        e.el = document.createElement('div');
        e.el.className = 'sw-mon m-' + type;
        e.el.innerHTML = `<img src="${IMG}${SPR[type]}.webp" alt="" draggable="false"><i class="sw-warn">!</i>`;
        layer.appendChild(e.el);
        G.mons.push(e);
        place(e);
        return e;
    }
    function setSprite(e, key) { if (e.spr === key) return; e.spr = key; e.el.querySelector('img').src = IMG + SPR[key] + '.webp'; }
    // 위치 계산 + 그리기. e.x, e.y = 발(아래 가운데) 위치 · e.sc = 크기
    function place(e) {
        let x, y, sc = 1, key = e.type, rot = 0, flip = false, bob = 0;
        if (e.type === 'b') {
            const t = e.t / e.dur; x = lerp(-150, 1120, t); y = lerp(e.y0, e.y1, t) + Math.sin(e.t * 5 + e.ph) * 50; sc = .8 + t * .25;
            bob = Math.sin(e.t * 22) * .28; // 날갯짓 (세로로 눌렀다 폈다)
        } else if (e.type === 'o') {
            const t = Math.min(1, e.t / e.dur); x = lerp(-260, ORC_AT[0], t); y = ORC_AT[1]; sc = 1;
            if (t < 1) { const st = (e.t * 1.6) % 1; bob = st < .5 ? -Math.sin(st * 2 * Math.PI) * 18 : 0; rot = Math.sin(e.t * 1.6 * Math.PI) * 2.5; }
            e.arrived = t >= 1;
        } else {
            const L = LADDERS[e.L];
            if (e.stage === 'walk') {
                const t = Math.min(1, e.t / e.walk); x = lerp(e.x0, L.bot[0] - 30, t); y = lerp(e.y0, L.bot[1], t);
                sc = L.sc * lerp(.92, 1, t); rot = Math.sin(e.t * 9) * 6; bob = -Math.abs(Math.sin(e.t * 9)) * 10;
                if (t >= 1) { e.stage = 'climb'; e.t0 = e.t; }
            } else {
                const t = Math.min(1, (e.t - e.t0) / e.climb); const step = Math.floor(t * 9);
                const tt = Math.min(1, (step + Math.min(1, (t * 9 - step) * 2.2)) / 9); // 툭툭 한 칸씩
                x = lerp(L.bot[0] - 20, L.top[0] - 30, tt); y = lerp(L.bot[1] + 10, L.top[1] + 95 * L.sc, tt); sc = L.sc;
                flip = step % 2 === 1; key = e.type + 'c';
                if (t >= 1 && e.stage === 'climb') { e.stage = 'top'; e.warn = G.now + W_CFG.warnMs; e.el.classList.add('warn'); }
                if (e.stage === 'top') { rot = Math.sin(G.now / 40) * 3; }
            }
        }
        setSprite(e, key);
        e.x = x; e.y = y; e.sc = sc;
        const h = SIZE[key] * sc, w = h * RATIO[key];
        const fade = G.pre ? Math.min(1, (e.t + G.pre) / .6) : 1; // 숲에서 스르륵 나타남
        e.el.style.cssText = `${pct(x, y)}${fade < 1 ? ';opacity:' + fade.toFixed(2) : ''};width:${(w / BW * 100).toFixed(3)}%;--h:${(h / BW * 100).toFixed(3)}cqw;transform:translate(-50%,-100%) translateY(${(bob / BW * 100).toFixed(3)}cqw) rotate(${rot}deg) scale(${flip ? -1 : 1},${e.type === 'b' ? 1 - Math.abs(bob) : 1});z-index:${Math.round(y)}`;
        e.cx = x; e.cy = y - h * .5; e.r = Math.max(w, h) * .55; // 맞는 판정 원
    }
    function removeMon(e) { e.dead = true; e.el.remove(); G.mons = G.mons.filter(m => m !== e); }

    // ── 공격 ──
    function onPointer(e) {
        if (!G || !G.on) return;
        const [x, y] = toBG(e.clientX, e.clientY);
        if (e.target.closest && e.target.closest('.sw-balbtn')) return;
        if (e.button === 2) { throwRock(); return; } // v217: PC 마우스 오른쪽 = 바위 투척 (병사 누르기로는 안 던짐)
        if (x < 0 || x > BW) return; // PC: 가운데 판 밖(숲·성 안쪽)은 누르기 판정 없음
        if (G.ranged) aimAt(e.clientX, e.clientY);
        const now = performance.now();
        if (now < G.cd) return;
        if (G.ranged) { const cd = shotCd(G.wpn, G.tier); G.cd = now + cd; shootAt(x, y); coolDown(cd); }
        else { G.cd = now + W_CFG.meleeCd; meleeAt(x, y); }
    }
    function nearest(x, y, maxR) {
        let best = null, bd = 1e9;
        G.mons.forEach(m => { if (m.dead) return; const d = Math.hypot(m.cx - x, m.cy - y) - m.r; if (d < bd) { bd = d; best = m; } });
        return bd <= maxR ? best : null;
    }
    function hit(m, dmg, how) {
        if (!m || m.dead) return;
        m.hp -= dmg;
        m.el.classList.remove('hurt'); void m.el.offsetWidth; m.el.classList.add('hurt');
        if (m.type === 'o') renderBoss();
        if (m.hp > 0) popAt(m.cx, m.cy - 60, '-' + Math.round(dmg), 'pp-pop sw-dmg');
        if (m.hp > 0) return;
        kill(m, how);
    }
    function kill(m, how) {
        const now = G.now;
        G.combo = now - G.lastKill < 1600 ? G.combo + 1 : 1; G.lastKill = now; G.kills++;
        const pts = Math.round(W_CFG.score[m.type] * (1 + Math.min(G.combo, 20) * .05));
        G.score += pts; renderScore();
        addGauge(W_CFG.gaugeKill + (G.combo >= 3 ? W_CFG.gaugeCombo * Math.min(G.combo, 10) : 0));
        burstAt(m.cx, m.cy, m.type === 'o');
        popAt(m.cx, m.cy - 40, '+' + pts, 'pp-pop' + (m.type === 'o' ? ' big' : ''));
        if (G.combo >= 3) { els.combo.innerHTML = `COMBO ×${G.combo}`; els.combo.classList.remove('show'); void els.combo.offsetWidth; els.combo.classList.add('show'); }
        m.el.classList.add('die'); m.dead = true; G.mons = G.mons.filter(x => x !== m);
        later(() => m.el.remove(), 420);
        if (m.type === 'o') win();
    }

    // 원거리 쏘는 간격: 지팡이 계열(마법)은 느리고 세게 · 활 계열(슬링샷·석궁·장궁)은 빠르고 약하게
    function shotCd(wpn, tier) { const t = (RANGED[wpn] || {}).k === 'magic' ? W_CFG.staffCd : W_CFG.rangedCd; return t[tier] || t.novice; }
    function shootAt(x, y) {
        const cfg = RANGED[G.wpn] || RANGED.longbow, target = nearest(x, y, 70);
        const tx = target ? target.cx : x, ty = target ? target.cy : y;
        const dmg = cfg.k === 'magic' ? W_CFG.staffDmg : W_CFG.rangedDmg; // 지팡이 = 한 방 셈 · 활 계열 = 빠르고 약함
        els.rw.classList.remove('fire'); void els.rw.offsetWidth; els.rw.classList.add('fire');
        projectile(SHOOT[0] - 40, SHOOT[1] - 40, tx, ty, cfg, () => {
            impact(tx, ty, cfg);
            if (target && !target.dead) hit(target, dmg, 'r');
        });
    }
    function meleeAt(x, y) {
        // 판정 원: 사다리 꼭대기 2개 + (대장이 도착했으면) 성벽 아래
        const zones = LADDERS.map((L, i) => ({ x: L.top[0], y: L.top[1] + 40, r: L.zr, i }));
        const orc = G.mons.find(m => m.type === 'o' && m.arrived && !m.dead);
        if (orc) zones.push({ x: ORC_AT[0], y: ORC_AT[1] - 200, r: ORC_ZR, i: 'o' });
        const z = zones.find(z => Math.hypot(x - z.x, y - z.y) <= z.r * 1.15);
        if (!z) { meleeFx(x, y, false); return; }
        const tgt = G.mons.filter(m => !m.dead && Math.hypot(m.cx - z.x, m.cy - z.y) <= z.r + m.r * .6);
        meleeFx(z.x, z.y, tgt.length > 0);
        swingWeapon(z.x, z.y);
        tgt.forEach(m => hit(m, W_CFG.meleeDmg * (W_CFG.meleeMul[G.tier] || 1), 'm'));
        if (tgt.length) { stage.classList.remove('thud'); void stage.offsetWidth; stage.classList.add('thud'); }
    }
    // ── v216 바위 병사 ── 게이지(0~100) = 병사가 갈 곳. 병사는 그쪽으로 걸어감(solSpeed) · 끝까지 오면 투척 준비
    const SOL_LEN = (() => { const d = [0]; for (let i = 1; i < SOL_PATH.length; i++) { const [a, b] = [SOL_PATH[i - 1], SOL_PATH[i]]; d.push(d[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return d.map(v => v / d[d.length - 1]); })();
    function solAt(p) { // 길 위치 p(0~1) → [x, 발 y, 키, 구간]
        let i = 1; while (i < SOL_LEN.length - 1 && p > SOL_LEN[i]) i++;
        const a = SOL_PATH[i - 1], b = SOL_PATH[i], t = Math.max(0, Math.min(1, (p - SOL_LEN[i - 1]) / (SOL_LEN[i] - SOL_LEN[i - 1] || 1)));
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), i - 1, t];
    }
    function addGauge(v) { if (G.rockUsed >= W_CFG.rockMax || G.throwing) return; G.gauge = Math.min(100, G.gauge + v); renderBal(); }
    function solTick(dt) {
        const S = G.sol; if (S.gone) return;
        const goal = G.gauge / 100, mv = Math.min(Math.abs(goal - S.p), W_CFG.solSpeed * dt);
        S.p += Math.sign(goal - S.p) * mv; S.walk = mv > 0 ? S.walk + dt : 0;
        drawSol(); if (mv > 0) els.gauge.style.transform = `scaleX(${S.p})`;
        const ready = S.p >= .999 && G.gauge >= 100 && !G.throwing && G.rockUsed < W_CFG.rockMax;
        if (ready !== S.ready) { S.ready = ready; els.sol.classList.toggle('ready', ready); renderBal(); if (ready) banner('🪨 바위 준비 완료!'); }
    }
    function drawSol() {
        const S = G.sol, [x, y, h, seg, st] = solAt(S.p), stair = seg === SOL_STAIR;
        const fo = seg === SOL_IN ? Math.max(0, Math.abs(st - .5) * 2 - .6) / .4 : 1; // 들어갈 때 흐려지고 나올 때 나타남
        const ph = S.walk * (stair ? 6 : 7.5), bob = S.walk ? -Math.abs(Math.sin(ph)) * (stair ? 26 : 12) * h / 300 : Math.sin(G.now / 380) * 2;
        const rot = S.walk ? Math.sin(ph) * 3 : 0, w = h * RATIO.sol;
        S.x = x; S.y = y; S.h = h; S.w = w;
        els.sol.style.cssText = `${pct(x, y)};width:${(w / BW * 100).toFixed(3)}%;transform:translate(-50%,-100%) translateY(${(bob / BW * 100).toFixed(3)}cqw) rotate(${rot.toFixed(2)}deg);--fo:${fo.toFixed(2)}`;
    }
    // 바위 들고 있는 곳 (가운데) — CSS .sw-rk 와 같은 비율 (폭 80%, 바닥이 키의 90% 높이)
    function rockHeld() { const S = G.sol, rw = S.w * .8, rh = rw / RATIO.rock; return [S.x, S.y - S.h * .9 - rh * .5, rh]; }
    function throwRock() {
        if (!G || !G.on || !G.sol.ready || G.throwing) return;
        G.throwing = true; G.rockUsed++; G.gauge = 0; G.sol.ready = false; els.sol.classList.remove('ready'); renderBal();
        // 적이 제일 많은 사다리 (꼭대기 3 · 오르는 중 2 · 그 사다리로 걸어오는 중 1 · 오크 대장은 가까운 사다리 +4)
        const sc = LADDERS.map((L, i) => G.mons.reduce((s, m) => s + (m.dead ? 0 : m.L === i ? (m.stage === 'top' ? 3 : m.stage === 'climb' ? 2 : m.t > 0 ? 1 : 0) : (m.type === 'o' && i === 1 && m.t > 0 ? 4 : 0)), 0));
        const li = sc[1] >= sc[0] ? 1 : 0, L = LADDERS[li];
        const [hx, hy, rh0] = rockHeld();
        els.sol.classList.add('throw');
        const r = document.createElement('div'); r.className = 'sw-rock'; r.innerHTML = `<img src="${IMG}wall_rock.webp" alt="" draggable="false">`; fx.appendChild(r);
        const ax = L.top[0] + 10, ay = L.top[1] - 140, bx = L.bot[0] - 10, by = L.bot[1] - 70, rh1 = 210 * L.sc;
        const hitSet = new Set(), t0 = performance.now(), TA = 420, TB = 620;
        const hitNear = (x, y, R) => G.mons.slice().forEach(m => { if (m.dead || hitSet.has(m) || m.t < 0) return; if (Math.hypot(m.cx - x, m.cy - y) <= R + m.r * .5) { hitSet.add(m); hit(m, W_CFG.rockDmg, 'k'); } });
        const step = (ts) => {
            if (!G || !G.on) { r.remove(); return; }
            const e = ts - t0; let x, y, h, rot;
            if (e < TA) { const t = e / TA; x = lerp(hx, ax, t); y = lerp(hy, ay, t) - Math.sin(t * Math.PI) * 220; h = lerp(rh0, rh1, t); rot = t * 120; } // 머리 위 → 사다리 꼭대기 위로 휙
            else { const t = Math.min(1, (e - TA) / TB), tt = t * t; x = lerp(ax, bx, tt) + Math.sin(tt * Math.PI * 3) * 14; y = lerp(ay, by, tt); h = rh1 * (1 + tt * .12); rot = 120 + tt * 520; hitNear(x, y, 130); } // 사다리 따라 우당탕
            r.style.cssText = `${pct(x, y)};width:${(h * RATIO.rock / BW * 100).toFixed(3)}%;transform:translate(-50%,-50%) rotate(${rot.toFixed(1)}deg);z-index:${Math.round(y)}`;
            if (e < TA + TB) { requestAnimationFrame(step); return; }
            // 바닥 쿵 — 둘레 적 전부 + 흙먼지
            hitNear(bx, by, W_CFG.rockAoe);
            fxEl('sw-quake', bx, by + 40, '', '', 700); burstAt(bx, by, true);
            stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
            r.classList.add('land'); setTimeout(() => r.remove(), 650);
        };
        requestAnimationFrame(step);
        banner('바위 투척!');
        // 병사: 던지고 → 사라졌다가 → (남았으면) 길 처음에서 새 바위 들고 다시
        later(() => els.sol.classList.add('gone'), 500);
        later(() => { if (!G) return; els.sol.classList.remove('throw', 'gone'); G.throwing = false; G.sol.p = 0; G.sol.walk = 0;
            G.sol.gone = G.rockUsed >= W_CFG.rockMax; els.sol.classList.toggle('spent', G.sol.gone); renderBal(); }, 1400);
    }

    // ── 이펙트 (던전팡팡 .pp-* 재사용) ──
    function fxEl(cls, x, y, css, html, ms) {
        const e = document.createElement('div'); e.className = cls; e.style.cssText = pct(x, y) + ';' + (css || ''); if (html) e.innerHTML = html;
        fx.appendChild(e); setTimeout(() => e.remove(), ms || 700); return e;
    }
    function burstAt(x, y, big) { fxEl('pp-burst' + (big ? ' big' : ''), x, y, '', BURST, 600); }
    function popAt(x, y, txt, cls) { fxEl(cls, x, y, '', txt, 800); }
    function projectile(sx, sy, tx, ty, cfg, done) {
        const d = document.createElement('div'); d.className = 'pp-shot k-' + cfg.k + (cfg.lv ? ' ' + cfg.lv : '');
        d.style.cssText = `${pct(sx, sy)};--c:${cfg.c};--c2:${cfg.c2 || '#fff'}`; d.innerHTML = SHOT_SVG[cfg.k] || ''; fx.appendChild(d);
        if (cfg.k === 'magic') fxEl('pp-muzzle', sx, sy, `--c:${cfg.c}`, '', 400);
        const r = world.getBoundingClientRect(), k = r.width / BW, dx = (tx - sx) * k, dy = (ty - sy) * k;
        const lift = (cfg.k === 'arrow' || cfg.k === 'stone') ? r.width * .06 : 0, ms = cfg.k === 'bolt' ? 120 : cfg.k === 'magic' ? 200 : 190;
        const kf = []; for (let i = 0; i <= 6; i++) { const t = i / 6, ox = dx * t, oy = dy * t - lift * 4 * t * (1 - t), vy = dy - lift * 4 * (1 - 2 * t);
            kf.push({ transform: `translate(${ox}px,${oy}px) rotate(${cfg.k === 'stone' ? t * 540 : Math.atan2(vy, dx) * 180 / Math.PI}deg)` }); }
        const an = d.animate ? d.animate(kf, { duration: ms, fill: 'forwards' }) : null;
        const fin = () => { d.remove(); done(); };
        if (an) an.onfinish = fin; else later(fin, ms);
    }
    function impact(x, y, cfg) {
        fxEl('pp-imp k-' + cfg.k + (cfg.lv ? ' ' + cfg.lv : ''), x, y, `--c:${cfg.c};--c2:${cfg.c2 || '#fff'}`, '', 650);
        if (cfg.spark) for (let i = 0; i < cfg.spark; i++) { const a = i / cfg.spark * Math.PI * 2, R = 4;
            fxEl('pp-spk', x, y, `--c:${cfg.c2};--dx:calc(var(--k) * ${(Math.cos(a) * R).toFixed(2)}cqw);--dy:calc(var(--k) * ${(Math.sin(a) * R).toFixed(2)}cqw)`, '', 700); }
    }
    function meleeFx(x, y, hitAny) {
        const t = G.tfx, kind = MELEE[G.wpn] || 'blade', lv = t.lv0 ? ' lv0' : '';
        const css = `--c:${t.c};--c2:${t.c2}`;
        if (kind === 'blade') { const rot = 34 + Math.random() * 22;
            fxEl('pp-arc' + lv + (hitAny ? '' : ' miss'), x, y, css + `;--rot:${rot}deg`, ARC_SVG, 420);
            if (t.trail) fxEl('pp-arc trail', x, y, css + `;--rot:${rot + 8}deg`, ARC_SVG, 460);
            if (hitAny) fxEl('pp-cut' + lv, x, y, css + `;--rot:${rot - 8}deg`, '', 420);
        } else if (kind === 'spear') { if (hitAny) { fxEl('pp-pierce' + lv, x, y, css, '', 360); if (!t.lv0) fxEl('pp-pflash', x, y, css, '', 300); } }
        else { fxEl('pp-thud' + lv + (hitAny ? '' : ' miss'), x, y, css, '', 520); }
    }
    // 근접: 내 무기가 판정 원 위에 휙 나타나 휘두르고 사라짐
    function swingWeapon(x, y) {
        const w = document.createElement('div'); w.className = 'sw-swing k-' + (MELEE[G.wpn] || 'blade');
        w.style.cssText = pct(x, y); w.innerHTML = opts.weaponHtml || ''; fx.appendChild(w); setTimeout(() => w.remove(), 420);
    }
    function coolDown(ms) { stage.classList.add('cool'); later(() => stage.classList.remove('cool'), ms); els.rw.classList.add('cool'); els.rw.style.setProperty('--cd', ms + 'ms'); clearTimeout(coolDown._t); coolDown._t = later(() => els.rw.classList.remove('cool'), ms); }
    function banner(t) { els.banner.textContent = t; els.banner.classList.remove('show'); void els.banner.offsetWidth; els.banner.classList.add('show'); }

    // ── 화면 갱신 ──
    function renderHearts() { els.hearts.innerHTML = Array.from({ length: W_CFG.hp }, (_, i) => `<i class="${i < G.hp ? '' : 'off'}"></i>`).join(''); }
    function renderScore() { els.score.textContent = G.score.toLocaleString(); }
    function renderBal() { // [🪨 바위 투척] 버튼 — 배경이 병사 걸어온 만큼 차오름
        const S = G.sol, left = W_CFG.rockMax - G.rockUsed, ready = !!S.ready;
        els.gauge.style.transform = `scaleX(${G.throwing ? 0 : S.p})`;
        els.balbtn.classList.toggle('ready', ready); els.balbtn.classList.toggle('spent', left <= 0); els.balbtn.disabled = !ready;
        els.baln.textContent = left > 0 ? `×${left}` : '다 씀';
    }
    function renderBoss() { const o = G.mons.find(m => m.type === 'o'); if (o) els.bbar.style.transform = `scaleX(${Math.max(0, o.hp) / W_CFG.hpOf.o})`; }
    function renderWave() {
        els.wl.textContent = G.wave >= 2 ? '3파 · 오크 대장' : (G.wave + 1) + '파';
        els.pips.forEach((p, i) => p.classList.toggle('on', i <= G.wave));
    }
    function damage(n, x, y) {
        if (!G.on) return;
        G.hp = Math.max(0, G.hp - n); renderHearts();
        stage.classList.remove('hurt'); void stage.offsetWidth; stage.classList.add('hurt');
        if (x != null) fxEl('sw-crack', x, y, '', '', 700);
        if (G.hp <= 0) lose();
    }

    // ── 진행 ──
    function loop(ts) {
        if (!G || !(G.on || G.run)) return;
        const dt = Math.min(.05, (ts - (G.lt || ts)) / 1000); G.lt = ts; G.now = performance.now();
        G.el += dt;
        // 판 시간(G.el) = 파 표시 · 대장 체력바 / 내보내는 시간(sp) = PC는 숲에서 걷는 만큼(pre) 먼저 내보냄 → 판에 들어오는 시간은 폰과 같음
        const sp = G.el + G.pre, sw = W_CFG.waves[G.swave + 1], w = W_CFG.waves[G.wave + 1];
        if (sw && sp >= sw.t) { G.swave++; if (G.swave === 2) spawn('o'); }
        if (w && G.el >= w.t) { G.wave++; renderWave(); banner(G.wave === 2 ? '⚠ 오크 대장 출현!' : (G.wave + 1) + '파'); if (G.wave === 2) { els.boss.classList.add('on'); renderBoss(); } }
        if (G.on) solTick(dt);
        G.next -= dt;
        if (G.next <= 0) {
            const cur = W_CFG.waves[G.swave], r = Math.random();
            const type = r < cur.mix.g ? 'g' : r < cur.mix.g + cur.mix.s ? 's' : 'b';
            spawn(type);
            G.next = cur.gap * (.75 + Math.random() * .5);
        }
        G.mons.slice().forEach(m => {
            if (m.dead) return;
            m.t += dt; place(m);
            if (m.type === 'b' && m.t >= m.dur) { damage(1, m.cx, m.cy); burstAt(m.cx, m.cy); removeMon(m); }
            else if (m.stage === 'top' && G.now >= m.warn) { damage(1, m.cx, m.cy); removeMon(m); }
            else if (m.type === 'o' && m.arrived) {
                if (!m.nextHit) m.nextHit = G.now + 1200;
                if (G.now >= m.nextHit) { m.nextHit = G.now + W_CFG.orcHit * 1000; m.el.classList.remove('smash'); void m.el.offsetWidth; m.el.classList.add('smash'); later(() => { if (!m.dead) damage(W_CFG.orcDmg, ORC_AT[0] + 60, ORC_AT[1] - 260); }, 280); }
            }
        });
        const zs = els.zones.children; // 꼭대기에 적이 올라오면 그 원이 빨갛게 깜빡 · 대장이 도착하면 성벽 아래 원 보임
        LADDERS.forEach((L, i) => zs[i].classList.toggle('alert', G.mons.some(m => m.L === i && m.stage === 'top' && !m.dead)));
        zs[LADDERS.length].classList.toggle('on', G.mons.some(m => m.type === 'o' && m.arrived && !m.dead));
        raf = requestAnimationFrame(loop);
    }

    function daily() { return (opts.getDaily && opts.getDaily()) || { tries: 3, cleared: false, best: 0 }; }
    function triesHtml(d) { return `오늘 남은 도전 ${Array.from({ length: 3 }, (_, i) => `<i class="${i < d.tries ? '' : 'off'}"></i>`).join('')}`; }
    function showIntro() {
        clearAll(); G = null; layer.innerHTML = ''; fx.innerHTML = ''; stage.classList.remove('playing', 'ended');
        els.sol.className = 'sw-sol'; els.sol.style.cssText = '';
        [...els.zones.children].forEach(z => z.classList.remove('alert', 'on'));
        const d = daily(), can = !d.cleared && d.tries > 0;
        els.best.textContent = d.best ? '최고 ' + d.best.toLocaleString() : ''; els.score.textContent = '0';
        els.boss.classList.remove('on');
        els.panel.className = 'sw-panel';
        els.panel.innerHTML = `<div class="sw-title">캐슬 디펜스</div>
            <div class="sw-sub">몰려오는 몬스터로부터 <b>성벽을 지켜라!</b><br>3파에 나타나는 <b>오크 대장</b>을 쓰러뜨리면 승리</div>
            <div class="sw-rules">
                <div><b>${RANGED[opts.current] ? '🏹 원거리 무기' : '⚔ 근접 무기'}</b>${RANGED[opts.current] ? `화면 어디든 눌러 한 마리씩<br>${shotCd(opts.current, opts.tier) / 1000}초마다 한 발${RANGED[opts.current].k === 'magic' ? ' (한 방이 셈)' : ''}` : '사다리 꼭대기 원을 눌러<br>여러 마리 한 번에 한 방'}</div>
                <div><b>❗ 1.5초</b>꼭대기에 올라온 적은<br>1.5초 안에 막아야 해요</div>
                <div><b>🪨 바위 병사</b>처치할수록 바위 든 병사가<br>성벽 위로 와요 · 도착하면 버튼${isWide() ? '·마우스 오른쪽' : ''}으로 투척 (2번)</div>
            </div>
            <div class="sw-tries">${d.cleared ? '✅ 오늘의 성벽은 지켜냈어요! 내일 다시' : triesHtml(d)}</div>
            <div class="sw-btns"><button class="sw-btn" type="button" data-a="go" ${can ? '' : 'disabled'}>🛡 수비 시작</button></div>
            <div class="sw-note">${d.cleared ? '' : d.tries > 0 ? '성공하면 +1P · 하루 3번, 성공하면 그날은 끝' : '오늘 도전 기회를 다 썼어요. 내일 다시!'}</div>`;
        els.panel.querySelector('[data-a="go"]').onclick = start;
    }
    let starting = false;
    async function start() {
        const d = daily();
        if (starting || (G && G.on) || d.cleared || d.tries <= 0) return;
        starting = true;
        const btn = els.panel.querySelector('[data-a="go"]'); if (btn) { btn.disabled = true; btn.textContent = '준비중…'; }
        try { if (opts.onStart) { const ok = await opts.onStart(); if (ok === false) { if (btn) { btn.disabled = false; btn.textContent = '🛡 다시 시도'; } return; } } }
        finally { starting = false; }
        layer.innerHTML = ''; fx.innerHTML = '';
        const tier = opts.tier || 'novice';
        G = { on: false, hp: W_CFG.hp, el: 0, wave: 0, next: .6, mons: [], uid: 0, score: 0, kills: 0, combo: 0, lastKill: 0, gauge: 0, rockUsed: 0, throwing: false, cd: 0, sol: { p: 0, walk: 0, ready: false, gone: false },
            pre: isWide() ? W_CFG.pre : 0, swave: 0,
            wpn: opts.current, ranged: !!RANGED[opts.current], tier, tfx: TIER_FX[tier] || TIER_FX.novice, now: performance.now() };
        stage.classList.toggle('rng', G.ranged);
        els.panel.classList.add('hide'); stage.classList.remove('ended'); stage.classList.add('playing');
        renderHearts(); renderScore(); renderBal(); renderWave(); els.boss.classList.remove('on');
        ['3', '2', '1', '수비!'].forEach((t, i) => later(() => banner(t), i * 600));
        drawSol(); renderBal();
        if (G.pre) { G.el = -2.4; G.run = true; G.lt = 0; raf = requestAnimationFrame(loop); } // PC: 카운트다운 동안 숲에서 미리 걸어 나옴
        later(() => { G.on = true; if (!G.run) { G.lt = 0; raf = requestAnimationFrame(loop); } }, 2400);
    }
    function stop() { G.on = false; G.run = false; cancelAnimationFrame(raf); stage.classList.remove('playing'); stage.classList.add('ended'); }
    async function win() {
        if (!G.on) return;
        stop(); banner('🏆 오크 대장 격파!');
        G.mons.forEach(m => m.el.classList.add('flee'));
        let r = null; try { r = opts.onEnd ? await opts.onEnd(true, G.score) : null; } catch (e) { console.error(e); }
        later(() => result(true, r), 1600);
    }
    async function lose() {
        if (!G.on) return;
        stop(); banner('💥 성벽 함락…');
        let r = null; try { r = opts.onEnd ? await opts.onEnd(false, G.score) : null; } catch (e) { console.error(e); }
        later(() => result(false, r), 1300);
    }
    function result(ok, r) {
        const d = daily(), again = !ok && d.tries > 0;
        els.panel.className = 'sw-panel';
        els.panel.innerHTML = `<div class="sw-res-ic">${ok ? '🏆' : '💀'}</div>
            <div class="sw-res-t ${ok ? 'win' : 'lose'}">${ok ? '성벽 사수!' : '성벽 함락'}</div>
            <div class="sw-stat"><div><b>${G.score.toLocaleString()}</b>점수</div><div><b>${G.kills}</b>처치</div><div><b>${G.hp}/${W_CFG.hp}</b>내구도</div></div>
            ${r && r.newBest ? '<div class="sw-reward nb">🎉 최고 기록!</div>' : (r && r.best ? `<div class="sw-note">최고 ${r.best.toLocaleString()}</div>` : '')}
            ${ok && r && r.reward ? `<div class="sw-reward">+${r.reward}P 획득</div>` : ''}
            <div class="sw-tries">${ok ? '' : again ? triesHtml(d) : '오늘 도전 기회를 다 썼어요. 내일 다시!'}</div>
            <div class="sw-btns">${again ? `<button class="sw-btn" type="button" data-a="go">다시 도전 (${d.tries}번 남음)</button>` : ''}<button class="sw-btn ghost" type="button" data-a="x">닫기</button></div>`;
        if (r && r.best) els.best.textContent = '최고 ' + r.best.toLocaleString();
        const g = els.panel.querySelector('[data-a="go"]'); if (g) g.onclick = start;
        els.panel.querySelector('[data-a="x"]').onclick = close;
    }
    function open(o) {
        opts = o || {};
        if (!root) build();
        root.querySelector('.sw-fw').innerHTML = opts.figHtml || '';
        root.querySelector('.sw-wslot').innerHTML = opts.weaponHtml || '';
        els.rw.innerHTML = RANGED[opts.current] ? (opts.weaponHtml || '') : '';
        const nm = root.querySelector('.sw-nm'); nm.querySelector('b').textContent = opts.name || ''; nm.querySelector('small').textContent = opts.title || '';
        root.classList.toggle('sw-master', !!opts.onReset);
        setMode(); root.classList.add('open');
        showIntro();
    }
    function close() {
        if (!root) return;
        if (G && G.on && !confirm('지금 나가면 이번 도전은 실패로 처리돼요. 나갈까요?')) return;
        clearAll(); if (G) { G.on = false; G.run = false; }
        root.classList.remove('open');
        if (opts.onClose) opts.onClose();
    }
    window.RheaWall = { open, close, cfg: W_CFG, ladders: LADDERS, peek: () => G }; // peek = 테스트용(지금 판 상태 보기)
})();
