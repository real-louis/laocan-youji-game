const INITIAL_STATS = { ren: 3, dong: 3, ming: 3 };

const STAT_LABELS = { ren: '仁', dong: '察', ming: '名' };
const STAT_NAMES = { ren: '仁心', dong: '洞察', ming: '名聲' };

const ITEMS = [
  {
    id: 'medkit',
    name: '醫箱',
    icon: '⚕️',
    desc: '以醫術濟人，仁心 +1',
    effect: { ren: 1 },
    oncePerGame: true
  },
  {
    id: 'poem',
    name: '詩箋',
    icon: '📜',
    desc: '以詩名世，名聲 +1',
    effect: { ming: 1 },
    oncePerGame: true
  },
  {
    id: 'silver',
    name: '銀兩',
    icon: '🪙',
    desc: '打點疏通，洞察 +1',
    effect: { dong: 1 },
    oncePerGame: true
  }
];

const ACHIEVEMENTS = [
  { id: 'minghu', title: '明湖聽雨', desc: '大明湖選擇泛舟賞月', check: (s) => s.flags.l1_moon },
  { id: 'shipo', title: '識破清官', desc: '洞察曾達 5', check: (s) => s.peak.dong >= 5 },
  { id: 'hukou', title: '虎口救人', desc: '黑龍潭選擇冒險夜遁', check: (s) => s.flags.l4_rescue },
  { id: 'fanmian', title: '清官翻面', desc: '識破縣令真面目', check: (s) => s.flags.officialFlipped },
  { id: 'rucheng', title: '入城查案', desc: '選擇入城路線', check: (s) => s.route === 'city' },
  { id: 'dengshan', title: '先遊泰山', desc: '選擇登山路線', check: (s) => s.route === 'mountain' },
  { id: 'yinxing', title: '髮衝冠', desc: '達成隱藏結局', check: (s) => s.endingId === 'fachongguan' },
  { id: 'quanjieju', title: '博聞廣記', desc: '解鎖過 4 種以上結局', check: () => {
    try {
      const seen = JSON.parse(localStorage.getItem('laocan_endings') || '[]');
      return seen.length >= 4;
    } catch { return false; }
  }}
];

function formatEffectPreview(effects) {
  if (!effects) return '';
  return Object.entries(effects)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => {
      const sign = v > 0 ? '+' : '';
      const cls = v > 0 ? 'up' : 'down';
      return `<span class="effect-tag ${k} ${cls}">${STAT_LABELS[k]}${sign}${v}</span>`;
    })
    .join('');
}

function resolveText(textOrFn, flags) {
  return typeof textOrFn === 'function' ? textOrFn(flags) : textOrFn;
}

const LEVEL_LAKE = {
  id: 1,
  name: '大明湖',
  location: '濟南',
  source: '《老殘遊記》第一回',
  scene: '🏞️',
  events: [
    {
      text: '你至大明湖，荷香撲鼻，遠處漁歌隱隱。湖畔有書生對月吟詩，亦有舟子談論城中近日命案。你將如何度此夕？',
      choices: [
        {
          id: 'l1_moon',
          label: '泛舟湖上，聽歌賞月',
          effects: { ren: 1, dong: 0, ming: 1 },
          feedback: '你暫忘塵勞，心有所感。山水之美，正是劉鶚筆下濟南的風骨。'
        },
        {
          id: 'l1_inquire',
          label: '與舟子攀談，打聽城中異事',
          effects: { ren: 0, dong: 2, ming: 0 },
          feedback: '你得知城中近日有秀才涉訟，縣官以嚴刑辦案，百姓議論紛紛。'
        },
        {
          id: 'l1_rest',
          label: '尋客棧歇息，不問外事',
          effects: { ren: -1, dong: -1, ming: 0 },
          feedback: '你選擇了疏離。江湖兒女，有時只得自保。'
        }
      ]
    }
  ]
};

