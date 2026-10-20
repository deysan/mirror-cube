// Self-contained offline review UI; authoritative manifest validation remains in boundaryReview.ts.
(() => {
  const { catalog, template } = JSON.parse(document.getElementById('review-data').textContent);
  let state = structuredClone(template), language = 'uk';
  const text = {
    uk: { title: 'Перевірка меж на фото', warning: 'Локальний інструмент аналізу, не розпізнаний стан кубика. Зелена або стабільна лінія не обов’язково є ребром корпусу. Фото вбудовані в цей файл — не публікуйте його.',
      name: 'Хто перевіряє', decision: 'Рішення', reviewerRole: 'Роль перевіряльника', owner: 'Власник кубика', analyst: 'Аналітик (не фізичне підтвердження власником)',
      pending: 'Ще не перевірено', exclude: 'Не використовувати', use: 'Використати спостереження', choose: 'Оберіть лінію', manual: 'Початкова ручна позначка (явне збереження)',
      unknown: 'Тип не визначено', body: 'Пряме ребро корпусу', inset: 'Край наклейки / вставки', bevel: 'Межа фаски', direction: 'Лише напрямок', position: 'Положення ребра корпусу (не міліметри)',
      assumption: 'Явно припускаю паралельність цієї межі ребру корпусу', note: 'Обґрунтування вибору або виключення',
      fit: 'Для оцінки напрямку', check: 'Контрольне ребро — не бере участі в підборі', unstable: 'нестабільний кандидат',
      draft: 'Завантажити чернетку JSON', save: 'Завантажити завершену перевірку JSON', load: 'Відкрити збережену перевірку',
      incomplete: 'Потрібні ім’я, рішення й пояснення для кожної ділянки; для використаних меж — допустимий тип, лінія та призначення.',
      ready: 'Усі ділянки описано. Це перевірені вручну спостереження, а не підтверджений стан або калібрування камери.',
      invalid: 'Файл перевірки не відповідає цьому звіту або має неправильний формат.', imported: 'Рішення відновлено. Дані не надсилались мережею.',
      legend: 'Пунктирна пурпурова лінія — початкова позначка; суцільні кольорові лінії — альтернативи. Яскрава товста лінія — поточний вибір. Нічого не вибрано автоматично.' },
    en: { title: 'Photo boundary review', warning: 'Local analysis tool, not a recognized puzzle state. A stable line is not necessarily a body edge. Images are embedded in this file: do not publish it.',
      name: 'Reviewer name', decision: 'Decision', reviewerRole: 'Reviewer role', owner: 'Puzzle owner', analyst: 'Analyst (not owner physical confirmation)',
      pending: 'Not reviewed', exclude: 'Exclude observation', use: 'Use observation', choose: 'Choose a line', manual: 'Original manual mark (explicit retention)',
      unknown: 'Unknown boundary type', body: 'Straight body edge', inset: 'Inset / sticker border', bevel: 'Bevel boundary', direction: 'Direction only', position: 'Body-edge position (not millimeters)',
      assumption: 'Explicitly assume this border is parallel to the body edge', note: 'Reason for selection or exclusion',
      fit: 'Direction fitting', check: 'Held-out check — never used to fit directions', unstable: 'unstable candidate',
      draft: 'Download draft JSON', save: 'Download completed review JSON', load: 'Open saved review',
      incomplete: 'Provide a name, decision, and reason for every region; used observations need a valid type, line, and purpose.',
      ready: 'All regions accounted for. These are manually reviewed observations, not a confirmed state or camera calibration.',
      invalid: 'Review file does not match this catalog or has an invalid format.', imported: 'Decisions restored. No data was sent over a network.',
      legend: 'Dashed magenta: original mark. Solid colored lines: alternatives. Bright thick line: current selection. Nothing is selected automatically.' }
  };
  const rows = catalog.views.flatMap(view => view.edges.map(edge => ({ view, edge })));
  const $ = id => document.getElementById(id);
  const validDecision = (d, edge) => d.action === 'exclude' ? !!d.note.trim() : d.action === 'use' && !!d.note.trim()
    && d.kind !== 'unknown' && (d.choice === 'manual' || edge.candidates.some(c => c.id === d.choice && c.stable))
    && (d.kind === 'body-edge' || d.parallelAssumption) && (d.purpose !== 'body-position' || d.kind === 'body-edge');
  const complete = () => !!state.reviewer.name.trim() && rows.every(({ edge }, i) => validDecision(state.decisions[i], edge));
  function update() {
    $('save').disabled = !complete(); $('status').textContent = text[language][complete() ? 'ready' : 'incomplete'];
    rows.forEach((_, i) => document.querySelectorAll(`[data-row="${i}"] [data-choice]`).forEach(line => {
      const selected = state.decisions[i].action === 'use' && line.dataset.choice === state.decisions[i].choice;
      line.setAttribute('stroke-width', selected ? '4' : '1.5'); line.setAttribute('opacity', selected ? '1' : '0.7');
    }));
  }
  function select(label, values, value, change) {
    const wrapper = document.createElement('label'), caption = document.createElement('span'), control = document.createElement('select');
    caption.textContent = label; wrapper.append(caption, control);
    for (const [id, title, disabled] of values) { const option = document.createElement('option'); option.value = id; option.textContent = title; option.disabled = !!disabled; control.append(option); }
    control.value = value; control.addEventListener('change', () => change(control.value)); return wrapper;
  }
  function render() {
    const active = document.activeElement, activeRow = active?.closest('[data-row]');
    const activeIndex = activeRow ? [...activeRow.querySelectorAll('select,input,textarea')].indexOf(active) : -1;
    const t = text[language]; document.documentElement.lang = language; document.title = t.title;
    $('reviewer-role').setAttribute('aria-label', t.reviewerRole);
    $('uk').setAttribute('aria-pressed', String(language === 'uk')); $('en').setAttribute('aria-pressed', String(language === 'en'));
    for (const id of ['title', 'warning', 'legend', 'draft', 'save', 'load-label', 'name-label']) $(id).textContent = t[{ 'load-label': 'load', 'name-label': 'name' }[id] || id];
    $('reviewer').value = state.reviewer.name;
    $('reviewer-role').replaceChildren(...[['owner',t.owner],['analyst',t.analyst]].map(([id,label]) => { const o=document.createElement('option');o.value=id;o.textContent=label;return o; }));
    $('reviewer-role').value = state.reviewer.role;
    rows.forEach(({ edge }, i) => {
      const d = state.decisions[i], root = document.querySelector(`[data-row="${i}"] .controls`); root.replaceChildren();
      const role = document.createElement('p'); role.textContent = t[edge.role]; root.append(role);
      root.append(select(t.decision, [['pending',t.pending],['use',t.use],['exclude',t.exclude]], d.action, v => { d.action=v;render(); }));
      if (d.action === 'use') {
        root.append(select(t.choose, [['',t.choose],['manual',t.manual],...edge.candidates.map(c => [c.id,`${c.id}${c.stable?'':` (${t.unstable})`}`,!c.stable])],d.choice,v=>{d.choice=v;update();}));
        root.append(select(t.unknown, [['unknown',t.unknown],['body-edge',t.body],['inset-border',t.inset],['bevel',t.bevel]],d.kind,v=>{d.kind=v;if(v!=='body-edge')d.purpose='direction';render();}));
        root.append(select(t.direction, [['direction',t.direction],['body-position',t.position,d.kind!=='body-edge']],d.purpose,v=>{d.purpose=v;update();}));
        if(d.kind!=='body-edge') { const label=document.createElement('label'), check=document.createElement('input');check.type='checkbox';check.checked=d.parallelAssumption;
          check.addEventListener('change',()=>{d.parallelAssumption=check.checked;update();});label.append(check,document.createTextNode(t.assumption));root.append(label); }
      }
      const label=document.createElement('label'), caption=document.createElement('span'), note=document.createElement('textarea');caption.textContent=t.note;note.value=d.note;note.maxLength=1000;
      note.addEventListener('input',()=>{d.note=note.value;update();});label.append(caption,note);root.append(label);
    }); update();
    if (activeRow && activeIndex >= 0) activeRow.querySelectorAll('select,input,textarea')[activeIndex]?.focus();
  }
  function download(final) {
    if(final&&!complete())return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=final?'mirror-cube-boundary-review.json':'mirror-cube-boundary-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('draft').onclick=()=>download(false);$('save').onclick=()=>download(true);
  $('reviewer').oninput=event=>{state.reviewer.name=event.target.value;update();};
  $('reviewer-role').onchange=event=>{state.reviewer.role=event.target.value;update();};
  $('uk').onclick=()=>{language='uk';render();};$('en').onclick=()=>{language='en';render();};
  $('load').onchange=async event=>{
    try {
      const file=event.target.files[0];if(!file||file.size>32_000_000)throw Error();const imported=JSON.parse(await file.text());
      if(imported.version!==1||imported.catalogId!==catalog.catalogId||typeof imported.reviewer?.name!=='string'||imported.reviewer.name.length>200
        ||!['owner','analyst'].includes(imported.reviewer.role)||!Array.isArray(imported.decisions)||imported.decisions.length!==rows.length)throw Error();
      const normalized=rows.map(({view,edge})=>{const matches=imported.decisions.filter(d=>d?.viewId===view.id&&d?.edgeId===edge.id);if(matches.length!==1)throw Error();const d=matches[0];
        if(!['pending','use','exclude'].includes(d.action)||!['unknown','body-edge','inset-border','bevel'].includes(d.kind)||!['direction','body-position'].includes(d.purpose)
          ||typeof d.choice!=='string'||typeof d.parallelAssumption!=='boolean'||typeof d.note!=='string'||d.note.length>1000)throw Error();
        return {viewId:view.id,edgeId:edge.id,action:d.action,choice:d.choice,kind:d.kind,purpose:d.purpose,parallelAssumption:d.parallelAssumption,note:d.note};});
      state={version:1,catalogId:catalog.catalogId,reviewer:{name:imported.reviewer.name,role:imported.reviewer.role},decisions:normalized};render();$('message').textContent=text[language].imported;
    }catch{$('message').textContent=text[language].invalid;}event.target.value='';
  };
  render();
})();
