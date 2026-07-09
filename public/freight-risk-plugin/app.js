const fields = [
  {
    key: "shipper",
    label: "Shipper",
    risk: "yellow",
    aliases: ["shipper", "发货人"],
    legalDifference: ({ leftSource, rightSource }) => isMblHblPair(leftSource, rightSource),
    legalMessage: "MBL/HBL 的 Shipper 可能按代理关系合法不同，需按业务规则确认。",
  },
  {
    key: "consignee",
    label: "Consignee",
    risk: "red",
    aliases: ["consignee", "收货人"],
    legalDifference: ({ leftSource, rightSource }) => isMblHblPair(leftSource, rightSource),
    legalMessage: "MBL/HBL 的 Consignee 可能合法不同，但仍建议确认是否符合本票安排。",
  },
  {
    key: "notify",
    label: "Notify Party",
    risk: "red",
    aliases: ["notify party", "notify", "通知人"],
  },
  {
    key: "vesselVoyage",
    label: "Vessel / Voyage",
    risk: "red",
    aliases: ["vessel/voyage", "vessel voyage", "vessel", "船名航次", "船名"],
  },
  {
    key: "pol",
    label: "POL",
    risk: "red",
    aliases: ["pol", "port of loading", "起运港", "装货港"],
  },
  {
    key: "pod",
    label: "POD",
    risk: "red",
    aliases: ["pod", "port of discharge", "目的港", "卸货港"],
  },
  {
    key: "containerNo",
    label: "Container No.",
    risk: "red",
    aliases: ["container no", "container", "cntr no", "柜号", "箱号"],
  },
  {
    key: "sealNo",
    label: "Seal No.",
    risk: "red",
    aliases: ["seal no", "seal", "封号"],
  },
  {
    key: "goods",
    label: "Description of Goods",
    risk: "red",
    aliases: ["description of goods", "goods", "commodity", "品名", "货描"],
  },
  {
    key: "packages",
    label: "Packages",
    risk: "red",
    aliases: ["packages", "package", "pkg", "件数"],
  },
  {
    key: "grossWeight",
    label: "Gross Weight",
    risk: "red",
    aliases: ["gross weight", "g.w.", "gw", "毛重"],
  },
  {
    key: "measurement",
    label: "Measurement",
    risk: "red",
    aliases: ["measurement", "cbm", "volume", "体积"],
  },
  {
    key: "freightTerm",
    label: "Freight Term",
    risk: "red",
    aliases: ["freight term", "freight", "payment term", "运费条款"],
  },
  {
    key: "blType",
    label: "B/L Type",
    risk: "yellow",
    aliases: ["b/l type", "bl type", "bill type", "提单类型"],
  },
  {
    key: "releaseType",
    label: "Release Type",
    risk: "red",
    aliases: ["release type", "release", "放单方式"],
  },
  {
    key: "vgm",
    label: "VGM",
    risk: "yellow",
    aliases: ["vgm"],
  },
];

const sourceNames = {
  si: "SI/补料",
  hbl: "HBL",
  mbl: "MBL",
};

const chargeRules = [
  {
    key: "amendment",
    label: "改单费",
    eventPatterns: [/改单|改提单|amend/i],
    chargePatterns: [/改单费|amendment|amend fee|correction/i],
  },
  {
    key: "inspection",
    label: "查验费",
    eventPatterns: [/查验|inspection|customs exam/i],
    chargePatterns: [/查验费|inspection|exam fee|customs exam/i],
  },
  {
    key: "telex",
    label: "电放费",
    eventPatterns: [/电放|telex release/i],
    chargePatterns: [/电放费|telex/i],
    skipWhen: (text) => /正本|original/i.test(text) && !/电放|telex release/i.test(text),
    skipMessage: "出现正本放单语义，电放费不应强制提示。",
  },
  {
    key: "waiting",
    label: "等候费/压车费",
    eventPatterns: [/等候|压车|waiting|detention of truck/i],
    chargePatterns: [/等候费|压车费|waiting/i],
  },
  {
    key: "storage",
    label: "堆存/仓储费",
    eventPatterns: [/堆存|仓储|storage|demurrage/i],
    chargePatterns: [/堆存|仓储|storage|demurrage/i],
  },
  {
    key: "rollover",
    label: "甩柜/改配费",
    eventPatterns: [/甩柜|改配|rollover|roll over/i],
    chargePatterns: [/甩柜|改配|rollover|roll over/i],
  },
  {
    key: "ics2",
    label: "ICS2",
    eventPatterns: [/ics2/i],
    chargePatterns: [/ics2/i],
    skipWhen: (text) => /非欧盟|not eu|non-eu/i.test(text),
    skipMessage: "非欧盟航线不强制提示 ICS2。",
  },
];

