/**
 * UI状態・描画・イベント処理(js/engine.js の計算結果を画面に反映する)
 */
(function () {
  "use strict";

  var E = window.MahjongEngine;
  var tileLabel = E.tileLabel;
  var SUIT_FULL = E.SUIT_FULL;
  var HONOR_NAME = E.HONOR_NAME;

  var state = {
    seat: 'child', win: 'ron', open: 'closed', riichi: 'riichi', ippatsu: false,
    situational: { rinshan: false, chankan: false, haitei: false, houtei: false, tenchi: false },
    roundWind: 1, seatWindChild: 2,
    dora: 1, aka: 0, ura: 0,
    shape: 'standard',
    melds: [
      { type: 'seq', suit: 'm', num: 2, open: false, kan: false },
      { type: 'seq', suit: 'p', num: 4, open: false, kan: false },
      { type: 'seq', suit: 's', num: 6, open: false, kan: false },
      { type: 'seq', suit: 'p', num: 3, open: false, kan: false }
    ],
    pair: { suit: 's', num: 5 },
    winGroup: 0, winPos: 'low',
    chiitoiPairs: [
      { suit: 'm', num: 1 }, { suit: 'm', num: 9 }, { suit: 'p', num: 2 }, { suit: 'p', num: 8 },
      { suit: 's', num: 3 }, { suit: 's', num: 7 }, { suit: 'z', num: 5 }
    ],
    kokushiCounts: { '1m': 1, '9m': 1, '1p': 1, '9p': 1, '1s': 1, '9s': 2, '1z': 1, '2z': 1, '3z': 1, '4z': 1, '5z': 1, '6z': 1, '7z': 1 },
    kokushiWinType: '9s'
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function applyInterlocks() {
    if (state.shape !== 'standard') state.open = 'closed';
    if (state.open === 'open') state.riichi = 'none';
    if (!state.riichi || state.riichi === 'none') state.ippatsu = false;
  }

  // ---------- tile picker HTML ----------
  function tilePickerHTML(owner, suit, num, seqMode) {
    var suits = seqMode ? ['m', 'p', 's'] : ['m', 'p', 's', 'z'];
    var suitHtml = suits.map(function (s) {
      return '<button type="button" class="tile-btn wide' + (s === suit ? ' active' : '') + '" data-tp-suit="' + s + '">' + SUIT_FULL[s] + '</button>';
    }).join('');
    var numHtml;
    if (suit === 'z' && !seqMode) {
      numHtml = [1, 2, 3, 4, 5, 6, 7].map(function (n) {
        return '<button type="button" class="tile-btn' + (n === num ? ' active' : '') + '" data-tp-num="' + n + '">' + HONOR_NAME[n] + '</button>';
      }).join('');
    } else {
      var maxN = seqMode ? 7 : 9, arr = [];
      for (var n = 1; n <= maxN; n++) arr.push(n);
      numHtml = arr.map(function (n) {
        return '<button type="button" class="tile-btn' + (n === num ? ' active' : '') + '" data-tp-num="' + n + '">' + n + '</button>';
      }).join('');
    }
    return '<div class="suit-row" data-owner="' + owner + '">' + suitHtml + '</div><div class="num-row" data-owner="' + owner + '">' + numHtml + '</div>';
  }

  // ---------- render: melds ----------
  function renderMelds() {
    var wrap = $('#melds');
    wrap.innerHTML = state.melds.map(function (m, i) {
      var seqMode = m.type === 'seq';
      var isWinner = state.winGroup === i;
      var winPosRow = '';
      if (isWinner && seqMode) {
        var opts = ['low', 'mid', 'high'];
        var labels = opts.map(function (p, pi) { return tileLabel(m.suit, m.num + pi); });
        winPosRow = '<div class="win-pos-row" data-owner="' + i + '"><span class="name">アガリ牌</span>' +
          opts.map(function (p, pi) {
            return '<button type="button" class="tile-btn' + (state.winPos === p ? ' active' : '') + '" data-winpos="' + p + '">' + labels[pi] + '</button>';
          }).join('') + '</div>';
      }
      var flagsRow = m.type === 'trip' ? (
        '<div class="meld-flags">' +
        '<label class="chip-toggle"><input type="checkbox" data-kan="' + i + '"' + (m.kan ? ' checked' : '') + '> 槓子(カン)</label>' +
        '<label class="chip-toggle"><input type="checkbox" data-open="' + i + '"' + (m.open ? ' checked' : '') + '> 鳴き(ポン/明槓)</label>' +
        '</div>'
      ) : (
        '<div class="meld-flags">' +
        '<label class="chip-toggle" title="順子は面前・鳴きどちらでも符は0のため、点数には影響しません"><input type="checkbox" data-open="' + i + '"' + (m.open ? ' checked' : '') + '> チー(鳴き)</label>' +
        '</div>'
      );
      var preview = seqMode
        ? '面子' + (i + 1) + ' → ' + [0, 1, 2].map(function (d) { return tileLabel(m.suit, m.num + d); }).join(' ')
        : '面子' + (i + 1) + ' → ' + tileLabel(m.suit, m.num) + ' ×' + (m.kan ? 4 : 3);
      return '<div class="meld-row" data-meld="' + i + '">' +
        '<div class="meld-head">' +
        '<div class="meld-head-left">' +
        '<span class="meld-label">面子' + (i + 1) + '</span>' +
        '<div class="mini-seg" data-mtype="' + i + '">' +
        '<button type="button" data-v="seq" class="' + (seqMode ? 'active' : '') + '">順子</button>' +
        '<button type="button" data-v="trip" class="' + (!seqMode ? 'active' : '') + '">刻子</button>' +
        '</div>' +
        '</div>' +
        '<label class="radio-chip"><input type="radio" name="winGroup" value="' + i + '"' + (isWinner ? ' checked' : '') + '> アガリ牌</label>' +
        '</div>' +
        tilePickerHTML('meld-' + i, m.suit, m.num, seqMode) +
        flagsRow +
        winPosRow +
        '<div class="meld-preview">' + preview + '</div>' +
        '</div>';
    }).join('');
  }

  function renderPairRow() {
    var wrap = $('#pair-row');
    var p = state.pair;
    var isWinner = state.winGroup === 'pair';
    wrap.innerHTML = '<div class="meld-row" data-pair>' +
      '<div class="meld-head">' +
      '<span class="meld-label">雀頭</span>' +
      '<label class="radio-chip"><input type="radio" name="winGroup" value="pair"' + (isWinner ? ' checked' : '') + '> アガリ牌(単騎)</label>' +
      '</div>' +
      tilePickerHTML('pair', p.suit, p.num, false) +
      '<div class="meld-preview">雀頭 → ' + tileLabel(p.suit, p.num) + ' ×2</div>' +
      '</div>';
  }

  function renderChiitoi() {
    var wrap = $('#chiitoi-rows');
    wrap.innerHTML = state.chiitoiPairs.map(function (p, i) {
      return '<div class="chiitoi-row"><span class="idx">対子' + (i + 1) + '</span>' +
        '<div style="flex:1;">' + tilePickerHTML('chiitoi-' + i, p.suit, p.num, false) + '</div></div>';
    }).join('');
  }

  var KOKUSHI_TYPES = ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'];
  function renderKokushi() {
    var wrap = $('#kokushi-grid');
    wrap.innerHTML = KOKUSHI_TYPES.map(function (t) {
      var n = state.kokushiCounts[t] || 0;
      var suit = t.slice(-1), num = parseInt(t, 10);
      var cls = n === 2 ? 'has2' : (n === 1 ? 'has1' : '');
      return '<div class="kokushi-tile"><button type="button" data-kokushi="' + t + '" class="' + cls + '">' + tileLabel(suit, num) + '</button>' +
        (n > 0 ? '<span class="kokushi-badge">' + n + '</span>' : '') + '</div>';
    }).join('');
    var sel = $('#kokushi-win');
    sel.innerHTML = KOKUSHI_TYPES.map(function (t) {
      var suit = t.slice(-1), num = parseInt(t, 10);
      return '<option value="' + t + '"' + (state.kokushiWinType === t ? ' selected' : '') + '>' + tileLabel(suit, num) + '</option>';
    }).join('');
  }

  function renderStatus() {
    $all('#seg-seat button').forEach(function (b) { b.classList.toggle('active', b.dataset.value === state.seat); });
    $all('#seg-win button').forEach(function (b) { b.classList.toggle('active', b.dataset.value === state.win); });
    $all('#seg-open button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === state.open);
      b.disabled = state.shape !== 'standard';
    });
    $all('#seg-riichi button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === state.riichi);
      b.disabled = state.open === 'open' && b.dataset.value !== 'none';
    });
    $all('#seg-shape button').forEach(function (b) { b.classList.toggle('active', b.dataset.value === state.shape); });
    $('#sel-round').value = String(state.roundWind);
    $('#sel-seatwind').value = String(state.seatWindChild);
    $('#seat-wind-wrap').hidden = state.seat === 'dealer';
    $('#chk-ippatsu').checked = state.ippatsu;
    $('#chk-ippatsu').disabled = state.riichi === 'none';
    $all('[data-sit]').forEach(function (el) { el.checked = !!state.situational[el.dataset.sit]; });
    $('[data-stepper="dora"] .val').textContent = state.dora;
    $('[data-stepper="aka"] .val').textContent = state.aka;
    $('[data-stepper="ura"] .val').textContent = state.ura;

    $('#hand-standard').hidden = state.shape !== 'standard';
    $('#hand-chiitoi').hidden = state.shape !== 'chiitoi';
    $('#hand-kokushi').hidden = state.shape !== 'kokushi';
  }

  function renderResult() {
    var el = $('#result');
    var res = E.computeResult(state);
    if (res.error) {
      el.innerHTML = '<div class="result-error">' + res.error + '</div>';
      return;
    }
    var tagsHtml = res.yakuList.map(function (y) {
      var isYm = !!y.tag;
      return '<span class="yaku-tag' + (isYm ? ' yakuman' : '') + '">' + y.name + (isYm ? ' <b>' + y.tag + '</b>' : (y.han ? ' <b>' + y.han + '翻</b>' : '')) + '</span>';
    }).join('');
    if (res.yakumanMode) {
      el.innerHTML =
        '<div class="result-top"><div class="result-han">役満確定 <b>×' + res.units + '</b></div>' +
        '<div class="result-badge yakuman">' + res.label + '</div></div>' +
        '<div class="result-points">' + res.payment.total.toLocaleString() + '<span>点</span></div>' +
        '<div class="yaku-tags">' + tagsHtml + '</div>' +
        '<div class="result-breakdown">' + res.payment.text + '</div>';
      pushHistory({ label: res.label, points: res.payment.total, detail: res.payment.text });
      return;
    }
    el.innerHTML =
      '<div class="result-top"><div class="result-han"><b>' + res.han + '翻</b> ' + res.fu + '符</div>' +
      (res.label ? '<div class="result-badge">' + res.label + '</div>' : '') +
      '</div>' +
      '<div class="result-points">' + res.payment.total.toLocaleString() + '<span>点</span></div>' +
      '<div class="yaku-tags">' + tagsHtml + '</div>' +
      '<div class="result-breakdown">' + res.payment.text + '</div>' +
      '<div class="fu-detail">' + res.fuDetail.join(' ・ ') + '</div>';
    pushHistory({ label: res.label || (res.han + '翻' + res.fu + '符'), points: res.payment.total, detail: res.payment.text });
  }

  var lastPushed = '';
  function pushHistory(entry) {
    var key = JSON.stringify(entry);
    if (key === lastPushed) return;
    lastPushed = key;
    try {
      var list = JSON.parse(localStorage.getItem('mahjongScoreHistory') || '[]');
      list.unshift({
        label: entry.label, points: entry.points, detail: entry.detail,
        seat: state.seat === 'dealer' ? '親' : '子', win: state.win === 'tsumo' ? 'ツモ' : 'ロン',
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      });
      list = list.slice(0, 8);
      localStorage.setItem('mahjongScoreHistory', JSON.stringify(list));
      renderHistory();
    } catch (err) { /* ローカルストレージが使えない場合は履歴を諦める */ }
  }

  function renderHistory() {
    var listEl = $('#history-list');
    var data = [];
    try { data = JSON.parse(localStorage.getItem('mahjongScoreHistory') || '[]'); } catch (err) { data = []; }
    if (!data.length) { listEl.innerHTML = '<div class="history-empty">まだ記録がありません。</div>'; return; }
    listEl.innerHTML = data.map(function (d) {
      return '<div class="history-item"><span class="h-meta">' + d.time + ' ・ ' + d.seat + ' ・ ' + d.win + ' ・ ' + d.label + '</span><span class="h-pts">' + d.points.toLocaleString() + '点</span></div>';
    }).join('');
  }

  function renderAll() {
    applyInterlocks();
    renderStatus();
    renderMelds();
    renderPairRow();
    renderChiitoi();
    renderKokushi();
    renderResult();
  }

  // ================= events =================
  function tileOwnerSuit(owner, suit) {
    if (owner === 'pair') {
      state.pair.suit = suit; if (suit === 'z') state.pair.num = Math.min(state.pair.num, 7);
    } else if (owner.indexOf('chiitoi-') === 0) {
      var i = +owner.split('-')[1];
      state.chiitoiPairs[i].suit = suit; if (suit === 'z') state.chiitoiPairs[i].num = Math.min(state.chiitoiPairs[i].num, 7);
    } else if (owner.indexOf('meld-') === 0) {
      var mi = +owner.split('-')[1], m = state.melds[mi];
      if (suit === 'z' && m.type === 'seq') m.type = 'trip';
      m.suit = suit;
      var cap = (suit === 'z') ? 7 : (m.type === 'seq' ? 7 : 9);
      m.num = Math.min(m.num, cap);
    }
  }
  function tileOwnerNum(owner, num) {
    if (owner === 'pair') state.pair.num = num;
    else if (owner.indexOf('chiitoi-') === 0) state.chiitoiPairs[+owner.split('-')[1]].num = num;
    else if (owner.indexOf('meld-') === 0) state.melds[+owner.split('-')[1]].num = num;
  }

  document.addEventListener('click', function (e) {
    var seg = e.target.closest('button[data-group]');
    if (seg) { state[seg.dataset.group] = seg.dataset.value; renderAll(); return; }

    var mtype = e.target.closest('.mini-seg[data-mtype] button');
    if (mtype) {
      var mi = +e.target.closest('.mini-seg').dataset.mtype;
      var m = state.melds[mi];
      var v = mtype.dataset.v;
      if (v === 'seq' && m.suit === 'z') m.suit = 'm';
      m.type = v;
      m.num = Math.min(m.num, v === 'seq' ? 7 : 9);
      renderAll(); return;
    }

    var tpSuit = e.target.closest('[data-tp-suit]');
    if (tpSuit) {
      var owner = tpSuit.closest('[data-owner]').dataset.owner;
      tileOwnerSuit(owner, tpSuit.dataset.tpSuit);
      renderAll(); return;
    }
    var tpNum = e.target.closest('[data-tp-num]');
    if (tpNum) {
      var owner2 = tpNum.closest('[data-owner]').dataset.owner;
      tileOwnerNum(owner2, parseInt(tpNum.dataset.tpNum, 10));
      renderAll(); return;
    }

    var winPos = e.target.closest('[data-winpos]');
    if (winPos) { state.winPos = winPos.dataset.winpos; renderAll(); return; }

    var kokushi = e.target.closest('[data-kokushi]');
    if (kokushi) {
      var type = kokushi.dataset.kokushi;
      var cur = state.kokushiCounts[type] || 0;
      var next = (cur + 1) % 3;
      if (next === 2) {
        Object.keys(state.kokushiCounts).forEach(function (k) { if (k !== type && state.kokushiCounts[k] === 2) state.kokushiCounts[k] = 1; });
      }
      state.kokushiCounts[type] = next;
      renderAll(); return;
    }

    var stepBtn = e.target.closest('.stepper button');
    if (stepBtn) {
      var swrap = stepBtn.closest('[data-stepper]');
      var key = swrap.dataset.stepper;
      var dir = parseInt(stepBtn.dataset.dir, 10);
      state[key] = Math.max(0, Math.min(8, state[key] + dir));
      renderAll(); return;
    }

    var histToggle = e.target.closest('#history-toggle');
    if (histToggle) {
      var body = $('#history-body');
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      histToggle.classList.toggle('open', !open);
      return;
    }
    var clearBtn = e.target.closest('#history-clear');
    if (clearBtn) {
      try { localStorage.removeItem('mahjongScoreHistory'); } catch (err) { /* noop */ }
      renderHistory();
      return;
    }
  });

  document.addEventListener('change', function (e) {
    var winGroup = e.target.closest('input[name="winGroup"]');
    if (winGroup) {
      state.winGroup = winGroup.value === 'pair' ? 'pair' : parseInt(winGroup.value, 10);
      renderAll(); return;
    }
    var kanBox = e.target.closest('input[data-kan]');
    if (kanBox) { state.melds[+kanBox.dataset.kan].kan = kanBox.checked; renderAll(); return; }
    var openBox = e.target.closest('input[data-open]');
    if (openBox) { state.melds[+openBox.dataset.open].open = openBox.checked; renderAll(); return; }
    var ippatsuBox = e.target.closest('#chk-ippatsu');
    if (ippatsuBox) { state.ippatsu = ippatsuBox.checked; renderAll(); return; }
    var sitBox = e.target.closest('[data-sit]');
    if (sitBox) { state.situational[sitBox.dataset.sit] = sitBox.checked; renderAll(); return; }
    var roundSel = e.target.closest('#sel-round');
    if (roundSel) { state.roundWind = parseInt(roundSel.value, 10); renderAll(); return; }
    var seatWindSel = e.target.closest('#sel-seatwind');
    if (seatWindSel) { state.seatWindChild = parseInt(seatWindSel.value, 10); renderAll(); return; }
    var kokushiWinSel = e.target.closest('#kokushi-win');
    if (kokushiWinSel) { state.kokushiWinType = kokushiWinSel.value; renderAll(); return; }
  });

  renderAll();
  renderHistory();
})();
