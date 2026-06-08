const Retention = (function () {
  'use strict';

  const META_KEY = 'laocan_meta';
  const SAVE_KEY = 'laocan_save';
  const LORE_KEY = 'laocan_lore';
  const DAILY_CHALLENGE_KEY = 'laocan_daily_challenge';

  const ALL_STORAGE_KEYS = [
    SAVE_KEY,
    META_KEY,
    'laocan_endings',
    'laocan_achievements',
    LORE_KEY,
    DAILY_CHALLENGE_KEY,
    'laocan_tutorial_seen',
    'laocan_sound'
  ];

  const RANKS = [
    { minPlays: 0, title: '初來乍到', desc: '剛踏上老殘之路' },
    { minPlays: 1, title: '一行腳', desc: '完成首次遊記' },
    { minPlays: 2, title: '兩袖風塵', desc: '江湖路漸熟' },
    { minPlays: 3, title: '熟讀世道', desc: '已歷數番風波' },
    { minPlays: 5, title: '老於江湖', desc: '見慣官場百態' },
    { minPlays: 8, title: '遊記圓滿', desc: '閱盡世情' }
  ];

  const ENDING_HINTS = {
    fachongguan: '仁、察、名皆滿，且黑龍潭夜遁救人',
    xiayi: '仁心與洞察均 ≥ 4',
    mingshi: '名聲 ≥ 4，仁心 ≤ 2',
    wuru: '洞察 ≤ 1（輕信清官）',
    piaoran: '仁、察、名皆 ≤ 2',
    jianghu: '其餘中庸路線'
  };

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function getDefaultMeta() {
    return {
      streak: 0,
      lastVisit: null,
      totalPlays: 0,
      dailyBonusClaimed: null
    };
  }

  function ensureMeta() {
    const meta = { ...getDefaultMeta(), ...getMeta() };
    saveMeta(meta);
    return meta;
  }

  function recordDailyVisit() {
    const meta = ensureMeta();
    const today = todayStr();
    let streakBonus = null;
    let isNewDay = meta.lastVisit !== today;

    if (isNewDay) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      if (meta.lastVisit === yStr) {
        meta.streak += 1;
      } else if (meta.lastVisit !== today) {
        meta.streak = 1;
      }
      meta.lastVisit = today;
      saveMeta(meta);
    }

    const bonusNotClaimed = meta.dailyBonusClaimed !== today;
    if (bonusNotClaimed && meta.streak >= 2) {
      streakBonus = { ren: meta.streak >= 5 ? 1 : 0, dong: meta.streak >= 3 ? 1 : 0, ming: meta.streak >= 7 ? 1 : 0 };
      if (meta.streak >= 2 && !streakBonus.ren && !streakBonus.dong && !streakBonus.ming) {
        streakBonus.ren = 1;
      }
      meta.dailyBonusClaimed = today;
      saveMeta(meta);
    }

    return { streak: meta.streak, isNewDay, streakBonus: bonusNotClaimed ? streakBonus : null, meta };
  }

  function recordPlayComplete(endingId) {
    const meta = ensureMeta();
    meta.totalPlays = (meta.totalPlays || 0) + 1;
    saveMeta(meta);
    return meta;
  }

  function getTravelRank() {
    const meta = ensureMeta();
    const plays = meta.totalPlays || 0;
    let rank = RANKS[0];
    for (const r of RANKS) {
      if (plays >= r.minPlays) rank = r;
    }
    const endings = getSeenEndings();
    if (endings.length >= ENDINGS.length) {
      rank = RANKS[RANKS.length - 1];
    }
    return { ...rank, plays, endingsCount: endings.length };
  }

  function getSeenEndings() {
    try {
      return JSON.parse(localStorage.getItem('laocan_endings') || '[]');
    } catch {
      return [];
    }
  }

  function getUnseenEndings() {
    const seen = new Set(getSeenEndings());
    return ENDINGS.filter((e) => !seen.has(e.id));
  }

  function getCompletionPercent() {
    const seen = getSeenEndings().length;
    const ach = (() => {
      try {
        return JSON.parse(localStorage.getItem('laocan_achievements') || '[]').length;
      } catch { return 0; }
    })();
    const endingPart = (seen / ENDINGS.length) * 60;
    const achPart = (ach / ACHIEVEMENTS.length) * 40;
    return Math.round(endingPart + achPart);
  }

  function saveGame(state, screenName) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        state,
        screen: screenName,
        savedAt: Date.now(),
        cliffhanger: buildCliffhanger(state)
      }));
    } catch (_) { /* ignore */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function hasSave() {
    return !!loadGame();
  }

  function buildCliffhanger(state) {
    if (!state.route && state.completedLevels.includes(1)) {
      return '岔路在前：入城或登山，尚未抉擇……';
    }
    const levels = state.route ? buildLevelOrder(state.route) : [];
    const lv = levels[state.currentLevel];
    if (lv) {
      const names = { 4: '黑龍潭冤案未平', 2: '城內風波未了', 3: '泰山雲海待賞' };
      if (names[lv.id]) return `${names[lv.id]}，遊記半途……`;
      return `「${lv.location}·${lv.name}」途中，尚有未竟之事……`;
    }
    return '遊記半途，尚有未竟之事……';
  }

  function getNearMissHint(stats) {
    const hints = [];
    const s = { ren: stats.ren, dong: stats.dong, ming: stats.ming, flags: stats.flags || {} };

    if (s.ren >= 3 && s.dong >= 3 && !s.flags.l4_rescue) {
      hints.push({ ending: '俠醫之名', tip: `仁心或洞察再 +1 即有機會（目前仁${s.ren} 察${s.dong}）` });
    }
    if (s.ren < 4 && s.dong < 4 && s.ren >= 3) {
      hints.push({ ending: '俠醫之名', tip: '再多一點仁心與洞察即可' });
    }
    if (s.ming >= 3 && s.ren > 2) {
      hints.push({ ending: '名士老殘', tip: '若再忽視仁心、追求名聲，可走此路' });
    }
    if (s.dong >= 2) {
      hints.push({ ending: '誤入官場', tip: '下回若輕信「清官」、選相信清名，洞察將歸零' });
    }
    if (!s.flags.l4_rescue && s.ren >= 4) {
      hints.push({ ending: '髮衝冠', tip: '隱藏結局：三資源皆滿 5 且黑龍潭夜遁救人' });
    }

    const unseen = getUnseenEndings().slice(0, 2);
    unseen.forEach((e) => {
      if (!hints.find((h) => h.ending === e.title)) {
        hints.push({ ending: e.title, tip: ENDING_HINTS[e.id] || '再探一局試試' });
      }
    });

    return hints.slice(0, 3);
  }

  function getHookMessage() {
    const unseen = getUnseenEndings();
    const save = loadGame();
    const meta = ensureMeta();
    const messages = [];

    if (save) {
      messages.push({ type: 'save', text: save.cliffhanger, priority: 10 });
    }
    if (unseen.length > 0) {
      const hidden = unseen.find((e) => e.hidden);
      if (hidden) {
        messages.push({ type: 'hidden', text: `尚有隱藏結局「${hidden.title}」未揭開……`, priority: 9 });
      } else {
        messages.push({ type: 'ending', text: `尚有 ${unseen.length} 種結局未親歷`, priority: 7 });
      }
    }
    if (meta.streak >= 2) {
      messages.push({ type: 'streak', text: `連日遊記第 ${meta.streak} 日——今日首局有加成`, priority: 5 });
    }

    messages.sort((a, b) => b.priority - a.priority);
    return messages[0] || null;
  }

  function renderEndingCodex(container) {
    if (!container) return;
    const seen = new Set(getSeenEndings());
    container.innerHTML = `
      <h3 class="codex-title">結局圖鑑</h3>
      <div class="codex-grid">
        ${ENDINGS.map((e) => `
          <div class="codex-slot ${seen.has(e.id) ? 'unlocked' : 'locked'} ${e.hidden ? 'hidden-slot' : ''}">
            <span class="codex-icon">${seen.has(e.id) ? '📜' : '？'}</span>
            <span class="codex-name">${seen.has(e.id) ? e.title : '未揭'}</span>
          </div>
        `).join('')}
      </div>
      <p class="codex-progress">收集 ${seen.size} / ${ENDINGS.length}</p>
    `;
  }

  function renderMetaPanel(container) {
    if (!container) return;
    const rank = getTravelRank();
    const pct = getCompletionPercent();
    const meta = ensureMeta();
    const hook = getHookMessage();

    container.innerHTML = `
      <div class="meta-rank">
        <span class="meta-rank-title">${rank.title}</span>
        <span class="meta-rank-desc">${rank.desc} · 通關 ${rank.plays} 次</span>
      </div>
      ${meta.streak >= 2 ? `<div class="meta-streak">🔥 連日遊記 <strong>${meta.streak}</strong> 天</div>` : ''}
      <div class="meta-progress-wrap">
        <div class="meta-progress-label"><span>遊記完成度</span><span>${pct}%</span></div>
        <div class="meta-progress-bar"><div class="meta-progress-fill" style="width:${pct}%"></div></div>
      </div>
      ${hook ? `<p class="meta-hook meta-hook-${hook.type}">${hook.text}</p>` : ''}
    `;
  }

  function resetAllProgress() {
    ALL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    return true;
  }

  function getUnlockedLore() {
    try {
      return JSON.parse(localStorage.getItem(LORE_KEY) || '[]');
    } catch { return []; }
  }

  function unlockLore(id) {
    const ids = getUnlockedLore();
    if (ids.includes(id)) return false;
    ids.push(id);
    localStorage.setItem(LORE_KEY, JSON.stringify(ids));
    return true;
  }

  function checkAndUnlockLore(state) {
    const newly = [];
    LORE_SNIPPETS.forEach((lore) => {
      const flagOk = lore.flag && state.flags?.[lore.flag];
      const extraOk = lore.extra ? lore.extra(state) : true;
      if (flagOk && extraOk && unlockLore(lore.id)) {
        newly.push(lore);
      }
    });
    return newly;
  }

  function getDailyChallenge() {
    const today = todayStr();
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_CHALLENGE_KEY) || '{}');
      if (saved.date === today) return saved.challenge;
    } catch { /* ignore */ }
    const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_CHALLENGES.length;
    const challenge = DAILY_CHALLENGES[dayIndex];
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify({ date: today, challenge, completed: false }));
    return challenge;
  }

  function isDailyChallengeCompleted() {
    const today = todayStr();
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_CHALLENGE_KEY) || '{}');
      return saved.date === today && saved.completed;
    } catch { return false; }
  }

  function completeDailyChallenge() {
    const today = todayStr();
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_CHALLENGE_KEY) || '{}');
      if (saved.date === today) {
        saved.completed = true;
        localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify(saved));
      }
    } catch { /* ignore */ }
  }

  function renderDailyChallenge(container) {
    if (!container) return;
    const ch = getDailyChallenge();
    const done = isDailyChallengeCompleted();
    container.innerHTML = `
      <div class="daily-challenge ${done ? 'completed' : ''}">
        <span class="daily-label">📋 今日試煉</span>
        <strong>${ch.title}</strong>
        <span class="daily-desc">${ch.desc}</span>
        ${done ? '<span class="daily-done">✓ 已完成</span>' : '<span class="daily-pending">通關即可挑戰</span>'}
      </div>
    `;
  }

  function renderLoreCodex(container, compact = false) {
    if (!container) return;
    const unlocked = new Set(getUnlockedLore());
    const items = LORE_SNIPPETS.filter((l) => unlocked.has(l.id));
    if (items.length === 0 && compact) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
      <h3 class="codex-title">掌故圖鑑 ${unlocked.size}/${LORE_SNIPPETS.length}</h3>
      <div class="lore-list">
        ${LORE_SNIPPETS.map((l) => `
          <div class="lore-item ${unlocked.has(l.id) ? 'unlocked' : 'locked'}">
            <strong>${unlocked.has(l.id) ? l.title : '？？？'}</strong>
            <p>${unlocked.has(l.id) ? l.text : '遊歷中觸發關鍵抉擇以解鎖'}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  return {
    recordDailyVisit,
    recordPlayComplete,
    getTravelRank,
    getSeenEndings,
    getUnseenEndings,
    getCompletionPercent,
    saveGame,
    loadGame,
    clearSave,
    hasSave,
    getNearMissHint,
    getHookMessage,
    renderEndingCodex,
    renderMetaPanel,
    buildCliffhanger,
    checkAndUnlockLore,
    getUnlockedLore,
    getDailyChallenge,
    isDailyChallengeCompleted,
    completeDailyChallenge,
    renderDailyChallenge,
    renderLoreCodex,
    resetAllProgress
  };
})();