const chargeAliases = {
  ocean: ["ocean freight", "o/f", "海运费"],
  doc: ["doc fee", "document fee", "文件费"],
  amendment: ["amendment", "amend fee", "改单费"],
  inspection: ["inspection", "exam fee", "查验费"],
  telex: ["telex", "电放费"],
  trucking: ["trucking", "truck", "拖车费"],
  customs: ["customs", "declaration", "报关费"],
  waiting: ["waiting", "等候费", "压车费"],
  storage: ["storage", "demurrage", "堆存", "仓储"],
  rollover: ["rollover", "roll over", "甩柜", "改配"],
};

const els = {
  siInput: document.getElementById("siInput"),
  hblInput: document.getElementById("hblInput"),
  mblInput: document.getElementById("mblInput"),
  docsReport: document.getElementById("docsReport"),
  docsSummary: document.getElementById("docsSummary"),
  signedFeeInput: document.getElementById("signedFeeInput"),
  usdDnInput: document.getElementById("usdDnInput"),
  rmbDnInput: document.getElementById("rmbDnInput"),
  vendorBillInput: document.getElementById("vendorBillInput"),
  opsNoteInput: document.getElementById("opsNoteInput"),
  ledgerReport: document.getElementById("ledgerReport"),
  ledgerSummary: document.getElementById("ledgerSummary"),
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

document.getElementById("runDocsBtn").addEventListener("click", () => {
  renderDocsReport(runDocsCheck());
});

document.getElementById("runLedgerBtn").addEventListener("click", () => {
  renderLedgerReport(runLedgerCheck());
});

document.getElementById("loadSampleBtn").addEventListener("click", loadSampleData);
document.getElementById("clearBtn").addEventListener("click", clearAll);

function runDocsCheck() {
  const docs = {
    si: parseDocument(els.siInput.value, "SI/补料"),
    hbl: parseDocument(els.hblInput.value, "HBL"),
    mbl: parseDocument(els.mblInput.value, "MBL"),
  };

  const pairs = [
    ["si", "hbl"],
    ["si", "mbl"],
    ["hbl", "mbl"],
  ];
  const findings = [];

  pairs.forEach(([leftKey, rightKey]) => {
    fields.forEach((field) => {
      const left = docs[leftKey].fields[field.key];
      const right = docs[rightKey].fields[field.key];
      if (!left || !right) return;

      const leftNorm = normalizeValue(left.value);
      const rightNorm = normalizeValue(right.value);
      if (!leftNorm || !rightNorm || leftNorm === rightNorm) return;

      const context = {
        leftSource: sourceNames[leftKey],
        rightSource: sourceNames[rightKey],
        left,
        right,
      };

      if (field.legalDifference?.(context)) {
        findings.push({
          level: "hint",
          field: field.label,
          left: sourceValue(sourceNames[leftKey], left),
          right: sourceValue(sourceNames[rightKey], right),
          detail: field.legalMessage,
          action: "按本票代理关系和客户指令确认，确认后可加入合法差异。",
        });
        return;
      }

      findings.push({
        level: field.risk,
        field: field.label,
        left: sourceValue(sourceNames[leftKey], left),
        right: sourceValue(sourceNames[rightKey], right),
        detail: describeDifference(left.value, right.value),
        action: field.risk === "red" ? "截单前必须确认并修正。" : "需要跟单或主管确认。",
      });
    });
  });

  addMissingFieldFindings(docs, findings);
  return findings;
}

function parseDocument(text, source) {
  const lines = text.split(/\r?\n/);
  const result = { source, fields: {} };

  fields.forEach((field) => {
    const found = findFieldLine(lines, field.aliases);
    if (found) {
      result.fields[field.key] = found;
    }
  });

  return result;
}

function findFieldLine(lines, aliases) {
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    const normalized = raw.toLowerCase();
    const alias = aliases.find((item) => normalized.startsWith(item.toLowerCase()));
    if (!alias) continue;

    const separatorIndex = raw.search(/[:：]/);
    let value = separatorIndex >= 0 ? raw.slice(separatorIndex + 1).trim() : raw.slice(alias.length).trim();
    value = value.replace(/^[-\s]+/, "").trim();

    if (value) {
      return { value, line: index + 1, raw };
    }
  }
  return null;
}