const LEVEL_CITY = {
  id: 2,
  name: '城內',
  location: '濟南',
  source: '《老殘遊記》官場見聞',
  scene: '🏛️',
  events: [
    {
      text: (flags) => {
        let t = '你入城求診，聞人皆言縣令「清如水、明如鏡」。然你路過衙門，聽得板子聲與哀號聲不絕於耳。有人勸你：「這位父母官最是清正，你莫要多言。」';
        if (flags.l1_inquire) t += '\n\n你想起舟子所言，愈覺此事蹊蹺。';
        return t;
      },
      npcFlip: {
        name: '縣令王永祥',
        front: { label: '清官', desc: '百姓稱頌：清如水、明如鏡' },
        back: { label: '酷吏', desc: '刑求成瘾，冤獄累累——酷吏之害，有甚於貪' },
        flipRequires: { dong: 3 }
      },
      choices: [
        {
          id: 'l2_believe',
          label: '相信清名，入衙拜會縣令',
          effects: { ren: 0, dong: -2, ming: 1 },
          feedback: '縣令待你以禮，言談間自許為國除奸。你未見其酷，只見其「清」。'
        },
        {
          id: 'l2_investigate',
          label: '暗中查訪，探聽刑案內情',
          effects: { ren: 0, dong: 2, ming: -1 },
          feedback: '你聽聞受審者多遭屈打，供詞多出自刑求。清官之名，未必清於事。'
        },
        {
          id: 'l2_clinic',
          label: '為貧民義診，不涉官事',
          effects: { ren: 2, dong: 0, ming: 0 },
          feedback: '你以醫濟人，百姓感激。劉鶚筆下的老殘，常以技藝先救眼前人。'
        }
      ]
    },
    {
      text: '一老翁跪於路旁，訴其子遭冤下獄。他懇請你向縣令說情——「聽聞老殘先生大名，定能救我兒。」',
      choices: [
        {
          id: 'l2_petition',
          label: '代寫狀紙，呈遞縣衙',
          effects: { ren: 1, dong: 0, ming: 1 },
          feedback: '狀紙呈上，縣令收閱。然能否翻案，你心中並無把握。'
        },
        {
          id: 'l2_advise_wait',
          label: '勸老翁忍耐，莫與官家作對',
          effects: { ren: -1, dong: 0, ming: 0 },
          feedback: '老翁黯然離去。你知此非上策，卻也見識了平民的無力。'
        },
        {
          id: 'l2_review_case',
          label: '細審案情，尋找破綻',
          requires: { dong: 4 },
          effects: { ren: 1, dong: 1, ming: 0 },
          feedback: '你發現供詞前後矛盾，疑有冤情。此時你已隱約觸及「酷吏之害」。'
        }
      ]
    }
  ]
};

const LEVEL_TAISHAN = {
  id: 3,
  name: '泰山',
  location: '泰安',
  source: '《老殘遊記》登山段落',
  scene: '⛰️',
  events: [
    {
      text: (flags) => {
        let t = '你登泰山途中，遇一挑夫失足墜崖，腿骨已折，同行者皆不敢妄動。山道狹窄，轎夫催促眾人快行，莫誤了貴客行程。';
        if (flags.route === 'mountain') t += '\n\n你選擇先登山，正可在此靜思世道。';
        return t;
      },
      choices: [
        {
          id: 'l3_help',
          label: '留下施救，以夾板固定傷腿',
          effects: { ren: 2, dong: 0, ming: 0 },
          feedback: '你以醫術穩住傷勢，挑夫涕泣多謝。貴客轎子已遠，你卻不悔。'
        },
        {
          id: 'l3_leave',
          label: '囑託他人照料，自趕路程',
          effects: { ren: -1, dong: 0, ming: 1 },
          feedback: '你留銀兩而去。江湖奔波，有時不得不取捨。'
        },
        {
          id: 'l3_plead',
          label: '請轎夫暫停，合力救人',
          effects: { ren: 1, dong: 1, ming: 1 },
          feedback: '貴客初有不悅，見你施救得法，反讚你仁心。名與仁，有時並行。'
        }
      ]
    },
    {
      text: '山頂遇一雲遊道人，談及世局：「官場如棋局，清濁難分。君以何眼觀之？」',
      choices: [
        {
          id: 'l3_people',
          label: '「以百姓之苦為眼。」',
          effects: { ren: 1, dong: 1, ming: 0 },
          feedback: '道人頷首：「此為仁心，亦為根本。」'
        },
        {
          id: 'l3_law',
          label: '「以法度刑名為眼。」',
          effects: { ren: 0, dong: -1, ming: 1 },
          feedback: '道人搖頭：「法若酷於情，清亦成暴。」呼應劉鶚對清官的批判。'
        },
        {
          id: 'l3_retreat',
          label: '「以山水自適，不問世事。」',
          effects: { ren: -1, dong: 0, ming: -1 },
          feedback: '道人笑而不語。你望見雲海蒼茫，心下茫然。'
        }
      ]
    }
  ]
};

