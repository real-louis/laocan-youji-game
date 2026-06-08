(function () {
  'use strict';

  const SCREENS = {
    home: document.getElementById('screen-home'),
    settings: document.getElementById('screen-settings'),
    rules: document.getElementById('screen-rules'),
    branch: document.getElementById('screen-branch'),
    map: document.getElementById('screen-map'),
    event: document.getElementById('screen-event'),
    ending: document.getElementById('screen-ending')
  };

  const TUTORIAL_KEY = 'laocan_tutorial_seen';
  const ACHIEVEMENTS_KEY = 'laocan_achievements';
  const ENDINGS_KEY = 'laocan_endings';

  let rulesReturnScreen = 'home';
  let pendingStart = false;
  let activeLevels = [];

  function createInitialState() {
    return {
      ren: INITIAL_STATS.ren,
      dong: INITIAL_STATS.dong,
      ming: INITIAL_STATS.ming,
      peak: { ren: 3, dong: 3, ming: 3 },
      currentLevel: 0,
      currentEvent: 0,
      completedLevels: [],
      awaitingFeedback: false,
      route: null,
      needBranch: false,
      flags: {},
      history: [],
      items: { medkit: true, poem: true, silver: true },
      itemUsedThisLevel: false,
      officialFlipped: false,
      endingId: null,
      comboLean: null,
      comboCount: 0,
      maxCombo: 0,
      encounterIds: []
    };
  }

  let state = createInitialState();

  function getActiveLevels() {
    if (!state.route) return [LEVEL_LAKE];
    return buildLevelOrder(state.route);
  }

  function showScreen(name) {
    Object.values(SCREENS).forEach((el) => el.classList.remove('active'));
    SCREENS[name].classList.add('active');
    updateHelpButton(name);
    if (name !== 'home' && name !== 'rules' && name !== 'settings') {
      AudioManager.play('transition');
    }
  }

  function updateHelpButton(screenName) {
    const helpBtn = document.getElementById('btn-help');
    const inGame = ['map', 'event', 'ending', 'branch'].includes(screenName);
    helpBtn.classList.toggle('hidden', !inGame);
  }

  function clampStat(val) {
    return Math.max(0, Math.min(5, val));
  }

  function updatePeak() {
    ['ren', 'dong', 'ming'].forEach((k) => {
      state.peak[k] = Math.max(state.peak[k], state[k]);
    });
  }

  function applyEffects(effects) {
    if (!effects) return;
    const before = { ren: state.ren, dong: state.dong, ming: state.ming };
    state.ren = clampStat(state.ren + (effects.ren || 0));
    state.dong = clampStat(state.dong + (effects.dong || 0));
    state.ming = clampStat(state.ming + (effects.ming || 0));
    updatePeak();
    animateStatChanges(before);
  }

  function animateStatChanges(before) {
    const mapping = { ren: 'ren', dong: 'dong', ming: 'ming' };
    Object.entries(mapping).forEach(([key]) => {
      const diff = state[key] - before[key];
      if (diff === 0) return;
      document.querySelectorAll(`#res-${key}, #res-${key}-map`).forEach((el) => {
        const parent = el.closest('.res-item');
        if (parent) {
          parent.classList.remove('stat-up', 'stat-down');
          void parent.offsetWidth;
          parent.classList.add(diff > 0 ? 'stat-up' : 'stat-down');
        }
      });
      showStatPopup(key, diff);
    });
    updateResourceDisplay();
    updateResourceDisplay('map');
  }

  function showStatPopup(key, diff) {
    const bar = document.getElementById('resource-bar-event');
    if (!bar) return;
    const popup = document.createElement('span');
    popup.className = `stat-popup ${diff > 0 ? 'up' : 'down'}`;
    popup.textContent = `${STAT_LABELS[key]}${diff > 0 ? '+' : ''}${diff}`;
    bar.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
  }

  function updateResourceDisplay(prefix = '') {
    const suffix = prefix ? `-${prefix}` : '';
    ['ren', 'dong', 'ming'].forEach((key) => {
      const el = document.getElementById(`res-${key}${suffix}`);
      if (el) el.textContent = state[key];
    });
  }

  function resetGame() {
    state = createInitialState();
    activeLevels = [];
    state.officialFlipped = false;
  }

  function persistSave(screenName) {
    const screen = screenName || getCurrentScreen();
    if (screen === 'ending' || screen === 'home') return;
    Retention.saveGame({ ...state, officialFlipped: state.officialFlipped }, screen);
    updateHomeUI();
  }

  function getCurrentScreen() {
    const active = Object.entries(SCREENS).find(([, el]) => el.classList.contains('active'));
    return active ? active[0] : 'home';
  }

  function applyStreakBonus(bonus) {
    if (!bonus) return null;
    applyEffects(bonus);
    const parts = [];
    if (bonus.ren) parts.push('仁心+1');
    if (bonus.dong) parts.push('洞察+1');
    if (bonus.ming) parts.push('名聲+1');
    return parts.join('、');
  }

  function showStreakToast(message) {
    const el = document.getElementById('streak-toast');
    if (!el || !message) return;
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function renderFateTracker() {
    const el = document.getElementById('fate-tracker');
    if (!el) return;
    const trajectory = getEndingTrajectory(state);
    el.innerHTML = `
      <p class="fate-label">命途傾向</p>
      <div class="fate-bars">
        ${trajectory.map((t) => `
          <div class="fate-row">
            <span class="fate-name ${t.hidden ? 'hidden-fate' : ''}">${t.title}</span>
            <div class="fate-bar"><div class="fate-fill" style="width:${Math.round(t.score)}%"></div></div>
            <span class="fate-pct">${Math.round(t.score)}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderComboBar() {
    const el = document.getElementById('combo-bar');
    if (!el) return;
    if (!state.comboLean || state.comboCount < 2) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = `
      <span class="combo-fire">🔥</span>
      <span class="combo-text">${COMBO_LABELS[state.comboLean]}連貫 ×${state.comboCount}</span>
      <span class="combo-hint">${state.comboCount >= 2 ? '再一擊觸發心悟！' : ''}</span>
    `;
  }

  function processCombo(effects) {
    const lean = getChoiceLean(effects);
    if (!lean || lean === 'cold') {
      state.comboLean = null;
      state.comboCount = 0;
      renderComboBar();
      return null;
    }
    if (lean === state.comboLean) {
      state.comboCount += 1;
    } else {
      state.comboLean = lean;
      state.comboCount = 1;
    }
    state.maxCombo = Math.max(state.maxCombo || 0, state.comboCount);
    renderComboBar();

    if (state.comboCount >= 3) {
      const bonus = { [lean]: 1 };
      state.comboCount = 0;
      state.comboLean = null;
      renderComboBar();
      return { lean, bonus };
    }
    return { lean, count: state.comboCount };
  }

  function showComboToast(lean) {
    const el = document.getElementById('combo-toast');
    if (!el) return;
    el.textContent = `✦ 心悟連貫！${COMBO_LABELS[lean]} +1`;
    el.classList.remove('hidden');
    AudioManager.play('unlock');
    setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function showLoreToast(lore) {
    const el = document.getElementById('lore-toast');
    if (!el) return;
    el.innerHTML = `📜 掌故解鎖：<strong>${lore.title}</strong>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function showLevelFlash(levelName) {
    const el = document.getElementById('level-flash');
    if (!el) return;
    el.textContent = `✓ ${levelName} 已畢`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 1400);
  }

  function tryUnlockLore() {
    const newLore = Retention.checkAndUnlockLore(state);
    if (newLore.length > 0) showLoreToast(newLore[0]);
    return newLore;
  }

  function showEncounter(encounter) {
    const overlay = document.getElementById('encounter-overlay');
    document.getElementById('encounter-scene').textContent = encounter.scene;
    document.getElementById('encounter-text').textContent = encounter.text;
    const choicesEl = document.getElementById('encounter-choices');
    choicesEl.innerHTML = '';

    encounter.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `
        <span class="choice-label">${choice.label}</span>
        <span class="choice-effects">${formatEffectPreview(choice.effects)}</span>
      `;
      btn.addEventListener('click', () => {
        AudioManager.play('choice');
        applyEffects(choice.effects);
        const combo = processCombo(choice.effects);
        if (combo?.bonus) {
          applyEffects(combo.bonus);
          showComboToast(combo.lean);
        }
        tryUnlockLore();
        state.encounterIds.push(encounter.id);
        state.history.push({ id: encounter.id, label: `際遇·${choice.label}`, level: '途中' });
        overlay.classList.add('hidden');
        renderMap();
        persistSave('map');
        showScreen('map');
      });
      choicesEl.appendChild(btn);
    });

    overlay.classList.remove('hidden');
    AudioManager.play('transition');
  }

  function maybeShowEncounter(afterLevel) {
    if (afterLevel.id === 1 || afterLevel.id >= 4) return false;
    if (Math.random() > 0.38) return false;
    const enc = pickRandomEncounter(state.encounterIds);
    showEncounter(enc);
    return true;
  }

  function updateHomeUI() {
    Retention.renderMetaPanel(document.getElementById('home-meta'));
    Retention.renderEndingCodex(document.getElementById('home-codex'));
    Retention.renderDailyChallenge(document.getElementById('home-daily'));
    Retention.renderLoreCodex(document.getElementById('home-lore'), true);
    renderHomeAchievements();

    const continueBtn = document.getElementById('btn-continue-save');
    const save = Retention.loadGame();
    if (save) {
      continueBtn.classList.remove('hidden');
      continueBtn.title = save.cliffhanger;
    } else {
      continueBtn.classList.add('hidden');
    }

    const hookEl = document.getElementById('home-hook');
    const hook = Retention.getHookMessage();
    if (hook && hook.type !== 'save') {
      hookEl.textContent = hook.text;
      hookEl.className = `home-hook home-hook-${hook.type}`;
      hookEl.classList.remove('hidden');
    } else if (save) {
      hookEl.textContent = save.cliffhanger;
      hookEl.className = 'home-hook home-hook-save';
      hookEl.classList.remove('hidden');
    } else {
      hookEl.classList.add('hidden');
    }
  }

  function recordChoice(choiceId, label, levelName) {
    if (choiceId) state.flags[choiceId] = true;
    state.history.push({
      id: choiceId,
      label: CHOICE_LABELS[choiceId] || label,
      level: levelName
    });
  }

  function renderMap() {
    activeLevels = getActiveLevels();
    const path = document.getElementById('map-path');
    path.innerHTML = '';

    activeLevels.forEach((level, index) => {
      const isCompleted = state.completedLevels.includes(level.id);
      const isCurrent = index === state.currentLevel;

      const node = document.createElement('button');
      node.className = 'map-node';
      if (isCompleted) node.classList.add('completed');
      if (isCurrent) node.classList.add('current');
      if (index > state.currentLevel) node.classList.add('locked');

      const routeTag = index === 1 && state.route
        ? `<span class="map-route-tag">${state.route === 'city' ? '入城線' : '登山線'}</span>`
        : '';

      node.innerHTML = `
        <span class="map-scene">${level.scene}</span>
        <span class="map-num">第 ${index + 1} 站</span>
        <span class="map-loc">${level.location}·${level.name}</span>
        ${routeTag}
        ${isCompleted ? '<span class="map-check">✓</span>' : ''}
      `;

      if (isCurrent) {
        node.addEventListener('click', () => {
          AudioManager.play('click');
          startLevel(index);
        });
      }

      path.appendChild(node);

      if (index < activeLevels.length - 1) {
        const connector = document.createElement('div');
        connector.className = 'map-connector';
        if (isCompleted) connector.classList.add('completed');
        path.appendChild(connector);
      }
    });

    updateResourceDisplay('map');
    const hint = document.getElementById('map-hint');
    if (state.currentLevel >= activeLevels.length) {
      hint.textContent = '旅程已盡';
    } else {
      const lv = activeLevels[state.currentLevel];
      hint.textContent = `點選「${lv.location}·${lv.name}」以繼續旅程`;
    }
  }

  function startLevel(levelIndex) {
    state.currentLevel = levelIndex;
    state.currentEvent = 0;
    state.itemUsedThisLevel = false;
    showEvent();
  }

  function renderItemsBar() {
    const bar = document.getElementById('items-bar');
    if (!bar) return;
    bar.innerHTML = '';

    ITEMS.forEach((item) => {
      const available = state.items[item.id];
      const btn = document.createElement('button');
      btn.className = 'item-btn';
      btn.title = item.desc;
      if (!available) btn.classList.add('depleted');
      if (state.itemUsedThisLevel) btn.classList.add('disabled');
      btn.innerHTML = `<span class="item-icon">${item.icon}</span><span class="item-name">${item.name}</span>`;
      btn.disabled = !available || state.itemUsedThisLevel;
      btn.addEventListener('click', () => useItem(item));
      bar.appendChild(btn);
    });
  }

  function useItem(item) {
    if (!state.items[item.id] || state.itemUsedThisLevel || state.awaitingFeedback) return;
    AudioManager.play('unlock');
    state.items[item.id] = false;
    state.itemUsedThisLevel = true;
    applyEffects(item.effect);
    AudioManager.playChoiceEffects(item.effect);

    const toast = document.getElementById('item-toast');
    if (toast) {
      toast.textContent = `使用${item.name}：${item.desc}`;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2000);
    }
    renderItemsBar();
  }

  function renderNpcFlip(npcFlip) {
    const container = document.getElementById('npc-flip');
    if (!container) return;

    if (!npcFlip || state.officialFlipped) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');
    const canFlip = meetsRequirement(npcFlip.flipRequires);

    container.innerHTML = `
      <div class="npc-card ${canFlip ? 'can-flip' : ''}" id="npc-card">
        <div class="npc-face front">
          <span class="npc-badge qing">清</span>
          <strong>${npcFlip.name}</strong>
          <p>${npcFlip.front.desc}</p>
        </div>
        <div class="npc-face back">
          <span class="npc-badge ku">酷</span>
          <strong>${npcFlip.name}</strong>
          <p>${npcFlip.back.desc}</p>
        </div>
      </div>
      ${canFlip
        ? '<button class="btn-flip" id="btn-flip-npc">翻開真面目（洞察已足）</button>'
        : `<p class="flip-hint">洞察 ≥ ${npcFlip.flipRequires.dong} 可翻面識破</p>`}
    `;

    if (canFlip) {
      document.getElementById('btn-flip-npc').addEventListener('click', () => {
        AudioManager.play('unlock');
        state.officialFlipped = true;
        state.flags.officialFlipped = true;
        applyEffects({ dong: 1 });
        const card = document.getElementById('npc-card');
        card.classList.add('flipped');
        document.getElementById('btn-flip-npc')?.remove();
        setTimeout(() => {
          container.querySelector('.flip-hint')?.remove();
        }, 600);
      });
    }
  }

  function showEvent() {
    activeLevels = getActiveLevels();
    const level = activeLevels[state.currentLevel];
    const event = level.events[state.currentEvent];

    document.getElementById('level-badge').textContent = `第 ${state.currentLevel + 1} 站`;
    document.getElementById('level-name').textContent = `${level.location}·${level.name}`;
    document.getElementById('event-source').textContent = level.source;
    document.getElementById('event-scene').textContent = level.scene;
    document.getElementById('event-text').textContent = resolveText(event.text, state.flags);

    renderNpcFlip(event.npcFlip);
    renderItemsBar();

    const choicesEl = document.getElementById('choices');
    choicesEl.innerHTML = '';
    choicesEl.classList.remove('hidden');

    event.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';

      const locked = choice.requires && !meetsRequirement(choice.requires);

      if (locked) {
        btn.classList.add('locked');
        btn.disabled = true;
        const reqText = Object.entries(choice.requires)
          .map(([k, v]) => `${STAT_NAMES[k]} ≥ ${v}`)
          .join('、');
        btn.innerHTML = `
          <span class="choice-label">${choice.label}</span>
          <span class="choice-req">需要：${reqText}</span>
          ${formatEffectPreview(choice.effects)}
        `;
      } else {
        const hasReq = choice.requires;
        const silverHint = choice.silverUnlock ? '<span class="choice-silver">🪙 銀兩可助</span>' : '';
        btn.innerHTML = `
          <span class="choice-label">${choice.label}</span>
          ${hasReq ? '<span class="choice-unlocked">✦ 已解鎖</span>' : ''}
          ${silverHint}
          <span class="choice-effects">${formatEffectPreview(choice.effects)}</span>
        `;
        if (hasReq) btn.classList.add('unlocked-choice');
        btn.addEventListener('click', () => selectChoice(choice, hasReq, level.name));
      }

      choicesEl.appendChild(btn);
    });

    document.getElementById('feedback').classList.add('hidden');
    document.getElementById('item-toast')?.classList.add('hidden');
    state.awaitingFeedback = false;
    updateResourceDisplay();
    renderFateTracker();
    renderComboBar();
    persistSave('event');
    showScreen('event');
  }

  function showBranch() {
    document.getElementById('branch-text').textContent = BRANCH_CHOICE.text;
    document.getElementById('branch-feedback-wrap').classList.add('hidden');
    document.getElementById('branch-feedback').textContent = '';
    const choicesEl = document.getElementById('branch-choices');
    choicesEl.classList.remove('hidden');
    choicesEl.innerHTML = '';

    BRANCH_CHOICE.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn branch-choice';
      btn.innerHTML = `
        <span class="choice-label">${choice.label}</span>
        <span class="choice-route">${choice.route === 'city' ? '路線：城內 → 泰山' : '路線：泰山 → 城內'}</span>
      `;
      btn.addEventListener('click', () => selectBranch(choice));
      choicesEl.appendChild(btn);
    });

    showScreen('branch');
  }

  function selectBranch(choice) {
    AudioManager.play('choice');
    state.route = choice.route;
    state.flags.route = choice.route;
    state.flags[choice.id] = true;
    state.history.push({
      id: choice.id,
      label: CHOICE_LABELS[choice.id] || choice.label,
      level: '岔路'
    });

    document.getElementById('branch-feedback').textContent = choice.feedback;
    document.getElementById('branch-feedback-wrap').classList.remove('hidden');
    document.getElementById('branch-choices').classList.add('hidden');

    document.getElementById('btn-branch-continue').onclick = () => {
      AudioManager.play('click');
      state.needBranch = false;
      state.currentLevel = 1;
      renderMap();
      persistSave('map');
      showScreen('map');
    };
    persistSave('branch');
  }

  function meetsRequirement(requires) {
    return Object.entries(requires).every(([key, val]) => state[key] >= val);
  }

  function selectChoice(choice, wasUnlocked, levelName) {
    if (state.awaitingFeedback) return;

    AudioManager.play('choice');
    if (wasUnlocked) AudioManager.play('unlock');

    recordChoice(choice.id, choice.label, levelName);
    applyEffects(choice.effects);
    const combo = processCombo(choice.effects);
    if (combo?.bonus) {
      applyEffects(combo.bonus);
      showComboToast(combo.lean);
    }
    tryUnlockLore();
    AudioManager.playChoiceEffects(choice.effects);

    const trajectory = getEndingTrajectory(state);
    const fateHint = trajectory[0]
      ? `\n\n【命途】目前正趨向「${trajectory[0].title}」（${Math.round(trajectory[0].score)}%）`
      : '';

    document.getElementById('choices').classList.add('hidden');
    document.getElementById('npc-flip')?.classList.add('hidden');
    document.getElementById('feedback-text').textContent = choice.feedback + fateHint;
    document.getElementById('feedback').classList.remove('hidden');
    renderFateTracker();
    state.awaitingFeedback = true;
    persistSave('event');

    setTimeout(() => AudioManager.play('feedback'), 150);
  }

  function continueAfterFeedback() {
    AudioManager.play('click');
    activeLevels = getActiveLevels();
    const level = activeLevels[state.currentLevel];
    state.currentEvent += 1;

    if (state.currentEvent < level.events.length) {
      showEvent();
      return;
    }

    if (!state.completedLevels.includes(level.id)) {
      state.completedLevels.push(level.id);
    }

    AudioManager.play('levelComplete');
    showLevelFlash(`${level.location}·${level.name}`);

    if (level.id === 1 && !state.route) {
      state.needBranch = true;
      showBranch();
      return;
    }

    state.currentLevel += 1;

    if (state.currentLevel >= activeLevels.length) {
      showEnding();
    } else {
      renderMap();
      persistSave('map');
      showScreen('map');
      setTimeout(() => {
        if (!maybeShowEncounter(level)) return;
      }, 800);
    }
  }

  function determineEnding() {
    const snapshot = { ...state, flags: state.flags };
    for (const ending of ENDINGS) {
      if (ending.id !== 'jianghu' && ending.condition(snapshot)) {
        return ending;
      }
    }
    return ENDINGS.find((e) => e.id === 'jianghu');
  }

  function saveEndingSeen(endingId) {
    try {
      const seen = JSON.parse(localStorage.getItem(ENDINGS_KEY) || '[]');
      if (!seen.includes(endingId)) {
        seen.push(endingId);
        localStorage.setItem(ENDINGS_KEY, JSON.stringify(seen));
      }
    } catch (_) { /* ignore */ }
  }

  function checkAchievements(endingId) {
    state.endingId = endingId;
    const unlocked = [];
    ACHIEVEMENTS.forEach((ach) => {
      if (ach.check(state)) unlocked.push(ach);
    });

    try {
      const saved = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]');
      const ids = new Set(saved);
      unlocked.forEach((a) => ids.add(a.id));
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...ids]));
    } catch (_) { /* ignore */ }

    return unlocked;
  }

  function getSavedAchievements() {
    try {
      const ids = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]');
      return ACHIEVEMENTS.filter((a) => ids.includes(a.id));
    } catch {
      return [];
    }
  }

  function renderJourneyRecap() {
    const el = document.getElementById('journey-recap');
    if (!el) return;

    const routeLabel = state.route === 'city' ? '入城查案線' : state.route === 'mountain' ? '先遊泰山線' : '';
    let html = routeLabel ? `<p class="recap-route">所選路線：<strong>${routeLabel}</strong></p>` : '';
    html += '<ul class="recap-list">';
    state.history.forEach((h) => {
      html += `<li>${h.label}</li>`;
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  function renderNearMiss() {
    const el = document.getElementById('ending-nearmiss');
    if (!el) return;
    const hints = Retention.getNearMissHint(state);
    if (hints.length === 0) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = `
      <h3 class="nearmiss-title">未竟之業 · 下回再探</h3>
      <ul class="nearmiss-list">
        ${hints.map((h) => `<li><strong>${h.ending}</strong>：${h.tip}</li>`).join('')}
      </ul>
    `;
  }

  function renderAchievements(unlocked) {
    const el = document.getElementById('ending-achievements');
    if (!el) return;

    if (unlocked.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <h3 class="achievements-title">本次解鎖成就</h3>
      <div class="achievements-grid">
        ${unlocked.map((a) => `
          <div class="achievement-card new">
            <span class="achievement-icon">🏅</span>
            <strong>${a.title}</strong>
            <p>${a.desc}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  function showEnding() {
    const ending = determineEnding();
    state.endingId = ending.id;
    saveEndingSeen(ending.id);
    const newAchievements = checkAchievements(ending.id);

    const titleEl = document.getElementById('ending-title');
    titleEl.textContent = ending.title;
    titleEl.classList.toggle('hidden-ending', !!ending.hidden);

    document.getElementById('ending-desc').textContent = ending.desc;
    document.getElementById('ending-quote').textContent = ending.quote;

    document.getElementById('ending-stats').innerHTML = `
      <div class="stat-row"><span class="res-icon ren">仁</span> 仁心：<strong>${state.ren}</strong></div>
      <div class="stat-row"><span class="res-icon dong">察</span> 洞察：<strong>${state.dong}</strong></div>
      <div class="stat-row"><span class="res-icon ming">名</span> 名聲：<strong>${state.ming}</strong></div>
    `;

    renderJourneyRecap();
    renderAchievements(newAchievements);
    renderNearMiss();
    Retention.renderEndingCodex(document.getElementById('ending-codex'));

    const dailyEl = document.getElementById('ending-daily-result');
    const daily = Retention.getDailyChallenge();
    const dailyOk = daily.check(state);
    if (dailyOk && !Retention.isDailyChallengeCompleted()) {
      Retention.completeDailyChallenge();
      dailyEl.classList.remove('hidden');
      dailyEl.innerHTML = `<p>📋 今日試煉「${daily.title}」完成！</p>`;
      AudioManager.play('unlock');
    } else if (Retention.isDailyChallengeCompleted()) {
      dailyEl.classList.remove('hidden');
      dailyEl.innerHTML = `<p>📋 今日試煉已完成</p>`;
    } else {
      dailyEl.classList.remove('hidden');
      dailyEl.innerHTML = `<p>📋 今日試煉「${daily.title}」未達成：${daily.desc}</p>`;
    }

    const newLore = Retention.checkAndUnlockLore(state);
    const loreEl = document.getElementById('ending-lore-new');
    if (newLore.length > 0) {
      loreEl.classList.remove('hidden');
      loreEl.innerHTML = `<p>📜 新解鎖掌故：${newLore.map((l) => l.title).join('、')}</p>`;
    } else {
      loreEl.classList.add('hidden');
    }

    if (state.maxCombo >= 3) {
      const comboNote = document.createElement('p');
      comboNote.className = 'ending-combo-note';
      comboNote.textContent = `本局最高連擊：${state.maxCombo} 連貫`;
      document.getElementById('ending-stats')?.appendChild(comboNote);
    }

    Retention.recordPlayComplete(ending.id);
    Retention.clearSave();
    updateHomeUI();

    const unseen = Retention.getUnseenEndings();
    const restartBtn = document.querySelector('[data-action="restart"]');
    if (restartBtn && unseen.length > 0) {
      restartBtn.textContent = unseen.some((e) => e.hidden)
        ? '再探一局（追隱藏結局）'
        : `再探一局（尚有 ${unseen.length} 結局）`;
    }

    showScreen('ending');
    setTimeout(() => AudioManager.play(ending.hidden ? 'unlock' : 'ending'), 300);
  }

  function renderHomeAchievements() {
    const el = document.getElementById('home-achievements');
    if (!el) return;
    const saved = getSavedAchievements();
    if (saved.length === 0) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = `
      <p class="home-achievements-label">已解鎖成就 ${saved.length} / ${ACHIEVEMENTS.length}</p>
      <div class="home-achievements-list">
        ${saved.map((a) => `<span class="ach-badge" title="${a.desc}">${a.title}</span>`).join('')}
      </div>
    `;
  }

  function beginGame(isNew = true) {
    if (isNew) {
      Retention.clearSave();
      resetGame();
      const { streakBonus, streak } = Retention.recordDailyVisit();
      const bonusText = applyStreakBonus(streakBonus);
      if (bonusText) {
        showStreakToast(`🔥 連日遊記第 ${streak} 日：開局 ${bonusText}`);
      }
    }
    renderMap();
    persistSave('map');
    showScreen('map');
  }

  function continueSavedGame() {
    const save = Retention.loadGame();
    if (!save) return;
    AudioManager.play('click');
    state = { ...createInitialState(), ...save.state };
    state.officialFlipped = save.state.officialFlipped || false;
    activeLevels = getActiveLevels();
    updateResourceDisplay();
    updateResourceDisplay('map');

    const screen = save.screen || 'map';
    if (screen === 'event') {
      showEvent();
    } else if (screen === 'branch') {
      showBranch();
    } else {
      renderMap();
      showScreen('map');
    }
  }

  function tryStartGame() {
    AudioManager.play('click');
    if (Retention.hasSave()) {
      const ok = confirm('開始新旅程將覆蓋途中存檔。確定要重新出發嗎？');
      if (!ok) return;
    }
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      pendingStart = true;
      document.getElementById('tutorial-overlay').classList.remove('hidden');
      return;
    }
    beginGame(true);
  }

  function tryContinueGame() {
    if (!Retention.hasSave()) return;
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      beginGame(false);
      continueSavedGame();
      return;
    }
    continueSavedGame();
  }

  function openRules(fromScreen) {
    rulesReturnScreen = fromScreen;
    AudioManager.play('click');
    showScreen('rules');
  }

  function closeRules() {
    AudioManager.play('click');
    showScreen(rulesReturnScreen);
  }

  function renderSettingsStats() {
    const el = document.getElementById('settings-stats');
    if (!el) return;
    const rank = Retention.getTravelRank();
    const endings = Retention.getSeenEndings().length;
    const achievements = getSavedAchievements().length;
    const lore = Retention.getUnlockedLore().length;
    const hasSave = Retention.hasSave();
    const meta = JSON.parse(localStorage.getItem('laocan_meta') || '{}');

    el.innerHTML = `
      <li>閱歷稱號：<strong>${rank.title}</strong>（通關 ${rank.plays} 次）</li>
      <li>連日遊記：<strong>${meta.streak || 0}</strong> 天</li>
      <li>結局圖鑑：<strong>${endings} / ${ENDINGS.length}</strong></li>
      <li>成就：<strong>${achievements} / ${ACHIEVEMENTS.length}</strong></li>
      <li>掌故：<strong>${lore} / ${LORE_SNIPPETS.length}</strong></li>
      <li>途中存檔：<strong>${hasSave ? '有' : '無'}</strong></li>
      <li>遊記完成度：<strong>${Retention.getCompletionPercent()}%</strong></li>
    `;
  }

  function openSettings() {
    AudioManager.play('click');
    renderSettingsStats();
    showScreen('settings');
  }

  function resetAllProgress() {
    const msg = '確定要重置全部進度嗎？\n\n將清除：途中存檔、結局、成就、掌故、連日遊記、今日試煉與教學紀錄。\n\n此操作無法復原。';
    if (!confirm(msg)) return;
    if (!confirm('最後確認：真的要全部重置嗎？')) return;

    AudioManager.play('click');
    Retention.resetAllProgress();
    resetGame();
    updateHomeUI();
    AudioManager.init();
    showStreakToast('已重置全部進度，一切從頭開始。');
    showScreen('home');
  }

  function initRulesTabs() {
    const tabs = document.querySelectorAll('.rules-tab');
    const panes = document.querySelectorAll('.rules-pane');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        AudioManager.play('click');
        const target = tab.dataset.tab;
        tabs.forEach((t) => t.classList.remove('active'));
        panes.forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`pane-${target}`)?.classList.add('active');
      });
    });
  }

  function initTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    const soundCheck = document.getElementById('tutorial-sound');

    document.getElementById('btn-tutorial-start').addEventListener('click', () => {
      AudioManager.play('click');
      const wantSound = soundCheck.checked;
      if (wantSound && !AudioManager.isEnabled()) AudioManager.toggle();
      if (!wantSound && AudioManager.isEnabled()) AudioManager.toggle();
      if (wantSound) AudioManager.startAmbient();
      localStorage.setItem(TUTORIAL_KEY, '1');
      overlay.classList.add('hidden');
      if (pendingStart) {
        pendingStart = false;
        beginGame(true);
      }
    });
  }

  function bindActions() {
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'start':
            tryStartGame();
            break;
          case 'continue-save':
            tryContinueGame();
            break;
          case 'rules':
            openRules('home');
            break;
          case 'settings':
            openSettings();
            break;
          case 'settings-back':
            AudioManager.play('click');
            updateHomeUI();
            showScreen('home');
            break;
          case 'rules-back':
            closeRules();
            break;
          case 'back-home':
            AudioManager.play('click');
            updateHomeUI();
            showScreen('home');
            break;
          case 'restart':
            AudioManager.play('click');
            beginGame(true);
            break;
        }
      });
    });

    document.getElementById('btn-help').addEventListener('click', () => {
      const current = Object.entries(SCREENS).find(([, el]) => el.classList.contains('active'));
      openRules(current ? current[0] : 'map');
    });

    document.getElementById('btn-continue').addEventListener('click', continueAfterFeedback);
    document.getElementById('btn-reset-all').addEventListener('click', resetAllProgress);
  }

  AudioManager.init();
  initRulesTabs();
  initTutorial();
  bindActions();
  updateHomeUI();
})();
