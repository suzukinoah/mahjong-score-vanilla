/**
 * 麻雀点数計算エンジン(DOM非依存の純粋ロジック)
 * 標準形(4面子+雀頭)・七対子・国士無双の役判定、符計算、点数計算を行う。
 */
(function (global) {
  "use strict";

  function suitOf(c) { return c.slice(-1); }
  function numOf(c) { return parseInt(c.slice(0, -1), 10); }
  function isHonor(c) { return suitOf(c) === 'z'; }
  function isTerminal(c) { return !isHonor(c) && (numOf(c) === 1 || numOf(c) === 9); }
  function isYaochuu(c) { return isHonor(c) || isTerminal(c); }
  function isDragon(c) { return isHonor(c) && numOf(c) >= 5; }
  function isWind(c) { return isHonor(c) && numOf(c) <= 4; }
  function tcode(suit, num) { return num + suit; }

  var DRAGON_NAME = { 5: '白', 6: '發', 7: '中' };
  var HONOR_NAME = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };
  var SUIT_CHAR = { m: '萬', p: '筒', s: '索' };
  var SUIT_FULL = { m: '萬子', p: '筒子', s: '索子', z: '字牌' };
  function tileLabel(suit, num) { return suit === 'z' ? HONOR_NAME[num] : (num + SUIT_CHAR[suit]); }

  function meldTiles(m) {
    if (m.type === 'seq') return [tcode(m.suit, m.num), tcode(m.suit, m.num + 1), tcode(m.suit, m.num + 2)];
    var n = m.kan ? 4 : 3, arr = [];
    for (var i = 0; i < n; i++) arr.push(tcode(m.suit, m.num));
    return arr;
  }

  // ロンで刻子を完成させた場合は明刻扱い(暗刻扱いにならない)というルールを反映
  function effectiveOpen(m, idx, ctx) {
    if (m.type === 'trip' && !m.kan && ctx.winGroup === idx && ctx.win === 'ron') return true;
    return m.open;
  }

  function meldFu(m, idx, ctx) {
    if (m.type === 'seq') return 0;
    var yaochuu = isYaochuu(tcode(m.suit, m.num));
    var base = m.kan ? (yaochuu ? 32 : 16) : (yaochuu ? 8 : 4);
    return effectiveOpen(m, idx, ctx) ? base / 2 : base;
  }

  function waitFu(melds, ctx) {
    if (ctx.winGroup === 'pair') return 2; // 単騎
    var m = melds[ctx.winGroup];
    if (m.type === 'trip') return 0; // シャンポン扱い
    if (ctx.winPos === 'mid') return 2; // 嵌張
    if (m.num === 1 && ctx.winPos === 'high') return 2; // 辺張(1-2-3の3)
    if (m.num === 7 && ctx.winPos === 'low') return 2; // 辺張(7-8-9の7)
    return 0; // 両面
  }

  function pairFuVal(pair, ctx) {
    var c = tcode(pair.suit, pair.num);
    var yakuhai = isDragon(c) || (isWind(c) && (pair.num === ctx.seatWind || pair.num === ctx.roundWind));
    if (!yakuhai) return 0;
    var doubleWind = isWind(c) && pair.num === ctx.seatWind && pair.num === ctx.roundWind;
    return doubleWind ? 4 : 2;
  }

  function roundUp10(n) { return Math.ceil(n / 10) * 10; }
  function roundUp100(n) { return Math.ceil(n / 100) * 100; }

  function isPinfu(melds, pair, ctx) {
    if (!ctx.closed) return false;
    if (melds.some(function (m) { return m.type !== 'seq'; })) return false;
    if (pairFuVal(pair, ctx) !== 0) return false;
    if (ctx.winGroup === 'pair') return false;
    return waitFu(melds, ctx) === 0;
  }

  function computeStandardFu(melds, pair, ctx) {
    if (isPinfu(melds, pair, ctx)) return { fu: ctx.win === 'tsumo' ? 20 : 30, detail: ['平和により固定'] };
    var base = 20, detail = ['副底 20符'];
    if (ctx.closed && ctx.win === 'ron') { base += 10; detail.push('門前ロン +10符'); }
    if (ctx.win === 'tsumo') { base += 2; detail.push('自摸 +2符'); }
    melds.forEach(function (m, i) {
      var f = meldFu(m, i, ctx);
      if (f > 0) { base += f; detail.push('面子' + (i + 1) + ' +' + f + '符'); }
    });
    var pf = pairFuVal(pair, ctx);
    if (pf > 0) { base += pf; detail.push('雀頭 +' + pf + '符'); }
    var wf = waitFu(melds, ctx);
    if (wf > 0) { base += wf; detail.push('待ち +' + wf + '符'); }
    return { fu: roundUp10(base), detail: detail };
  }

  function detectStandardYaku(melds, pair, ctx) {
    var list = [], yakuman = [];
    var allTiles = [];
    melds.forEach(function (m) { meldTiles(m).forEach(function (t) { allTiles.push(t); }); });
    allTiles.push(tcode(pair.suit, pair.num), tcode(pair.suit, pair.num));

    var allSimples = allTiles.every(function (t) { return !isYaochuu(t); });
    var allTerminalOrHonor = allTiles.every(function (t) { return isYaochuu(t); });
    var allHonor = allTiles.every(isHonor);
    var allTerminal = allTiles.every(isTerminal);
    var suitsUsed = {}, hasHonorTile = false;
    allTiles.forEach(function (t) { if (isHonor(t)) hasHonorTile = true; else suitsUsed[suitOf(t)] = true; });
    var nonHonorSuits = Object.keys(suitsUsed);
    var isPureFlush = nonHonorSuits.length === 1 && !hasHonorTile;
    var isMixedFlush = nonHonorSuits.length === 1 && hasHonorTile;

    var seqs = melds.filter(function (m) { return m.type === 'seq'; });
    var trips = melds.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.type === 'trip'; });
    var allTrips = trips.length === 4;
    var closed = ctx.closed;

    var pinfu = isPinfu(melds, pair, ctx);
    if (pinfu) list.push({ name: '平和', han: 1 });

    melds.forEach(function (m) {
      if (m.type !== 'trip') return;
      var c = tcode(m.suit, m.num);
      if (isDragon(c)) list.push({ name: '役牌・' + DRAGON_NAME[m.num], han: 1 });
      else if (isWind(c)) {
        if (m.num === ctx.seatWind) list.push({ name: '役牌・自風', han: 1 });
        if (m.num === ctx.roundWind) list.push({ name: '役牌・場風', han: 1 });
      }
    });

    if (allSimples) list.push({ name: '断幺九', han: 1 });

    if (closed && seqs.length >= 2) {
      var counts = {};
      seqs.forEach(function (m) { var k = m.suit + m.num; counts[k] = (counts[k] || 0) + 1; });
      var pairCount = 0;
      Object.keys(counts).forEach(function (k) { pairCount += Math.floor(counts[k] / 2); });
      if (pairCount === 2) list.push({ name: '二盃口', han: 3 });
      else if (pairCount === 1) list.push({ name: '一盃口', han: 1 });
    }

    if (seqs.length >= 3) {
      var byStart = {};
      seqs.forEach(function (m) { byStart[m.num] = byStart[m.num] || {}; byStart[m.num][m.suit] = true; });
      var sanshoku = Object.keys(byStart).some(function (s) { return byStart[s].m && byStart[s].p && byStart[s].s; });
      if (sanshoku) list.push({ name: '三色同順', han: closed ? 2 : 1 });
    }
    if (trips.length >= 3) {
      var byNum = {};
      trips.forEach(function (t) {
        if (isHonor(tcode(t.m.suit, t.m.num))) return;
        byNum[t.m.num] = byNum[t.m.num] || {}; byNum[t.m.num][t.m.suit] = true;
      });
      var sanshokuDoukou = Object.keys(byNum).some(function (n) { return byNum[n].m && byNum[n].p && byNum[n].s; });
      if (sanshokuDoukou) list.push({ name: '三色同刻', han: 2 });
    }
    ['m', 'p', 's'].forEach(function (suit) {
      var starts = seqs.filter(function (m) { return m.suit === suit; }).map(function (m) { return m.num; });
      if (starts.indexOf(1) >= 0 && starts.indexOf(4) >= 0 && starts.indexOf(7) >= 0) {
        list.push({ name: '一気通貫', han: closed ? 2 : 1 });
      }
    });

    var everyGroupHasYaochuu = melds.every(function (m) {
      if (m.type === 'seq') return m.num === 1 || m.num === 7;
      return isYaochuu(tcode(m.suit, m.num));
    }) && isYaochuu(tcode(pair.suit, pair.num));
    var hasAnySeq = seqs.length > 0;
    var hasHonorInSets = melds.some(function (m) { return m.type === 'trip' && isHonor(tcode(m.suit, m.num)); }) || isHonor(tcode(pair.suit, pair.num));
    if (everyGroupHasYaochuu && hasAnySeq) {
      if (hasHonorInSets) list.push({ name: '混全帯幺九', han: closed ? 2 : 1 });
      else list.push({ name: '純全帯幺九', han: closed ? 3 : 2 });
    }

    if (allTrips) list.push({ name: '対々和', han: 2 });

    var ankouCount = melds.filter(function (m, i) { return m.type === 'trip' && !effectiveOpen(m, i, ctx); }).length;
    if (ankouCount >= 3 && ankouCount < 4) list.push({ name: '三暗刻', han: 2 });

    if (!hasAnySeq && allTerminalOrHonor && !allHonor) list.push({ name: '混老頭', han: 2 });

    var dragonTrips = trips.filter(function (t) { return isDragon(tcode(t.m.suit, t.m.num)); }).length;
    var dragonPair = isDragon(tcode(pair.suit, pair.num));
    if (dragonTrips === 3) yakuman.push({ name: '大三元', mult: 1 });
    else if (dragonTrips === 2 && dragonPair) list.push({ name: '小三元', han: 2 });

    var windTrips = trips.filter(function (t) { return isWind(tcode(t.m.suit, t.m.num)); }).length;
    var windPair = isWind(tcode(pair.suit, pair.num));
    if (windTrips === 4) yakuman.push({ name: '大四喜', mult: 2 });
    else if (windTrips === 3 && windPair) yakuman.push({ name: '小四喜', mult: 1 });

    if (isPureFlush) list.push({ name: '清一色', han: closed ? 6 : 5 });
    else if (isMixedFlush) list.push({ name: '混一色', han: closed ? 3 : 2 });

    if (allHonor) yakuman.push({ name: '字一色', mult: 1 });
    if (allTerminal) yakuman.push({ name: '清老頭', mult: 1 });
    var green = ['2s', '3s', '4s', '6s', '8s', '6z'];
    if (allTiles.every(function (t) { return green.indexOf(t) >= 0; })) yakuman.push({ name: '緑一色', mult: 1 });

    var kanCount = melds.filter(function (m) { return m.type === 'trip' && m.kan; }).length;
    if (kanCount === 4) yakuman.push({ name: '四槓子', mult: 1 });

    if (ankouCount === 4) {
      var tanki = ctx.winGroup === 'pair';
      yakuman.push({ name: tanki ? '四暗刻単騎' : '四暗刻', mult: tanki ? 2 : 1 });
    }
    return { list: list, yakuman: yakuman };
  }

  function detectChiitoiYaku(pairs) {
    var tiles = pairs.map(function (p) { return tcode(p.suit, p.num); });
    var list = [{ name: '七対子', han: 2 }];
    if (tiles.every(function (t) { return !isYaochuu(t); })) list.push({ name: '断幺九', han: 1 });
    var suitsUsed = {}, hasHonorTile = false;
    tiles.forEach(function (t) { if (isHonor(t)) hasHonorTile = true; else suitsUsed[suitOf(t)] = true; });
    var nonHonorSuits = Object.keys(suitsUsed);
    if (nonHonorSuits.length === 1 && !hasHonorTile) list.push({ name: '清一色', han: 6 });
    else if (nonHonorSuits.length === 1 && hasHonorTile) list.push({ name: '混一色', han: 3 });
    return { list: list, yakuman: [] };
  }

  function scoreFromHanFu(han, fu) {
    if (han >= 13) return 8000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    if (han === 5) return 2000;
    return Math.min(fu * Math.pow(2, 2 + han), 2000);
  }

  function scoreLabel(han, fu) {
    if (han >= 13) return '数え役満';
    if (han >= 11) return '三倍満';
    if (han >= 8) return '倍満';
    if (han >= 6) return '跳満';
    if (han === 5) return '満貫';
    if (han < 5 && fu * Math.pow(2, 2 + han) >= 2000) return '満貫';
    return null;
  }

  function paymentInfo(base, seat, win) {
    if (win === 'tsumo') {
      if (seat === 'dealer') {
        var each = roundUp100(base * 2);
        return { total: each * 3, text: each.toLocaleString() + '点オール' };
      }
      var dealerPay = roundUp100(base * 2), otherPay = roundUp100(base * 1);
      return { total: dealerPay + otherPay * 2, text: '子 ' + otherPay.toLocaleString() + '点 / 親 ' + dealerPay.toLocaleString() + '点' };
    }
    var payer = roundUp100(base * (seat === 'dealer' ? 6 : 4));
    return { total: payer, text: (seat === 'dealer' ? '子全員が ' : '放銃者が ') + payer.toLocaleString() + '点' };
  }

  function computeResult(state) {
    var ctx = {
      seatWind: state.seat === 'dealer' ? 1 : state.seatWindChild,
      roundWind: state.roundWind,
      closed: state.open === 'closed',
      win: state.win,
      winGroup: state.winGroup,
      winPos: state.winPos
    };

    if (state.shape === 'kokushi') {
      var counts = state.kokushiCounts;
      var types = Object.keys(counts);
      var total = types.reduce(function (s, k) { return s + counts[k]; }, 0);
      var doubled = types.filter(function (k) { return counts[k] === 2; });
      var allPresent = types.every(function (k) { return counts[k] >= 1; });
      if (total !== 14 || doubled.length !== 1 || !allPresent) {
        return { error: '国士無双は13種の么九牌をすべて1枚以上、いずれか1種のみ2枚(合計14枚)にしてください。現在 ' + total + '枚です。' };
      }
      var thirteenWait = doubled[0] === state.kokushiWinType;
      var mult = thirteenWait ? 2 : 1;
      var base = 8000 * mult;
      var pay = paymentInfo(base, state.seat, state.win);
      return {
        yakumanMode: true,
        label: thirteenWait ? '国士無双十三面待ち' : '国士無双',
        units: mult, base: base, payment: pay,
        yakuList: [{ name: thirteenWait ? '国士無双十三面待ち' : '国士無双', tag: mult >= 2 ? '二倍役満' : '役満' }],
        fuDetail: []
      };
    }

    var structural, fuInfo;
    if (state.shape === 'chiitoi') {
      var uniq = {}, dup = false;
      state.chiitoiPairs.forEach(function (p) { var k = tcode(p.suit, p.num); if (uniq[k]) dup = true; uniq[k] = true; });
      if (dup) return { error: '七対子は7つとも異なる牌にしてください。同じ牌が重複しています。' };
      structural = detectChiitoiYaku(state.chiitoiPairs);
      fuInfo = { fu: 25, detail: ['七対子は25符固定'] };
    } else {
      structural = detectStandardYaku(state.melds, state.pair, ctx);
      fuInfo = computeStandardFu(state.melds, state.pair, ctx);
    }

    var yakuList = structural.list.slice();
    var yakumanList = structural.yakuman.slice();

    if (state.riichi === 'riichi') yakuList.push({ name: '立直', han: 1 });
    if (state.riichi === 'double') yakuList.push({ name: 'ダブル立直', han: 2 });
    if (ctx.closed && state.win === 'tsumo') yakuList.push({ name: '門前清自摸和', han: 1 });
    if (state.ippatsu && state.riichi !== 'none') yakuList.push({ name: '一発', han: 1 });
    if (state.situational.rinshan) yakuList.push({ name: '嶺上開花', han: 1 });
    if (state.situational.chankan) yakuList.push({ name: '槍槓', han: 1 });
    if (state.situational.haitei) yakuList.push({ name: '海底摸月', han: 1 });
    if (state.situational.houtei) yakuList.push({ name: '河底撈魚', han: 1 });
    if (state.situational.tenchi) yakumanList.push({ name: state.seat === 'dealer' ? '天和' : '地和', mult: 1 });

    var yakumanBase = yakumanList.reduce(function (s, y) { return s + 8000 * y.mult; }, 0);
    if (yakumanBase > 0) {
      var units = yakumanList.reduce(function (s, y) { return s + y.mult; }, 0);
      var pay2 = paymentInfo(yakumanBase, state.seat, state.win);
      return {
        yakumanMode: true,
        label: units >= 2 ? units + '倍役満' : '役満',
        units: units, base: yakumanBase, payment: pay2,
        yakuList: yakumanList.map(function (y) { return { name: y.name, tag: y.mult >= 2 ? '二倍役満' : '役満' }; }),
        fuDetail: []
      };
    }

    var yakuHan = yakuList.reduce(function (s, y) { return s + y.han; }, 0);
    if (yakuHan <= 0) {
      return { error: '役が確定していません。ドラだけでは和了できません。順子・刻子の組み方や役牌の風を確認してください。' };
    }
    var doraHan = state.dora + state.aka + state.ura;
    var han = yakuHan + doraHan;
    var fu = fuInfo.fu;
    var base = scoreFromHanFu(han, fu);
    var label = scoreLabel(han, fu);
    var pay = paymentInfo(base, state.seat, state.win);
    if (doraHan > 0) yakuList.push({ name: 'ドラ', han: doraHan });

    return { yakumanMode: false, label: label, han: han, fu: fu, base: base, payment: pay, yakuList: yakuList, fuDetail: fuInfo.detail };
  }

  global.MahjongEngine = {
    computeResult: computeResult,
    tileLabel: tileLabel,
    SUIT_FULL: SUIT_FULL,
    HONOR_NAME: HONOR_NAME
  };
})(window);