const LEVEL_HEILONG = {
  id: 4,
  name: '黑龍潭',
  location: '泰安',
  source: '《老殘遊記》白玲瓏冤案',
  scene: '🌑',
  events: [
    {
      text: (flags) => {
        let t = '你聞秀才賈家涉訟，牽連娼家白玲瓏。縣官辦案極嚴，百姓稱頌其清，然你已知此案疑點重重。獄中傳出哀聲，聞者不忍。';
        if (flags.l1_inquire) t += '\n\n你早先聽聞此案，心中已有準備，遂細察端倪。';
        else if (flags.l1_rest) t += '\n\n冤情突如其來，你竟有些措手不及。';
        if (flags.officialFlipped) t += '\n\n你憶起縣令真面目，愈發確信此乃冤獄。';
        else if (flags.l2_believe) t += '\n\n你曾信其清名，此刻卻心生疑慮。';
        return t;
      },
      choices: [
        {
          id: 'l4_bribe',
          label: '設法賄賂獄卒，探監相見',
          effects: { ren: 1, dong: 1, ming: -1 },
          feedback: '你見白玲瓏形容憔悴，言辭懇切。你愈信此乃冤獄。',
          silverUnlock: true
        },
        {
          id: 'l4_plead_official',
          label: '當面勸縣官勿用酷刑',
          effects: { ren: 0, dong: -2, ming: 1 },
          feedback: '縣官正色道：「刑不上大夫，法不縱奸。君勿為匪類說情。」你被「清」之名震懾。'
        },
        {
          id: 'l4_gather_proof',
          label: '收集證據，待機翻案',
          requires: { dong: 4 },
          effects: { ren: 1, dong: 1, ming: 0 },
          feedback: '你串連人證物證，發現供詞皆出刑求。酷吏之害，有甚於貪——劉鶚此語，至此應驗。'
        }
      ]
    },
    {
      text: '翻案時機已到，然需有人擔當風險：或直呈上司，或暗中救人夜遁。縣官聲望正隆，一著不慎，你亦難脫干係。',
      choices: [
        {
          id: 'l4_rescue',
          label: '冒險救人，安排夜遁',
          effects: { ren: 2, dong: 0, ming: -2 },
          feedback: '你救出一人性命，卻得罪官場。仁心既滿，名聲受損——老殘常陷此兩難。'
        },
        {
          id: 'l4_report',
          label: '具狀上告，依律陳情',
          effects: { ren: 1, dong: 0, ming: 1 },
          feedback: '狀紙遞上，上司批覆「知道了」。能否平反，仍在天機。'
        },
        {
          id: 'l4_giveup',
          label: '歎力不從心，飄然離去',
          effects: { ren: -1, dong: 1, ming: 0 },
          feedback: '你救不得眾人，只得離去。此正是老殘「俠而無力」的寫照。'
        }
      ]
    }
  ]
};

const LEVEL_DEPARTURE = {
  id: 5,
  name: '離去途中',
  location: '歸途',
  source: '《老殘遊記》尾聲意境',
  scene: '🌅',
  events: [
    {
      text: (flags) => {
        let t = '你行於歸途，路遇少年問道：「先生遊歷多時，可見清官乎？貪官乎？」你將如何作答？';
        if (flags.l4_rescue) t += '\n\n你剛經歷夜遁救人，感慨尤深。';
        return t;
      },
      choices: [
        {
          id: 'l5_truth',
          label: '「清官有之，然酷烈過度，其害甚於貪。」',
          effects: { ren: 0, dong: 2, ming: 1 },
          feedback: '此為劉鶚全書要旨。少年若有所思。'
        },
        {
          id: 'l5_vague',
          label: '「官場事複雜，非一言可盡。」',
          effects: { ren: 0, dong: 1, ming: 0 },
          feedback: '你選擇了保留。有些真相，說出來也未必有人信。'
        },
        {
          id: 'l5_medicine',
          label: '「但行醫濟世，莫問官與吏。」',
          effects: { ren: 1, dong: -1, ming: 0 },
          feedback: '你將答案收斂於技藝與仁心。然而國事如此，豈能真不問？'
        }
      ]
    },
    {
      text: '暮煙四起，你回望濟南方向。此行種種，皆成過眼。你對己身此行，作何總結？',
      choices: [
        {
          id: 'l5_conscience',
          label: '雖不能改世道，但求无愧於心',
          effects: { ren: 1, dong: 0, ming: 0 },
          feedback: '你以仁心自勉。俠者之義，或在於此。'
        },
        {
          id: 'l5_fame',
          label: '當多積名聲，以圖後效',
          effects: { ren: -1, dong: 0, ming: 2 },
          feedback: '你思及名聲之用，或能助更多人事。然名與義，孰先孰後？'
        },
        {
          id: 'l5_retreat',
          label: '世局難挽，不如歸隱山水',
          effects: { ren: -1, dong: 1, ming: -1 },
          feedback: '你選擇了疏離。飄然遠去，亦是清末知識分子的一種出路。'
        }
      ]
    }
  ]
};

