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
        const r = stage.getBoundingClientRect(), s = wpn.offsetWidth || r.width * .076;
        wpn.style.left = (cx - r.left - s * .78) + 'px'; wpn.style.top = (cy - r.top - s * .26) + 'px';
    }
    function smash() { wpn.classList.remove('smash'); void wpn.offsetWidth; wpn.classList.add('smash'); }

    function onPointer(e) {
        if (!G || !G.on) return;
        moveWpn(e.clientX, e.clientY);
        smash();
        const h = e.target.closest && e.target.closest('.pp-card');
        if (h) whack(holes.findIndex(x => x.el === h));
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
        smash();
        whack(i);
    }

    // 18차-3: 카드가 앞으로 뒤집히며 몬스터 등장 / 시간 지나면 다시 뒤집힘
    function appear(h, t) {
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

    function whack(i) {
        const h = holes[i];
        if (!h || !h.type || h.hit) return;
        h.hit = true;
        h.el.classList.add('hit');
        const orc = h.type === 'o';
        fxAt(h, orc ? BURST_BIG : BURST, 'pp-burst' + (orc ? ' big' : ''));
        if (master) fxAt(h, '', 'pp-shock');
        later(() => h.el.classList.remove('flip'), 230);
        later(() => { h.type = null; h.hit = false; h.el.className = 'pp-card'; }, 560);
        if (!orc) {
            G.goblins++; G.sinceOrc = Math.min(PP_CFG.goblinPerOrc, G.sinceOrc + 1);
            fxAt(h, '+1', 'pp-pop');
            renderHud();
            if (G.sinceOrc >= PP_CFG.goblinPerOrc && !G.orcOut) callOrc();
        } else {
            G.orcOut = false; G.orcsKilled++; G.sinceOrc = 0;
            fxAt(h, '오크 처치!', 'pp-pop big');
            els.cracks[G.orcsKilled - 1] && els.cracks[G.orcsKilled - 1].classList.add('on');
            shake('shake', 460);
            dropRocks(G.orcsKilled * 4, .2);
            renderHud();
            if (G.orcsKilled >= PP_CFG.orcs) win();
        }
    }

    function callOrc() {
        G.orcOut = true;
        const free = holes.map((h, i) => i).filter(i => !holes[i].type);
        const i = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * 9);
        const h = holes[i];
        if (h.type) vanish(h);
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
            d.style.cssText = `left:${32 + Math.random() * 36}%;top:${(top * 100 - 6 + Math.random() * 10).toFixed(1)}%;width:${sz}cqw;height:${(sz * (.7 + Math.random() * .5)).toFixed(2)}cqw;--t:${(.7 + Math.random() * .7).toFixed(2)}s;--dy:${(30 + Math.random() * 25).toFixed(0)}cqw;--r:${(Math.random() * 500 - 250).toFixed(0)}deg;animation-delay:${(Math.random() * .35).toFixed(2)}s`;
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
        els.fx.innerHTML = '';
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
    }
    let master = false;

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
            const c = document.createElement('div'); c.className = 'pp-count'; c.textContent = t; if (i === 3) c.style.fontSize = '8cqw';
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
