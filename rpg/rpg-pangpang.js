/* ═══════════════════════════════════════════════════════════════
   RheaOps · 모험가(RPG) 모듈 — 미니게임 "던전팡팡" (30초 카드 뒤집기 두더지잡기)
   18차 (2026-10-08): 모험가 수첩에서 여는 놀이. 업무(dashboard)와 무관, 이 파일+rpg-pangpang.css만 있으면 동작
   규칙: 고블린 10마리 잡을 때마다 오크 등장 → 오크 3마리 처치 = 던전 붕괴(클리어)
         오크를 1마리라도 놓치거나 30초가 지나면 실패. 하루 도전 3번, 성공하면 그날은 끝
   연결: window.RheaPangpang.open({ weapons, current, master, getDaily, onStart, onClear })
         - weapons = [{ key, name, html, color }] 내가 가진 무기 목록 → 시작 화면에서 아이콘으로 골라 들고 들어감 (master_sword = 룬 흑검 충격파)
         - getDaily() → { tries: 남은 도전, cleared: 오늘 성공 여부 }
         - onStart()  → 도전 1회 차감 (async 가능, false 돌려주면 시작 안 함)
         - onClear()  → 보상 지급 (async 가능, { reward: 5 } 돌려주면 결과 화면에 표시)
   18차-3: 몬스터 등장 = 하스스톤 느낌 카드. 마법문양 뒷면 카드 9장이 앞으로 뒤집히며 몬스터 등장 → 때리면 다시 뒤집힘
   밸런스는 PP_CFG 한 곳에서. 이미지는 rpg/img/pang_*.webp
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const PP_CFG = {
        time: 30, goblinPerOrc: 10, orcs: 3, tries: 3,
        spawnMs: [640, 430],     // 고블린 나오는 간격 (처음 → 끝)
        upMs: [980, 680],        // 고블린이 올라와 있는 시간 (처음 → 끝)
        maxUp: [2, 3],           // 동시에 올라와 있는 고블린 수 (처음 → 40% 지난 뒤)
        orcWarnMs: 700, orcUpMs: 1650
    };
    const PP_IMG = (() => { // 이 스크립트 옆 img/ 폴더
        const s = document.currentScript && document.currentScript.src;
        return s ? s.replace(/[^/]*$/, '') + 'img/' : 'rpg/img/';
    })();
    // 카드 9장 = 3×3 (순서대로 QWE / ASD / ZXC)
    const PP_KEYS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
    const PP_NUM = { '7': 0, '8': 1, '9': 2, '4': 3, '5': 4, '6': 5, '1': 6, '2': 7, '3': 8 };
    // 균열 3단계 (화면 1000×558 좌표, 카드 위로 화면 전체에 금이 감). 1 = 왼쪽, 2 = 오른쪽, 3 = 가운데 위→아래 관통
    const PP_CRACKS = [
        ['M120 0 L150 60 L132 110 L176 168 L160 230 L214 300 L198 372 L246 440', 'M150 60 L196 74 L230 52', 'M176 168 L120 196 L80 186 L40 214', 'M214 300 L262 288 L300 312', 'M198 372 L150 392 L120 430'],
        ['M880 0 L852 66 L872 118 L826 176 L842 236 L788 304 L806 378 L752 446', 'M852 66 L806 80 L772 56', 'M826 176 L882 202 L924 190 L962 220', 'M788 304 L740 292 L700 318', 'M806 378 L852 400 L884 438'],
        ['M500 0 L488 48 L512 96 L490 150 L516 210 L486 270 L514 330 L490 392 L512 458 L496 558', 'M512 96 L560 110 L598 88 L650 104', 'M490 150 L440 168 L404 146 L350 166',
            'M516 210 L572 232 L612 220', 'M486 270 L430 290 L392 280', 'M514 330 L566 352 L600 344 L640 372', 'M490 392 L440 414 L404 404']
    ];
    // 18차-6: 카드 그림 = 대장님 도트 카드 이미지 (img/pang_card_back.webp 뒷면 · pang_card_front.webp 앞면 테두리, 창은 투명)
    //  앞면 창 위치(카드 %): 좌 9.4 · 우 90.5 · 위 7.5 · 아래 67.4 → CSS .pp-por
    const BURST = '<svg viewBox="-50 -50 100 100"><g fill="#FFF4D0"><path d="M0-46L7-9 46 0 7 9 0 46-7 9-46 0-7-9z"/></g><g fill="#FFB84A" opacity=".9"><path d="M-30-30L-4-4-30 30-1 6 30 30 4 4 30-30 1-6z" transform="scale(.8)"/></g><circle r="10" fill="#fff"/></svg>';
    const BURST_BIG = '<svg viewBox="-50 -50 100 100"><g fill="#FF6A3A"><path d="M0-48L9-10 48 0 9 10 0 48-9 10-48 0-9-10z"/></g><g fill="#FFD98A"><path d="M-34-34L-5-5-34 34-1 7 34 34 5 5 34-34 1-7z" transform="scale(.75)"/></g><circle r="13" fill="#fff"/></svg>';
    const FALLBACK_ICON = '<svg viewBox="0 0 64 64"><g transform="rotate(40 32 32)"><rect x="29" y="16" width="6" height="46" rx="3" fill="#9A6A42" stroke="#3A200A" stroke-width="1.5"/><rect x="16" y="5" width="32" height="15" rx="3" fill="#A39E93" stroke="#3B3833" stroke-width="1.6"/></g></svg>';

    /* 22차 (v209): 원거리 무기 = 화면 아래(PC 오른쪽 아래 · 폰 가운데)에 세워두고 누른 곳으로 쏨 (판정은 누르는 순간, 날아가는 건 연출만)
       k: magic 마법 구슬 · stone 돌멩이 · bolt 석궁 볼트(빠르고 일직선) · arrow 화살(살짝 휨)
       c: 색 · ms: 날아가는 시간 · arc: 휘는 정도(화면 폭 비율) · spark: 터질 때 반짝이
       v210: 그림마다 쏘는 방향이 달라서 → dir: 그림에서 쏘는 쪽 각도(기본 -45 = 오른쪽 위) · g: 쥔 곳(그림 비율, 기본 .3,.7) · len: 쥔 곳→발사 지점 길이(기본 .62)
       장궁 그림 = 활대가 대각선(왼쪽 아래→오른쪽 위), 시위가 오른쪽 아래 → 화살은 왼쪽 위(-135°)로, 쥔 곳 = 활 가운데 */
    const PP_RANGED = {
        wood_staff: { k: 'magic', c: '#7CE05A', c2: '#E8FFD0', ms: 170, arc: 0, lv: 'sm', sz: .9 }, // v212: 초보 = 작은 구슬·꼬리 없음 · 무기 조금 작게
        magic_wand: { k: 'magic', c: '#4FB2FF', c2: '#E2F4FF', ms: 150, arc: 0, lv: 'md' }, // 일반 = 구슬 + 짧은 꼬리
        gem_staff: { k: 'magic', c: '#B266FF', c2: '#F6E6FF', ms: 160, arc: 0, spark: 3 }, // 희귀 = 구슬 + 반짝이 조금 (정예부터 더 화려하게)
        slingshot: { k: 'stone', c: '#9A8E84', ms: 170, arc: .05 },
        crossbow: { k: 'bolt', c: '#C9D3DC', ms: 95, arc: 0 },
        longbow: { k: 'arrow', c: '#E8D6B0', ms: 150, arc: .035, dir: -135, g: [.5, .5], len: .12 }
    };
    /* 22차 v211: 근접 무기 연출 — blade 칼 = 초승달 베기 궤적 · spear 창 = 찌르기 + 관통 섬광 · blunt 몽둥이 = 쿵 충격파 + 돌 부스러기
       등급 색 (rpg-data.js RPG_TIERS 기준): 초보 = 나무/흰 · 일반 = 은빛 · 희귀 = 푸른 잔상. 혈식의 룬마검은 예전 연출(충격파) 그대로 */
    const PP_MELEE = { wood_sword: 'blade', wood_blade: 'blade', longsword: 'blade', katana: 'blade', hwando: 'blade', greatsword: 'blade',
        bamboo_spear: 'spear', glaive: 'spear', guandao: 'blade', club: 'blunt' }; // v212: 언월도 = 베는 무기
    // v212 (대장님: 희귀가 정예 느낌) → 한 칸씩 내림: 초보 = 얇고 짧게(lv0) · 일반 = 흰 궤적 · 희귀 = 은빛 + 반짝이 · 정예(나중) = 푸른 잔상
    const PP_TIER_FX = { novice: { c: '#EFE2C6', c2: '#A88A62', lv0: true }, common: { c: '#FFF2D6', c2: '#C9A06A' }, rare: { c: '#FFFFFF', c2: '#B8D2F2', glint: true }, elite: { c: '#EAF7FF', c2: '#4FB2FF', glint: true, trail: true } };
    const ARC_SVG = '<svg viewBox="-50 -50 100 100"><path d="M-46 14 Q0 -52 46 14 Q0 -30 -46 14Z" fill="var(--c2)" opacity=".55"/><path d="M-42 12 Q0 -44 42 12 Q0 -32 -42 12Z" fill="var(--c)"/></svg>';
    const SHOT_SVG = {
        stone: '<svg viewBox="-10 -10 20 20"><ellipse cx="0" cy="0" rx="8" ry="6.5" fill="#8A7E74" stroke="#2A2420" stroke-width="1.6"/><ellipse cx="-2.5" cy="-2.2" rx="3" ry="2" fill="#C8BCB0" opacity=".7"/></svg>',
        bolt: '<svg viewBox="-30 -6 60 12"><path d="M-28 0H18" stroke="#5A3A20" stroke-width="2.6"/><path d="M-28 -4L-20 0-28 4" fill="#8A9AA8" stroke="#2A3440" stroke-width="1"/><path d="M16 -4.5L28 0 16 4.5Z" fill="#DDE6EE" stroke="#2A3440" stroke-width="1.2"/></svg>',
        arrow: '<svg viewBox="-40 -7 80 14"><path d="M-38 0H26" stroke="#A8783E" stroke-width="2.2"/><path d="M-38 -5L-28 0-38 5M-32 -5L-22 0-32 5" fill="none" stroke="#E8E2D2" stroke-width="2"/><path d="M24 -5L38 0 24 5 27 0Z" fill="#CFD8E0" stroke="#2A3440" stroke-width="1.2"/></svg>'
    };

    let opts = {}, root, stage, world, wpn, holes = [], els = {}, G = null, tickId = 0, timeouts = [];

    function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
    function later(fn, ms) { const id = setTimeout(fn, ms); timeouts.push(id); return id; }
    function clearAll() { clearInterval(tickId); tickId = 0; timeouts.forEach(clearTimeout); timeouts = []; }

    function build() {
        root = document.createElement('div');
        root.className = 'pp-dim';
        root.innerHTML = `<div class="pp-stage" style="--img-g:url('${PP_IMG}pang_goblin.webp');--img-o:url('${PP_IMG}pang_orc.webp');--img-cb:url('${PP_IMG}pang_card_back.webp');--img-cf:url('${PP_IMG}pang_card_front.webp')">
            <div class="pp-world">
                <img class="pp-bg" src="${PP_IMG}pang_gate.webp" alt="" draggable="false">
                <div class="pp-torch" style="left:25%;top:47%"></div><div class="pp-torch r" style="left:74.5%;top:47%"></div>
                <svg class="pp-crack" style="z-index:2" viewBox="0 0 1000 558" preserveAspectRatio="none" aria-hidden="true">${PP_CRACKS.map(g =>
                    `<g>${g.map((d, i) => `<path class="${i ? 'cs' : 'cd'}" pathLength="1" d="${d}"/>`).join('')}${g.slice(0, 1).map(d => `<path class="cl" pathLength="1" d="${d}"/>`).join('')}</g>`).join('')}</svg>
                <div class="pp-vig"></div>
                <div class="pp-holes"></div>
                <div class="pp-dust"></div>
                <div class="pp-fx"></div>
            </div>
            <div class="pp-lose-v"></div>
            <div class="pp-hud">
                <div class="pp-time"><div class="pp-lbl">남은 시간<b class="pp-tt">30</b></div><div class="pp-tbar"><i></i></div></div>
                <div class="pp-gob"><div class="pp-lbl">오크 출현까지</div><div class="pp-pips">${'<i></i>'.repeat(PP_CFG.goblinPerOrc)}</div></div>
                <div class="pp-orcs"><div class="pp-lbl">오크 토벌</div><div class="pp-sk">${'<i></i>'.repeat(PP_CFG.orcs)}</div></div>
            </div>
            <div class="pp-alert">⚠ 오크 출현!</div>
            <div class="pp-shots"></div><div class="pp-aim"></div>
            <div class="pp-wpn"></div>
            <div class="pp-panel"></div>
            <button class="pp-x" type="button" aria-label="닫기"></button><button class="pp-reset" type="button" title="마스터 테스트용: 오늘 도전 기록 지우기">↺ 게임 초기화</button>
        </div>`;
        document.body.appendChild(root);
        stage = root.querySelector('.pp-stage');
        world = root.querySelector('.pp-world');
        wpn = root.querySelector('.pp-wpn');
        els = { holes: root.querySelector('.pp-holes'), fx: root.querySelector('.pp-fx'), panel: root.querySelector('.pp-panel'), tt: root.querySelector('.pp-tt'),
            tbar: root.querySelector('.pp-tbar'), tbi: root.querySelector('.pp-tbar i'), pips: [...root.querySelectorAll('.pp-pips i')],
            shots: root.querySelector('.pp-shots'), aim: root.querySelector('.pp-aim'),
            sk: [...root.querySelectorAll('.pp-sk i')], alert: root.querySelector('.pp-alert'), cracks: [...root.querySelectorAll('.pp-crack g')] };
        holes = PP_KEYS.map((key, i) => {
            const el = document.createElement('div');
            el.className = 'pp-card';
            el.innerHTML = `<div class="pp-cin"><div class="pp-back"><i class="pp-glow"></i></div><div class="pp-front"><div class="pp-por"></div><div class="pp-ff"></div><div class="pp-nm"></div><div class="pp-slash"></div></div></div><span class="pp-key">${key.toUpperCase()}</span>`;
            els.holes.appendChild(el);
            return { el, nm: el.querySelector('.pp-nm'), type: null, until: 0, hit: false };
        });
        root.querySelector('.pp-x').addEventListener('click', close);
        root.querySelector('.pp-reset').addEventListener('click', async () => { // 19차-5: 마스터 테스트용 — 오늘 기록 지우고 처음 화면
            if (!opts.onReset || (G && G.on)) return;
            if (!confirm('오늘 던전팡팡 기록(남은 도전·정복)을 지울까요? (마스터 테스트용)')) return;
            await opts.onReset(); clearAll(); G = null; resetBoard(); stage.classList.remove('playing'); showIntro();
        });
        root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
        stage.addEventListener('pointermove', (e) => moveWpn(e.clientX, e.clientY));
        stage.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
    }

    function moveWpn(cx, cy) {
        const r = stage.getBoundingClientRect();
        if (ranged) { // 원거리: 무기는 아래에 세워둔 채, 누른 곳을 향해 돌림 + 조준점
            const x = cx - r.left, y = cy - r.top;
            els.aim.style.left = x + 'px'; els.aim.style.top = y + 'px';
            const g = grip(r), a = Math.atan2(y - g.y, x - g.x) * 180 / Math.PI;
            wpn.style.setProperty('--aim', Math.max(-170, Math.min(-10, a)) - (ranged.dir || -45) + 'deg');
            return;
        }
        const s = wpn.offsetWidth || r.width * .076;
        wpn.style.left = (cx - r.left - s * .78) + 'px'; wpn.style.top = (cy - r.top - s * .26) + 'px';
    }
    function smash() { const c = ranged ? 'fire' : 'smash'; wpn.classList.remove(c); void wpn.offsetWidth; wpn.classList.add(c); }
    // 원거리 무기 쥔 곳(회전축) = 무기 칸의 30%·70% 지점 (CSS .pp-rng .pp-wpn 과 같은 값)
    function grip(r) { const s = wpn.offsetWidth, x = wpn.offsetLeft, y = wpn.offsetTop, gg = (ranged && ranged.g) || [.3, .7]; return { x: x + s * gg[0], y: y + s * gg[1], s }; }
    // 22차: 원거리 발사 — 무기 끝에서 (tx,ty)까지 날아감. 다 날아가면 hit() (도착 연출)
    function shoot(tx, ty, hit) {
        const r = stage.getBoundingClientRect(), g = grip(r), cfg = ranged;
        const ang = Math.atan2(ty - g.y, tx - g.x), L = g.s * (cfg.len || .62);
        const sx = g.x + Math.cos(ang) * L, sy = g.y + Math.sin(ang) * L;
        const dx = tx - sx, dy = ty - sy, lift = cfg.arc * r.width;
        const d = document.createElement('div');
        d.className = 'pp-shot k-' + cfg.k + (cfg.lv ? ' ' + cfg.lv : '');
        d.style.cssText = `left:${sx}px;top:${sy}px;--c:${cfg.c};--c2:${cfg.c2 || '#fff'}`;
        d.innerHTML = SHOT_SVG[cfg.k] || '';
        els.shots.appendChild(d);
        if (cfg.k === 'magic') { // 지팡이 끝 번쩍
            const m = document.createElement('div'); m.className = 'pp-muzzle'; m.style.cssText = `left:${sx}px;top:${sy}px;--c:${cfg.c}`;
            els.shots.appendChild(m); setTimeout(() => m.remove(), 400);
        }
        const deg = ang * 180 / Math.PI, N = 6, kf = [];
        for (let i = 0; i <= N; i++) {
            const t = i / N, ox = dx * t, oy = dy * t - lift * 4 * t * (1 - t);
            const vy = dy - lift * 4 * (1 - 2 * t); // 휘는 방향 따라 화살 끝도 돌아감
            const rot = cfg.k === 'stone' ? deg + t * 540 : Math.atan2(vy, dx) * 180 / Math.PI;
            kf.push({ transform: `translate(${ox}px,${oy}px) rotate(${rot}deg)` });
        }
        const an = d.animate ? d.animate(kf, { duration: cfg.ms, easing: 'linear', fill: 'forwards' }) : null;
        const done = () => { d.remove(); impact(tx, ty); if (hit) hit(); };
        if (an) an.onfinish = done; else later(done, cfg.ms);
    }
    function impact(x, y) { // 도착: 마법 = 색 폭발 · 돌 = 흙먼지 · 화살/볼트 = 불꽃
        const cfg = ranged, add = (cls, css, ms) => { const e = document.createElement('div'); e.className = cls; e.style.cssText = `left:${x}px;top:${y}px;` + (css || ''); els.shots.appendChild(e); setTimeout(() => e.remove(), ms || 600); return e; };
        add('pp-imp k-' + cfg.k + (cfg.lv ? ' ' + cfg.lv : ''), `--c:${cfg.c};--c2:${cfg.c2 || '#fff'}`, 650);
        if (cfg.spark) for (let i = 0, n = cfg.spark; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * .5, R = 4 + Math.random() * 3;
            add('pp-spk', `--c:${cfg.c2};--dx:calc(var(--k) * ${(Math.cos(a) * R).toFixed(2)}cqw);--dy:calc(var(--k) * ${(Math.sin(a) * R).toFixed(2)}cqw)`, 700); }
    }

    function onPointer(e) {
        if (!G || !G.on) return;
        moveWpn(e.clientX, e.clientY);
        const h = e.target.closest && e.target.closest('.pp-card');
        fire(h ? holes.findIndex(x => x.el === h) : -1, e.clientX, e.clientY);
    }
    // 22차: 공격 한 번 — 근접은 그 자리에서 쾅, 원거리는 쏴서 날아간 뒤 맞는 연출 (점수 판정은 둘 다 누르는 순간)
    function fire(i, cx, cy) {
        smash();
        if (!ranged) {
            const ok = i >= 0 && whack(i);
            if (melee) { const r = stage.getBoundingClientRect(), b = ok ? holes[i].el.getBoundingClientRect() : null;
                meleeFx(b ? b.left + b.width / 2 - r.left : cx - r.left, b ? b.top + b.height * .42 - r.top : cy - r.top, ok); }
            return;
        }
        const r = stage.getBoundingClientRect();
        const ok = i >= 0 && whack(i, ranged.ms);
        shoot(cx - r.left, cy - r.top, ok ? () => hitFx(holes[i]) : null);
    }
    // 22차 v211: 근접 연출 (x,y = 무대 좌표 px, hit = 몬스터를 맞혔는지). 헛손질이면 궤적만 흐리게
    function meleeFx(x, y, hit) {
        const t = meleeTier, add = (cls, css, html, ms) => { const e = document.createElement('div'); e.className = cls + (t.lv0 ? ' lv0' : ''); e.style.cssText = `left:${x}px;top:${y}px;--c:${t.c};--c2:${t.c2};` + (css || ''); if (html) e.innerHTML = html; els.shots.appendChild(e); setTimeout(() => e.remove(), ms || 600); return e; };
        const chips = (n, base, spread, R, cls) => { for (let k = 0; k < n; k++) { const a = (base + (Math.random() - .5) * spread) * Math.PI / 180, d = R * (.6 + Math.random() * .6);
            add(cls || 'pp-chip', `--dx:calc(var(--k) * ${(Math.cos(a) * d).toFixed(2)}cqw);--dy:calc(var(--k) * ${(Math.sin(a) * d).toFixed(2)}cqw);--r:${(Math.random() * 600 - 300) | 0}deg;animation-delay:${(Math.random() * .05).toFixed(2)}s`, '', 650); } };
        if (melee === 'blade') {
            const rot = 34 + Math.random() * 22; // v212: 궤적 방향 고침 — 손(왼쪽 아래)을 축으로 도니까 볼록한 쪽이 오른쪽 위
            add('pp-arc' + (hit ? '' : ' miss'), `--rot:${rot}deg`, ARC_SVG, 400);
            if (t.trail) add('pp-arc trail', `--rot:${rot + 8}deg`, ARC_SVG, 450);
            if (hit) { add('pp-cut', `--rot:${rot - 8}deg`, '', 420); if (t.glint) chips(4, -60, 120, 4, 'pp-glint'); }
        } else if (melee === 'spear') {
            if (hit) { add('pp-pierce', '', '', 360); if (t.trail) add('pp-pierce trail', '', '', 420); if (!t.lv0) add('pp-pflash', '', '', 300); chips(t.lv0 ? 3 : 5, -59, 50, 6); if (t.glint) chips(3, -59, 70, 5, 'pp-glint'); }
        } else if (melee === 'blunt') {
            if (hit) { add('pp-thud', '', '', 520); chips(t.lv0 ? 4 : 7, -90, 150, 5); shake('thud', 200); }
            else add('pp-thud miss', '', '', 400);
        }
    }
    function onKey(e) {
        if (!root || !root.classList.contains('open')) return;
        if (e.key === 'Escape') { close(); return; }
        if (!G || !G.on || e.repeat) return;
        const i = PP_KEYS.indexOf(e.key.toLowerCase()) >= 0 ? PP_KEYS.indexOf(e.key.toLowerCase()) : (e.code && e.code.startsWith('Numpad') ? PP_NUM[e.key] : undefined);
        if (i === undefined || i < 0) return;
        e.preventDefault();
        const b = holes[i].el.getBoundingClientRect();
        moveWpn(b.left + b.width / 2, b.top + b.height * .45);
        fire(i, b.left + b.width / 2, b.top + b.height * .45);
    }

    // 18차-3: 카드가 앞으로 뒤집히며 몬스터 등장 / 시간 지나면 다시 뒤집힘
    function appear(h, t) {
        h.gen = (h.gen || 0) + 1; // v213: 카드가 새로 쓰일 때마다 번호 +1 → 예전에 맞은 카드의 '늦게 치우기'가 새 몬스터(오크)를 지우지 못하게
        h.type = t; h.hit = false;
        h.el.className = 'pp-card m-' + t;
        h.nm.textContent = t === 'o' ? '오크 전사' : '고블린';
        void h.el.offsetWidth; h.el.classList.add('flip');
    }
    function vanish(h) { h.type = null; h.el.classList.remove('flip', 'warn'); }
    function fxAt(hole, html, cls) {
        const r = stage.getBoundingClientRect(), b = hole.el.getBoundingClientRect();
        const d = document.createElement('div');
        d.className = cls;
        d.style.left = ((b.left + b.width / 2 - r.left) / r.width * 100) + '%';
        d.style.top = ((b.top + b.height * .42 - r.top) / r.height * 100) + '%';
        d.innerHTML = html || '';
        els.fx.appendChild(d);
        setTimeout(() => d.remove(), 900);
    }
    function shake(cls, ms) { stage.classList.remove(cls); void stage.offsetWidth; stage.classList.add(cls); later(() => stage.classList.remove(cls), ms); }

    // dl = 원거리 화살이 날아가는 시간(ms): 판정·점수는 지금 바로, 카드가 맞는 그림은 도착할 때 (hitFx)
    function whack(i, dl) {
        const h = holes[i];
        if (!h || !h.type || h.hit || h.type === 'w') return false;
        h.hit = true;
        const orc = h.type === 'o';
        h.big = orc;
        dl = dl || 0;
        if (!dl) hitFx(h);
        const gen = h.gen;
        later(() => { if (h.gen === gen) h.el.classList.remove('flip'); }, 230 + dl);
        later(() => { if (h.gen !== gen) return; h.type = null; h.hit = false; h.el.className = 'pp-card'; }, 560 + dl);
        if (!orc) {
            G.goblins++; G.sinceOrc = Math.min(PP_CFG.goblinPerOrc, G.sinceOrc + 1);
            renderHud();
            if (G.sinceOrc >= PP_CFG.goblinPerOrc && !G.orcOut) callOrc();
        } else {
            G.orcOut = false; G.orcsKilled++; G.sinceOrc = 0;
            els.cracks[G.orcsKilled - 1] && els.cracks[G.orcsKilled - 1].classList.add('on');
            shake('shake', 460);
            dropRocks(G.orcsKilled * 4, .2);
            renderHud();
            if (G.orcsKilled >= PP_CFG.orcs) win();
        }
        return true;
    }
    function hitFx(h) {
        if (!h) return;
        h.el.classList.add('hit'); if (ranged) h.el.classList.add('rk'); if (melee) h.el.classList.add('mk'); // v212: 근접은 무기별 자국을 따로 그림 → 카드 기본 사선(반대 방향)은 숨김
        fxAt(h, h.big ? BURST_BIG : BURST, 'pp-burst' + (h.big ? ' big' : '')); // v210: 원거리도 맞는 순간 터짐 + 점수 글자 (예전엔 쏘자마자 +1이 떠서 안 맞은 것처럼 보였음)
        fxAt(h, h.big ? '오크 처치!' : '+1', 'pp-pop' + (h.big ? ' big' : ''));
        if (master) fxAt(h, '', 'pp-shock');
    }

    function callOrc() {
        G.orcOut = true;
        const free = holes.map((h, i) => i).filter(i => !holes[i].type);
        const i = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * 9);
        const h = holes[i];
        if (h.type) vanish(h);
        h.gen = (h.gen || 0) + 1; h.hit = false; h.el.className = 'pp-card';
        h.type = 'w'; // 경고 중엔 다른 고블린이 못 들어옴
        h.el.classList.add('warn');
        els.alert.classList.remove('show'); void els.alert.offsetWidth; els.alert.classList.add('show');
        later(() => {
            if (!G.on) return;
            h.el.classList.remove('warn');
            appear(h, 'o'); h.until = performance.now() + PP_CFG.orcUpMs;
        }, PP_CFG.orcWarnMs);
    }

    function dropRocks(n, top) {
        for (let k = 0; k < n; k++) {
            const d = document.createElement('div');
            const sz = 1 + Math.random() * 2.2;
            d.className = 'pp-fall';
            d.style.cssText = `left:${32 + Math.random() * 36}%;top:${(top * 100 - 6 + Math.random() * 10).toFixed(1)}%;width:calc(var(--k) * ${sz}cqw);height:calc(var(--k) * ${(sz * (.7 + Math.random() * .5)).toFixed(2)}cqw);--t:${(.7 + Math.random() * .7).toFixed(2)}s;--dy:calc(var(--k) * ${(30 + Math.random() * 25).toFixed(0)}cqw);--r:${(Math.random() * 500 - 250).toFixed(0)}deg;animation-delay:${(Math.random() * .35).toFixed(2)}s`;
            els.fx.appendChild(d);
            setTimeout(() => d.remove(), 2200);
        }
    }

    function tick() {
        const now = performance.now(), el = (now - G.t0) / 1000, p = el / PP_CFG.time;
        const left = Math.max(0, PP_CFG.time - el);
        els.tt.textContent = Math.ceil(left);
        els.tbi.style.transform = `scaleX(${left / PP_CFG.time})`;
        els.tbar.classList.toggle('low', left <= 5);
        holes.forEach((h) => {
            if ((h.type === 'g' || h.type === 'o') && !h.hit && now > h.until) {
                if (h.type === 'o') { h.el.classList.add('laugh'); return lose('오크가 도망쳤어…', h); }
                vanish(h);
            }
        });
        if (!G.on) return;
        if (left <= 0) return lose('시간 초과…');
        // v213 안전장치: 오크가 나왔다고 돼 있는데 판에 오크(경고 포함)가 없으면 다시 부름 (대장님: 폰에서 10마리 잡았는데 오크가 안 나옴)
        if (G.orcOut && !holes.some(h => h.type === 'w' || h.type === 'o')) G.orcOut = false;
        if (!G.orcOut && G.sinceOrc >= PP_CFG.goblinPerOrc) callOrc();
        if (now >= G.next) {
            const up = holes.filter(h => h.type === 'g').length;
            if (up < (p < .4 ? PP_CFG.maxUp[0] : PP_CFG.maxUp[1])) {
                const free = holes.filter(h => !h.type);
                if (free.length) {
                    const h = free[Math.floor(Math.random() * free.length)];
                    appear(h, 'g'); h.until = now + lerp(PP_CFG.upMs[0], PP_CFG.upMs[1], p);
                }
            }
            G.next = now + lerp(PP_CFG.spawnMs[0], PP_CFG.spawnMs[1], p) * (.8 + Math.random() * .4);
        }
    }

    function renderHud() {
        els.pips.forEach((x, i) => x.classList.toggle('on', i < G.sinceOrc));
        els.sk.forEach((x, i) => x.classList.toggle('on', i < G.orcsKilled));
    }
    function resetBoard() {
        holes.forEach(h => { h.type = null; h.hit = false; h.el.className = 'pp-card'; });
        els.cracks.forEach(c => c.classList.remove('on'));
        els.fx.innerHTML = ''; els.shots.innerHTML = '';
        stage.classList.remove('collapse', 'lost', 'shake', 'ended');
        els.tbi.style.transform = 'scaleX(1)'; els.tt.textContent = PP_CFG.time;
    }

    function daily() { return (opts.getDaily && opts.getDaily()) || { tries: PP_CFG.tries, cleared: false }; }
    function triesHtml(d) { return `오늘 남은 도전 ${Array.from({ length: PP_CFG.tries }, (_, i) => `<i class="${i < d.tries ? '' : 'off'}"></i>`).join('')}`; }

    function showIntro() {
        const d = daily();
        const can = !d.cleared && d.tries > 0;
        els.panel.className = 'pp-panel';
        els.panel.innerHTML = `<div class="pp-title">던전팡팡</div>
            <div class="pp-sub">던전 입구를 지키는 몬스터를 쓰러뜨리고 <b>던전을 무너뜨려라!</b></div>
            <div class="pp-rules">
                <div class="pp-rule"><div class="ic" style="background-image:var(--img-g)"></div><b>고블린 처치</b>${PP_CFG.goblinPerOrc}마리마다<br>오크가 나타나요</div>
                <div class="pp-rule"><div class="ic" style="background-image:var(--img-o)"></div><b>오크 ${PP_CFG.orcs}마리 처치</b>던전 붕괴 = 클리어<br>1마리라도 놓치면 실패</div>
                <div class="pp-rule"><div class="ic t">⏳</div><b>제한 ${PP_CFG.time}초</b>클릭·터치 또는<br>Q W E / A S D / Z X C</div>
            </div>
            ${weaponsHtml()}
            <div class="pp-tries">${d.cleared ? '✅ 오늘의 던전은 정복 완료! 내일 다시 열려요' : triesHtml(d)}</div>
            <div class="pp-btns"><button class="pp-btn" type="button" data-a="go" ${can ? '' : 'disabled'}>⚔ 던전 진입</button></div>
            <div class="pp-note">${d.cleared ? '' : d.tries > 0 ? '성공하면 보상 지급 · 하루 3번 도전, 성공하면 그날은 끝' : '오늘 도전 기회를 다 썼어요. 내일 다시!'}</div>`;
        els.panel.querySelector('[data-a="go"]').onclick = start;
        els.panel.querySelectorAll('.pp-wcell').forEach(b => b.onclick = () => { pick(b.dataset.k); els.panel.querySelectorAll('.pp-wcell').forEach(x => x.classList.toggle('sel', x === b)); });
        const cur = els.panel.querySelector('.pp-wcell.sel'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    // 18차-2: 내가 가진 무기를 아이콘+이름으로 한 번에 보고 골라서 들고 들어감 (이 게임 안에서만, 장착은 안 바뀜)
    function weaponsHtml() {
        return ''; // 19차-5: 무기 고르는 칸 없앰 → 수첩에서 장착한 무기를 그대로 들고 감
        const list = opts.weapons || [];
        if (list.length < 2) return '';
        return `<div class="pp-wpick"><div class="pp-wlbl">들고 갈 무기</div><div class="pp-wrow">${list.map(w =>
            `<button type="button" class="pp-wcell${w.key === cur ? ' sel' : ''}" data-k="${w.key}" style="--tc:${w.color || '#F2C94C'}"><span class="pp-wic">${w.html}</span><span class="pp-wnm">${w.name}</span></button>`).join('')}</div></div>`;
    }
    let cur = null;
    function pick(k) {
        const list = opts.weapons || [];
        const w = list.find(x => x.key === k) || list[0];
        cur = w ? w.key : null;
        wpn.innerHTML = (w && w.html) || opts.iconHtml || FALLBACK_ICON;
        const svg = wpn.querySelector('svg'); if (svg) svg.removeAttribute('class');
        master = cur === 'master_sword' || (!w && !!opts.master);
        ranged = PP_RANGED[cur] || null;
        melee = ranged ? null : (PP_MELEE[cur] || null);
        let tid = 'novice'; try { const tt = (typeof RPG_TIERS !== 'undefined') && RPG_TIERS.find(x => x.keys.includes(cur)); if (tt) tid = tt.id; } catch (e) { }
        meleeTier = PP_TIER_FX[tid] || PP_TIER_FX.novice;
        wpn.dataset.m = melee || '';
        stage.classList.toggle('pp-rng', !!ranged);
        const gg = (ranged && ranged.g) || [.3, .7]; wpn.style.setProperty('--gx', gg[0]); wpn.style.setProperty('--gy', gg[1]); wpn.style.setProperty('--wsz', (ranged && ranged.sz) || 1);
        wpn.style.left = wpn.style.top = ''; wpn.style.removeProperty('--aim');
    }
    let master = false, ranged = null, melee = null, meleeTier = PP_TIER_FX.novice;

    let starting = false; // 19차-4: 저장 기다리는 동안 버튼을 또 누르면 도전이 두 번 깎이고 게임이 겹치던 문제 막기
    async function start() {
        const d = daily();
        if (starting || (G && G.on) || d.cleared || d.tries <= 0) return;
        starting = true;
        const btn = els.panel.querySelector('[data-a="go"]');
        if (btn) { btn.disabled = true; btn.textContent = '입장 준비중…'; }
        try {
            if (opts.onStart) { const ok = await opts.onStart(); if (ok === false) { if (btn) { btn.disabled = false; btn.textContent = '⚔ 다시 시도'; } return; } }
        } finally { starting = false; }
        resetBoard();
        els.panel.classList.add('hide');
        G = { on: false, t0: 0, next: 0, goblins: 0, sinceOrc: 0, orcsKilled: 0, orcOut: false };
        renderHud();
        stage.classList.add('playing');
        ['3', '2', '1', '돌격!'].forEach((t, i) => later(() => {
            const c = document.createElement('div'); c.className = 'pp-count'; c.textContent = t; if (i === 3) c.style.fontSize = 'calc(var(--k) * 8cqw)';
            stage.appendChild(c); setTimeout(() => c.remove(), 820);
        }, i * 650));
        later(() => { G.on = true; G.t0 = performance.now(); G.next = G.t0 + 250; tickId = setInterval(tick, 40); }, 3 * 650 + 200);
    }

    function stop() { G.on = false; clearInterval(tickId); tickId = 0; stage.classList.add('ended'); stage.classList.remove('playing'); }

    function lose(msg, orcHole) {
        if (!G.on) return;
        stop();
        stage.classList.add('lost');
        holes.forEach(h => { if (h !== orcHole) vanish(h); });
        later(() => result(false, msg), orcHole ? 1100 : 600);
    }
    async function win() {
        stop();
        holes.forEach(h => vanish(h));
        later(() => holes.forEach((h, i) => { h.el.style.setProperty('--fd', (Math.random() * .35).toFixed(2) + 's'); h.el.style.setProperty('--fr', (Math.random() * 60 - 30).toFixed(0) + 'deg'); h.el.classList.add('fall'); }), 300);
        later(() => { stage.classList.add('collapse'); dropRocks(36, .05); later(() => dropRocks(24, .15), 450); }, 350);
        let rew = null;
        try { rew = opts.onClear ? await opts.onClear() : null; } catch (e) { console.error(e); }
        later(() => result(true, '', rew), 2300);
    }

    function result(ok, msg, rew) {
        const d = daily();
        const again = !ok && d.tries > 0;
        els.panel.className = 'pp-panel';
        els.panel.innerHTML = `<div class="pp-res-ic">${ok ? '🏆' : '💀'}</div>
            <div class="pp-res-t ${ok ? 'win' : 'lose'}">${ok ? '던전 붕괴!' : '공략 실패'}</div>
            <div class="pp-sub">${ok ? '던전 입구를 무너뜨렸어요. 오늘의 던전 정복 완료!' : msg}</div>
            <div class="pp-stat"><div><b>${G.goblins}</b>고블린</div><div><b>${G.orcsKilled}/${PP_CFG.orcs}</b>오크</div></div>
            ${ok && rew && rew.reward ? `<div class="pp-reward">+${rew.reward}P 획득</div>` : ''}
            <div class="pp-tries">${ok ? '' : again ? triesHtml(d) : '오늘 도전 기회를 다 썼어요. 내일 다시!'}</div>
            <div class="pp-btns">${again ? `<button class="pp-btn" type="button" data-a="go">다시 도전 (${d.tries}번 남음)</button>` : ''}<button class="pp-btn ghost" type="button" data-a="x">닫기</button></div>`;
        const g = els.panel.querySelector('[data-a="go"]'); if (g) g.onclick = start;
        els.panel.querySelector('[data-a="x"]').onclick = close;
    }

    function open(o) {
        opts = o || {};
        if (!root) build();
        clearAll(); G = null;
        resetBoard();
        stage.classList.remove('playing');
        pick(opts.current); // 19차-5: 늘 수첩에서 장착한 무기
        showIntro();
        root.classList.toggle('pp-master', !!opts.onReset);
        root.classList.add('open');
        // 20차: 폰 세로 화면 = 배경을 가운데 잘라 꽉 채우니 균열 그림도 같은 비율로 (가로 화면은 예전처럼 늘림)
        const ck = root.querySelector('.pp-crack'); if (ck) ck.setAttribute('preserveAspectRatio', matchMedia('(orientation: portrait) and (max-width: 820px)').matches ? 'xMidYMid slice' : 'none');
    }
    function close() {
        if (!root) return;
        if (G && G.on && !confirm('지금 나가면 이번 도전은 실패로 처리돼요. 나갈까요?')) return;
        clearAll();
        if (G) G.on = false;
        root.classList.remove('open');
        stage.classList.remove('playing');
        if (opts.onClose) opts.onClose();
    }

    window.RheaPangpang = { open, close, cfg: PP_CFG };
})();