const BRANCH_CHOICE = {
  text: '大明湖一遊已畢。聞說前方有兩條路：一入濟南城查訪刑案，一先登泰山避世靜思。你將如何前行？',
  choices: [
    {
      id: 'route_city',
      label: '入城查案，直搗官場',
      route: 'city',
      feedback: '你決先入城。官場風雲，或許正該從衙門看起。'
    },
    {
      id: 'route_mountain',
      label: '先遊泰山，再圖他計',
      route: 'mountain',
      feedback: '你決先登山。天地開闊處，或能看清世情。'
    }
  ]
};

function buildLevelOrder(route) {
  if (route === 'mountain') {
    return [LEVEL_LAKE, LEVEL_TAISHAN, LEVEL_CITY, LEVEL_HEILONG, LEVEL_DEPARTURE];
  }
  return [LEVEL_LAKE, LEVEL_CITY, LEVEL_TAISHAN, LEVEL_HEILONG, LEVEL_DEPARTURE];
}

const ENDINGS = [
  {
    id: 'fachongguan',
    title: '髮衝冠',
    hidden: true,
    condition: (s) => s.ren >= 5 && s.dong >= 5 && s.ming >= 5 && s.flags.l4_rescue,
    desc: '仁心、洞察、名聲皆至頂峰，你又冒死救人——老殘之俠，至此極矣。江湖傳誦你的義行，然你每念及獄中冤魂與不清之世，仍髮衝冠、涕沾襟。此為隱藏結局，唯有至仁至察且見義勇為者方能達成。',
    quote: '「知我者謂我心憂，不知我者謂我何求。」'
  },
  {
    id: 'xiayi',
    title: '俠醫之名',
    condition: (s) => s.ren >= 4 && s.dong >= 4,
    desc: '你以仁心濟世，又以洞察看破官場虛實。雖不能翻轉世道，卻救得數人性命，江湖間漸傳「俠醫老殘」之名。然你每念及獄中冤魂，仍歎：「國事如此，奈何！」',
    quote: '「救得了人，救不了世。」——此為老殘一生的寫照。'
  },
  {
    id: 'mingshi',
    title: '名士老殘',
    condition: (s) => s.ming >= 4 && s.ren <= 2,
    desc: '你名聲鵲起，詩酒風流，士林中人多稱頌。然細究所為，百姓未必盡受其益。劉鶚筆下的老殘，從非單純名士；你卻走上了名重於仁之路。',
    quote: '名可傳於一時，仁方可立於萬民。'
  },
  {
    id: 'wuru',
    title: '誤入官場',
    condition: (s) => s.dong <= 1,
    desc: '你被「清官」之名所惑，屢次選擇相信法度與權威，未能看透酷刑背後的冤情。回顧此行，你才驚覺：清而不察，與助紂為虐，相去不遠。',
    quote: '「酷吏之害，有甚於貪。」——劉鶚《老殘遊記》'
  },
  {
    id: 'piaoran',
    title: '飄然遠去',
    condition: (s) => s.ren <= 2 && s.dong <= 2 && s.ming <= 2,
    desc: '你選擇了疏離與自保，不問官事、不濟危難。山水依舊，你飄然遠去，如雲過天空。這是解脫，亦是放棄。',
    quote: '江湖路遠，各人有各人的歸處。'
  },
  {
    id: 'jianghu',
    title: '江湖行醫',
    condition: () => true,
    desc: '你以醫藝行走江湖，仁心、洞察、名聲各有進退，未能極致，卻也未至偏頗。你如書中老殘一般，在亂世中尋一條可行之路——不問功名，但問眼前。',
    quote: '「明湖秋月，泰山煙雲，盡入胸中；官場百態，亦付談笑。」'
  }
];