function addMissingFieldFindings(docs, findings) {
  fields.forEach((field) => {
    const presentSources = Object.entries(docs)
      .filter(([, doc]) => Boolean(doc.fields[field.key]))
      .map(([key]) => sourceNames[key]);
    if (presentSources.length > 0 && presentSources.length < 3 && field.risk === "red") {
      findings.push({
        level: "yellow",
        field: field.label,
        left: `已找到：${presentSources.join("、")}`,
        right: "部分资料缺失该字段",
        detail: "关键字段没有在所有材料中出现，可能是资料不完整或格式未识别。",
        action: "确认是否应该补齐，或人工标记为不适用。",
      });
    }
  });
}

function runLedgerCheck() {
  const signed = els.signedFeeInput.value;
  const usdDn = els.usdDnInput.value;
  const rmbDn = els.rmbDnInput.value;
  const vendor = els.vendorBillInput.value;
  const ops = els.opsNoteInput.value;
  const allText = [signed, usdDn, rmbDn, vendor, ops].join("\n");
  const customerText = [signed, usdDn, rmbDn].join("\n");
  const dnText = [usdDn, rmbDn].join("\n");
  const allSources = [
    { name: "签费/客户确认", text: signed },
    { name: "USD DN", text: usdDn },
    { name: "RMB DN", text: rmbDn },
    { name: "供应商账单", text: vendor },
    { name: "操作备注", text: ops },
  ];
  const customerSources = allSources.slice(0, 3);
  const vendorSources = [{ name: "供应商账单", text: vendor }];
  const findings = [];

  chargeRules.forEach((rule) => {
    const eventHit = findPatternInSources(rule.eventPatterns, allSources);
    if (!eventHit) return;

    if (rule.skipWhen?.(allText)) {
      findings.push({
        level: "hint",
        type: "合法差异",
        content: `${rule.label} 触发词：${eventHit.match}`,
        state: rule.skipMessage,
        risk: "不作为漏费红灯。",
        action: `保留提示，必要时由主管确认。证据：${formatHit(eventHit)}`,
      });
      return;
    }

    const vendorHasCharge = findPatternInSources(rule.chargePatterns, vendorSources);
    const customerHasCharge = findPatternInSources(rule.chargePatterns, customerSources);

    if (vendorHasCharge && !customerHasCharge) {
      findings.push({
        level: "red",
        type: "疑似漏收",
        content: `供应商账单出现${rule.label}`,
        state: `客户签费/DN 未发现对应费用。证据：${formatHit(vendorHasCharge)}`,
        risk: "供应商向我方收费，但客户应收可能漏收。",
        action: "放单前补客户确认，或记录内部承担原因。",
      });
      return;
    }

    if (!vendorHasCharge && !customerHasCharge) {
      findings.push({
        level: "yellow",
        type: "费用未闭环",
        content: `操作记录出现${rule.label}相关事件`,
        state: `供应商账单和客户 DN 均未发现对应费用。事件证据：${formatHit(eventHit)}`,
        risk: "可能未产生费用，也可能漏录漏收。",
        action: "要求责任人确认是否收费，并补证据。",
      });
      return;
    }

    if (customerHasCharge) {
      findings.push({
        level: "hint",
        type: "费用已识别",
        content: `发现${rule.label}相关费用`,
        state: `客户侧材料已有对应费用线索。证据：${formatHit(customerHasCharge)}`,
        risk: "仍需确认金额和币种是否正确。",
        action: "核对 DN 金额与最终签费。",
      });
    }
  });

  compareCharges(extractCharges(signed, "签费/客户确认"), extractCharges(dnText, "DN"), findings, "签费", "DN");
  compareCharges(extractCharges(vendor, "供应商账单"), extractCharges(customerText, "客户侧材料"), findings, "供应商账单", "客户侧材料");
  checkSplitDn(usdDn, rmbDn, findings);

  if (!findings.length) {
    findings.push({
      level: "green",
      type: "未发现明显风险",
      content: "当前文本没有触发内置漏费规则。",
      state: "仍需人工复核原始账单。",
      risk: "规则未覆盖的费用仍可能遗漏。",
      action: "建议抽样人工复核。",
    });
  }

  return findings;
}

