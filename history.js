const historyStatus = document.getElementById("history-status");
const historyWelcome = document.getElementById("history-welcome");
const historyResults = document.getElementById("history-results");
const historyList = document.getElementById("history-list");
const historyForm = document.getElementById("history-form");
const historyInput = document.getElementById("history-input");
const historyType = document.getElementById("history-type");
const historyExportBtn = document.getElementById("history-export-btn");
const historyImportInput = document.getElementById("history-import-input");
const historyClearBtn = document.getElementById("history-clear-btn");

const TYPE_LABEL = {
  incident: "장애",
  complaint: "민원",
  ask: "질문",
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setHistoryStatus(message, type = "") {
  historyStatus.textContent = message || "";
  historyStatus.className = "status";
  if (type) historyStatus.classList.add(type);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderResponsePreview(record) {
  const r = record.response || {};

  if (record.type === "ask") {
    return `<p class="history-preview">${escapeHtml(String(r.answer || "").slice(0, 200))}${r.answer?.length > 200 ? "…" : ""}</p>`;
  }

  if (record.type === "incident") {
    return `<p class="history-preview">${escapeHtml(r.summary || "")}</p>`;
  }

  return `<p class="history-preview">${escapeHtml(r.summary || r.responseScript || "").slice(0, 200)}</p>`;
}

function renderHistoryDetail(record) {
  const input = record.input || {};
  const r = record.response || {};

  if (record.type === "ask") {
    return `
      <div class="history-detail">
        <p><strong>질문</strong><br>${escapeHtml(input.question || "")}</p>
        <p><strong>답변</strong><br>${escapeHtml(r.answer || "").replace(/\n/g, "<br>")}</p>
      </div>`;
  }

  if (record.type === "incident") {
    return `
      <div class="history-detail">
        <p><strong>솔루션</strong> ${escapeHtml(input.solution || "-")} · <strong>영향</strong> ${escapeHtml(input.impact || "-")}</p>
        <p><strong>증상</strong><br>${escapeHtml(input.symptom || "")}</p>
        <p><strong>환경</strong> ${escapeHtml(input.environment || "-")}</p>
        <hr>
        <p><strong>요약</strong> ${escapeHtml(r.summary || "")}</p>
        ${r.customerNote ? `<p><strong>고객 안내</strong><br>${escapeHtml(r.customerNote)}</p>` : ""}
      </div>`;
  }

  return `
    <div class="history-detail">
      <p><strong>솔루션</strong> ${escapeHtml(input.solution || "-")}</p>
      <p><strong>민원</strong><br>${escapeHtml(input.content || "")}</p>
      <p><strong>요청</strong> ${escapeHtml(input.request || "-")}</p>
      <hr>
      <p><strong>요약</strong> ${escapeHtml(r.summary || "")}</p>
      ${r.responseScript ? `<p><strong>응대 멘트</strong><br>${escapeHtml(r.responseScript)}</p>` : ""}
    </div>`;
}

function renderHistoryList(records) {
  if (!records.length) {
    historyList.innerHTML = `<p class="empty-result">저장된 이력이 없습니다.</p>`;
    return;
  }

  historyList.innerHTML = records
    .map(
      (record) => `
      <article class="history-card" data-history-id="${escapeHtml(record.id)}">
        <div class="history-card-header">
          <span class="history-type-badge history-type-${record.type}">${escapeHtml(TYPE_LABEL[record.type] || record.type)}</span>
          <time class="history-date">${escapeHtml(formatDate(record.createdAt))}</time>
        </div>
        <h3 class="history-title">${escapeHtml(record.title)}</h3>
        ${renderResponsePreview(record)}
        <div class="history-actions">
          <button type="button" class="btn-secondary" data-history-load="${escapeHtml(record.id)}">다시 불러오기</button>
          <button type="button" class="btn-secondary" data-history-toggle="${escapeHtml(record.id)}">상세 보기</button>
          <button type="button" class="btn-danger-text" data-history-delete="${escapeHtml(record.id)}">삭제</button>
        </div>
        <div class="history-detail-wrap hidden" id="history-detail-${escapeHtml(record.id)}">
          ${renderHistoryDetail(record)}
        </div>
      </article>`
    )
    .join("");
}

function refreshHistory() {
  const query = historyInput.value.trim();
  const type = historyType.value;
  const records = HistoryStore.listRecords({ type, query, limit: 100 });

  historyWelcome.classList.toggle("hidden", records.length > 0 || query || type);
  historyResults.classList.remove("hidden");
  renderHistoryList(records);

  if (!records.length && (query || type)) {
    setHistoryStatus("검색 조건에 맞는 이력이 없습니다.", "");
  } else {
    setHistoryStatus(records.length ? `총 ${records.length}건` : "", "");
  }
}

function loadRecordToApp(record) {
  if (!record) return;

  if (record.type === "ask") {
    window.AppShell.switchPanel("ask");
    const askInput = document.getElementById("ask-input");
    if (askInput) askInput.value = record.input.question || "";
    setHistoryStatus("질문을 불러왔습니다.", "");
    return;
  }

  window.AppShell.switchPanel("support");

  if (record.type === "complaint") {
    window.dispatchEvent(
      new CustomEvent("nb114:use-case", {
        detail: {
          mode: "complaint",
          solution: record.input.solution,
          content: record.input.content,
          request: record.input.request,
          environment: record.input.environment,
        },
      })
    );
  } else {
    window.dispatchEvent(
      new CustomEvent("nb114:use-case", {
        detail: {
          mode: "incident",
          solution: record.input.solution,
          symptom: record.input.symptom,
          environment: record.input.environment,
          impact: record.input.impact,
        },
      })
    );
  }

  setHistoryStatus("입력 내용을 불러왔습니다.", "");
}

historyForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  refreshHistory();
});

historyType?.addEventListener("change", refreshHistory);

historyList?.addEventListener("click", (e) => {
  const loadId = e.target.closest("[data-history-load]")?.dataset.historyLoad;
  const toggleId = e.target.closest("[data-history-toggle]")?.dataset.historyToggle;
  const deleteId = e.target.closest("[data-history-delete]")?.dataset.historyDelete;

  if (loadId) {
    loadRecordToApp(HistoryStore.getRecord(loadId));
    return;
  }

  if (toggleId) {
    const el = document.getElementById(`history-detail-${toggleId}`);
    el?.classList.toggle("hidden");
    return;
  }

  if (deleteId) {
    if (!confirm("이 이력을 삭제할까요?")) return;
    HistoryStore.deleteRecord(deleteId);
    refreshHistory();
    setHistoryStatus("삭제했습니다.", "");
  }
});

historyExportBtn?.addEventListener("click", () => {
  const blob = new Blob([HistoryStore.exportJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `solution-qa-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setHistoryStatus("파일로보냈습니다.", "");
});

historyImportInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const count = HistoryStore.importJson(text);
    refreshHistory();
    setHistoryStatus(`${count}건 이력을 가져왔습니다.`, "");
  } catch (err) {
    setHistoryStatus(err.message || "가져오기 실패", "error");
  } finally {
    e.target.value = "";
  }
});

historyClearBtn?.addEventListener("click", () => {
  if (!confirm("저장된 모든 이력을 삭제할까요?")) return;
  HistoryStore.clearAll();
  refreshHistory();
  setHistoryStatus("모든 이력을 삭제했습니다.", "");
});

document.querySelectorAll("[data-history-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    historyType.value = chip.dataset.historyFilter || "";
    historyInput.value = "";
    refreshHistory();
  });
});

window.addEventListener("history:updated", refreshHistory);

window.HistoryUI = { refreshHistory };