const CHOICE_LABELS = {
  l1_moon: '大明湖·泛舟賞月',
  l1_inquire: '大明湖·打聽異事',
  l1_rest: '大明湖·不問外事',
  route_city: '路線·入城查案',
  route_mountain: '路線·先遊泰山',
  l2_believe: '城內·相信清名',
  l2_investigate: '城內·暗中查訪',
  l2_clinic: '城內·義診濟貧',
  l2_petition: '城內·代寫狀紙',
  l2_advise_wait: '城內·勸人忍耐',
  l2_review_case: '城內·細審案情',
  l3_help: '泰山·留下施救',
  l3_leave: '泰山·留銀而去',
  l3_plead: '泰山·合力救人',
  l3_people: '泰山·以百姓為眼',
  l3_law: '泰山·以法度為眼',
  l3_retreat: '泰山·不問世事',
  l4_bribe: '黑龍潭·探監相見',
  l4_plead_official: '黑龍潭·勸官勿酷',
  l4_gather_proof: '黑龍潭·收集證據',
  l4_rescue: '黑龍潭·冒險夜遁',
  l4_report: '黑龍潭·具狀上告',
  l4_giveup: '黑龍潭·飄然離去',
  l5_truth: '歸途·直言酷吏之害',
  l5_vague: '歸途·保留不語',
  l5_medicine: '歸途·但行醫濟世',
  l5_conscience: '歸途·无愧於心',
  l5_fame: '歸途·積累名聲',
  l5_retreat: '歸途·歸隱山水'
};

const RANDOM_ENCOUNTERS = [
  {
    id: 'enc_beggar',
    scene: '🩹',
    text: '途中遇一乞兒，面有菜色，咳聲不止。路人掩鼻而過，你駐足片刻。',
    choices: [
      { label: '施藥治療，不收分文', effects: { ren: 1, dong: 0, ming: 0 }, feedback: '乞兒叩首多謝。你心下一安，卻也耽擱了行程。' },
      { label: '給幾文銅錢，便走', effects: { ren: 0, dong: 0, ming: 1 }, feedback: '聊勝於無。你告知自己：江湖路遠，不能事事皆管。' },
      { label: '問其來歷，細聽訴苦', effects: { ren: 0, dong: 1, ming: 0 }, feedback: '原是被豪強所逼。你記下此事，或與後案有關。' }
    ]
  },
  {
    id: 'enc_poet',
    scene: '📖',
    text: '茶肆中遇一落魄書生，攜酒狂吟，言及「清官誤國」四字，眾人側目。',
    choices: [
      { label: '與他對飲，細談世道', effects: { ren: 0, dong: 1, ming: 1 }, feedback: '書生言：「酷吏之害，有甚於貪。」你深以为然。' },
      { label: '勸他少言，免惹禍端', effects: { ren: -1, dong: 0, ming: 0 }, feedback: '書生苦笑飲盡，不再言。你亦覺索然。' },
      { label: '靜聽不語，付茶資而去', effects: { ren: 0, dong: 1, ming: -1 }, feedback: '有些话，聽過便好，不必附和。' }
    ]
  },
  {
    id: 'enc_officer',
    scene: '⚖️',
    text: '官道遇巡捕盤查，問你行囊可有禁物。旁有一婦人哭泣，稱夫遭冤下獄。',
    choices: [
      { label: '為婦人作保，請巡捕細查', effects: { ren: 1, dong: 0, ming: -1 }, feedback: '巡捕不耐而去。婦人千恩萬謝，你卻知此事難了。' },
      { label: '出示醫者身份，快些過關', effects: { ren: 0, dong: 0, ming: 1 }, feedback: '巡捕見你是江湖醫生，揮手放行。' },
      { label: '旁觀不語，以免牽連', effects: { ren: -1, dong: -1, ming: 0 }, feedback: '你低頭快走。婦人哭聲漸遠，心下愧疚。' }
    ]
  },
  {
    id: 'enc_lake',
    scene: '🌙',
    text: '夜宿客棧，聽窗外漁歌。忽憶起劉鶚筆下「明湖秋月」之景，心有所動。',
    choices: [
      { label: '提筆記遊，留詩一首', effects: { ren: 0, dong: 0, ming: 1 }, feedback: '詩成傳唱，名聲微起。' },
      { label: '默坐沉思，念及獄中冤魂', effects: { ren: 1, dong: 1, ming: 0 }, feedback: '山水可賞，人事難忘。' },
      { label: '早早歇息，養足精神', effects: { ren: 0, dong: 0, ming: 0 }, feedback: '明日還有路要走。' }
    ]
  }
];