function extractCharges(text, source) {
  const charges = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const raw = line.trim();
    if (!raw) return;
    const amount = raw.match(/\b(USD|RMB|CNY|\$|￥)?\s*([0-9]+(?:\.[0-9]{1,2})?)\b/i);
    if (!amount) return;

    const key = Object.entries(chargeAliases).find(([, aliases]) =>
      aliases.some((alias) => raw.toLowerCase().includes(alias.toLowerCase())),
    )?.[0];
    if (!key) return;

    const currency = normalizeCurrency(amount[1], raw);
    charges.push({
      key,
      raw,
      line: index + 1,
      source,
      amount: Number(amount[2]),
      currency,
    });
  });
  return charges;
}

function compareCharges(leftCharges, rightCharges, findings, leftName, rightName) {
  leftCharges.forEach((left) => {
    const matches = rightCharges.filter((right) => right.key === left.key);
    if (!matches.length) {
      findings.push({
        level: leftName === "供应商账单" ? "red" : "yellow",
        type: leftName === "供应商账单" ? "疑似漏收" : "疑似漏录",
        content: `${leftName} 有 ${chargeLabel(left.key)} ${left.currency} ${left.amount}`,
        state: `${rightName} 未发现对应费用。证据：${left.source} 第 ${left.line} 行：${left.raw}`,
        risk: leftName === "供应商账单" ? "供应商收费未转客户应收。" : "签费项目未进入 DN。",
        action: "确认是否应补录，或说明不收/内部承担。",
      });
      return;
    }

    matches.forEach((right) => {
      if (left.currency !== right.currency || Math.abs(left.amount - right.amount) > 0.01) {
        findings.push({
          level: "yellow",
          type: "金额/币种不一致",
          content: `${chargeLabel(left.key)}：${leftName} ${left.currency} ${left.amount}，${rightName} ${right.currency} ${right.amount}`,
          state: `发现同类费用但金额或币种不同。证据：${left.source} 第 ${left.line} 行；${right.source} 第 ${right.line} 行`,
          risk: "可能是折扣、拆账、录入错误或漏收差额。",
          action: "找业务/财务确认最终签费和 DN。",
        });
      }
    });
  });
}

function checkSplitDn(usdDn, rmbDn, findings) {
  const hasUsd = /\bUSD\b|\$/i.test(usdDn);
  const hasRmb = /\bRMB\b|\bCNY\b|￥/i.test(rmbDn);
  if (!usdDn.trim() || !rmbDn.trim()) {
    findings.push({
      level: "yellow",
      type: "DN 拆分检查",
      content: "同票 USD/RMB DN 可能未完整提供",
      state: `USD DN：${usdDn.trim() ? "已提供" : "缺失"}；RMB DN：${rmbDn.trim() ? "已提供" : "缺失"}`,
      risk: "同票拆两张 DN 时，缺一张容易漏本地费或海运费。",
      action: "确认本票是否需要 USD/RMB 双 DN。",
    });
    return;
  }
  if (!hasUsd || !hasRmb) {
    findings.push({
      level: "yellow",
      type: "DN 币种检查",
      content: "DN 文本未识别到预期币种",
      state: `USD DN 币种：${hasUsd ? "已识别" : "未识别"}；RMB DN 币种：${hasRmb ? "已识别" : "未识别"}`,
      risk: "可能贴错账单或币种标识缺失。",
      action: "核对 DN 抬头和币种。",
    });
  }
}

function renderDocsReport(findings) {
  renderSummary(els.docsSummary, findings);
  els.docsReport.innerHTML = findings
    .map(
      (item) => `<tr>
        <td>${badge(item.level)}</td>
        <td>${escapeHtml(item.field)}</td>
        <td>${item.left}</td>
        <td>${item.right}</td>
        <td>${item.detail}</td>
        <td>${escapeHtml(item.action)}</td>
      </tr>`,
    )
    .join("");
}

function renderLedgerReport(findings) {
  renderSummary(els.ledgerSummary, findings);
  els.ledgerReport.innerHTML = findings
    .map(
      (item) => `<tr>
        <td>${badge(item.level)}</td>
        <td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(item.content)}</td>
        <td>${escapeHtml(item.state)}</td>
        <td>${escapeHtml(item.risk)}</td>
        <td>${escapeHtml(item.action)}</td>
      </tr>`,
    )
    .join("");
}

function renderSummary(container, findings) {
  const counts = findings.reduce(
    (acc, item) => {
      acc[item.level] = (acc[item.level] || 0) + 1;
      return acc;
    },
    { red: 0, yellow: 0, hint: 0, green: 0 },
  );
  container.innerHTML = [
    pill("red", `红灯 ${counts.red || 0}`),
    pill("yellow", `黄灯 ${counts.yellow || 0}`),
    pill("hint", `提示 ${counts.hint || 0}`),
    pill("green", `通过 ${counts.green || 0}`),
  ].join("");
}

function badge(level) {
  const labels = { red: "红灯", yellow: "黄灯", hint: "提示", green: "通过" };
  return `<span class="badge ${level}">${labels[level] || level}</span>`;
}

function pill(level, text) {
  return `<span class="pill ${level}">${escapeHtml(text)}</span>`;
}

function sourceValue(source, field) {
  return `${escapeHtml(field.value)}<span class="evidence">${source} 第 ${field.line} 行</span>`;
}

function normalizeValue(value) {
  return value
    .toUpperCase()
    .replace(/[.,，。;；:：()\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function describeDifference(left, right) {
  const diff = firstDiff(left, right);
  if (!diff) return "内容不一致，需要人工确认。";
  return `字符级差异：${highlightAt(left, diff.leftIndex)} vs ${highlightAt(right, diff.rightIndex)}`;
}

function firstDiff(left, right) {
  const leftText = left.trim();
  const rightText = right.trim();
  const max = Math.max(leftText.length, rightText.length);
  for (let index = 0; index < max; index += 1) {
    if (leftText[index] !== rightText[index]) {
      return { leftIndex: Math.min(index, leftText.length - 1), rightIndex: Math.min(index, rightText.length - 1) };
    }
  }
  return null;
}

function highlightAt(text, index) {
  const safe = escapeHtml(text);
  if (index < 0 || !safe) return safe;
  const raw = text.trim();
  return `${escapeHtml(raw.slice(0, index))}<span class="diff">${escapeHtml(raw[index] || "缺失")}</span>${escapeHtml(raw.slice(index + 1))}`;
}

function findPattern(patterns, text) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { pattern, match: match[0] };
  }
  return null;
}

function findPatternInSources(patterns, sources) {
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index];
      for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
          return {
            source: source.name,
            line: index + 1,
            raw: raw.trim(),
            pattern,
            match: match[0],
          };
        }
      }
    }
  }
  return null;
}