const LORE_SNIPPETS = [
  { id: 'lore_kulai', title: '酷吏之害', flag: 'officialFlipped', text: '劉鶚：「酷吏之害，有甚於貪。」——清而不察，其禍尤烈。' },
  { id: 'lore_minghu', title: '明湖秋月', flag: 'l1_moon', text: '「一城山色，半城荷柳」——老殘遊記開卷，先寫濟南風光。' },
  { id: 'lore_inquire', title: '舟子之言', flag: 'l1_inquire', text: '百姓議論刑案，伏筆於後。遊記之妙，在寫景與批判並行。' },
  { id: 'lore_rescue', title: '俠而無力', flag: 'l4_rescue', text: '老殘救人，卻改不了刑名。此為清末知識分子之困境。' },
  { id: 'lore_review', title: '細審案情', flag: 'l2_review_case', text: '供詞前後矛盾，往往出自刑求——冤獄由此而生。' },
  { id: 'lore_truth', title: '全書要旨', flag: 'l5_truth', text: '「清官有之，然酷烈過度，其害甚於貪。」——老殘對少年道破天機。' },
  { id: 'lore_fachong', title: '髮衝冠', flag: 'l4_rescue', extra: (s) => s.ren >= 5 && s.dong >= 5, text: '「知我者謂我心憂，不知我者謂我何求。」——至仁至察，見義勇為之極。' }
];

const DAILY_CHALLENGES = [
  { id: 'dc_dong4', title: '明察秋毫', desc: '通關時洞察 ≥ 4', check: (s) => s.dong >= 4 },
  { id: 'dc_ren4', title: '仁心濟世', desc: '通關時仁心 ≥ 4', check: (s) => s.ren >= 4 },
  { id: 'dc_flip', title: '識破清官', desc: '本局翻面縣令', check: (s) => s.flags?.officialFlipped },
  { id: 'dc_rescue', title: '虎口救人', desc: '本局黑龍潭夜遁救人', check: (s) => s.flags?.l4_rescue },
  { id: 'dc_both', title: '雙線並進', desc: '通關時仁心與洞察均 ≥ 3', check: (s) => s.ren >= 3 && s.dong >= 3 },
  { id: 'dc_mountain', title: '先登泰山', desc: '本局選擇登山路線', check: (s) => s.route === 'mountain' },
  { id: 'dc_combo', title: '心悟連貫', desc: '本局觸發 3 連擊以上', check: (s) => (s.maxCombo || 0) >= 3 }
];

function getChoiceLean(effects) {
  if (!effects) return null;
  const r = effects.ren || 0;
  const d = effects.dong || 0;
  const m = effects.ming || 0;
  if (r > 0 && r >= d && r >= m) return 'ren';
  if (d > 0 && d >= r && d >= m) return 'dong';
  if (m > 0 && m >= r && m >= d) return 'ming';
  if (r < 0 || d < 0 || m < 0) return 'cold';
  return null;
}

const COMBO_LABELS = { ren: '仁心', dong: '洞察', ming: '名聲', cold: '疏離' };

function scoreEndingProximity(s, ending) {
  const flags = s.flags || {};
  switch (ending.id) {
    case 'fachongguan':
      return Math.min(s.ren, s.dong, s.ming) / 5 * 50 + (flags.l4_rescue ? 50 : 0);
    case 'xiayi':
      return (Math.min(s.ren, 4) / 4 * 50) + (Math.min(s.dong, 4) / 4 * 50);
    case 'mingshi':
      return (Math.min(s.ming, 4) / 4 * 60) + (s.ren <= 2 ? 40 : Math.max(0, (3 - s.ren) / 3 * 40));
    case 'wuru':
      return s.dong <= 1 ? 100 : Math.max(0, 100 - (s.dong - 1) * 35);
    case 'piaoran':
      return (Math.max(0, 3 - s.ren) + Math.max(0, 3 - s.dong) + Math.max(0, 3 - s.ming)) / 9 * 100;
    default:
      return 30;
  }
}

function getEndingTrajectory(state) {
  const s = { ...state, flags: state.flags || {} };
  return ENDINGS
    .filter((e) => e.id !== 'jianghu')
    .map((e) => ({ id: e.id, title: e.title, hidden: e.hidden, score: scoreEndingProximity(s, e) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function pickRandomEncounter(usedIds = []) {
  const pool = RANDOM_ENCOUNTERS.filter((e) => !usedIds.includes(e.id));
  if (pool.length === 0) return RANDOM_ENCOUNTERS[Math.floor(Math.random() * RANDOM_ENCOUNTERS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}