function formatHit(hit) {
  return `${hit.source} 第 ${hit.line} 行：${hit.raw}`;
}

function normalizeCurrency(token, raw) {
  if (/USD|\$/i.test(token || "") || /\bUSD\b|\$/i.test(raw)) return "USD";
  if (/RMB|CNY|￥/i.test(token || "") || /\bRMB\b|\bCNY\b|￥/i.test(raw)) return "RMB";
  return "未标币种";
}

function chargeLabel(key) {
  const labels = {
    ocean: "海运费",
    doc: "文件费",
    amendment: "改单费",
    inspection: "查验费",
    telex: "电放费",
    trucking: "拖车费",
    customs: "报关费",
    waiting: "等候费",
    storage: "堆存/仓储费",
    rollover: "甩柜/改配费",
  };
  return labels[key] || key;
}

function isMblHblPair(leftSource, rightSource) {
  return [leftSource, rightSource].includes("MBL") && [leftSource, rightSource].includes("HBL");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadSampleData() {
  els.siInput.value = `Shipper: NINGBO EXPORT CO., LTD
Consignee: ABC TRADING CO., LTD
Notify Party: SAME AS CONSIGNEE
Vessel / Voyage: COSCO STAR 128E
POL: NINGBO
POD: HAMBURG
Container No.: TLLU1234567
Seal No.: CN998877
Description of Goods: LED LIGHTS
Packages: 800 CTNS
Gross Weight: 18500 KGS
Measurement: 58.6 CBM
Freight Term: PREPAID
Release Type: TELEX RELEASE`;

  els.hblInput.value = `Shipper: NINGBO EXPORT CO., LTD
Consignee: ABC TRADNG CO., LTD
Notify Party: SAME AS CONSIGNEE
Vessel / Voyage: COSCO STAR 128E
POL: NINGBO
POD: HAMBURG
Container No.: TLLU1234567
Seal No.: CN998877
Description of Goods: LED LIGHTS
Packages: 800 CTNS
Gross Weight: 15800 KGS
Measurement: 58.6 CBM
Freight Term: PREPAID
Release Type: TELEX RELEASE`;

  els.mblInput.value = `Shipper: FORWARDER NINGBO BRANCH
Consignee: DESTINATION AGENT GMBH
Notify Party: DESTINATION AGENT GMBH
Vessel / Voyage: COSCO STAR 128E
POL: NINBGO
POD: HAMBURG
Container No.: TLLU1234567
Seal No.: CN998877
Description of Goods: LED LIGHTS
Packages: 800 CTNS
Gross Weight: 18500 KGS
Measurement: 58.6 CBM
Freight Term: COLLECT
Release Type: TELEX RELEASE`;

  els.signedFeeInput.value = `Ocean Freight USD 800
Doc Fee RMB 450
Telex Fee RMB 300`;
  els.usdDnInput.value = `Ocean Freight USD 800`;
  els.rmbDnInput.value = `Doc Fee RMB 450`;
  els.vendorBillInput.value = `Ocean Freight USD 760
Amendment Fee USD 50
Telex Fee RMB 300`;
  els.opsNoteInput.value = `客户改单一次，船司已收 amendment fee。
本票已电放，客户要求尽快放单。`;

  renderDocsReport(runDocsCheck());
  renderLedgerReport(runLedgerCheck());
}

function clearAll() {
  Object.values(els).forEach((el) => {
    if (el && "value" in el) el.value = "";
  });
  els.docsReport.innerHTML = "";
  els.ledgerReport.innerHTML = "";
  els.docsSummary.innerHTML = "";
  els.ledgerSummary.innerHTML = "";
}
