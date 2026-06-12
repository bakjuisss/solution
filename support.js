const supportStatus = document.getElementById("support-status");
const supportWelcome = document.getElementById("support-welcome");
const supportWelcomeTitle = document.getElementById("support-welcome-title");
const supportWelcomeDesc = document.getElementById("support-welcome-desc");
const supportSuggestions = document.getElementById("support-suggestions");
const supportResults = document.getElementById("support-results");
const incidentForm = document.getElementById("incident-form");
const complaintForm = document.getElementById("complaint-form");
const incidentBtn = document.getElementById("incident-btn");
const complaintBtn = document.getElementById("complaint-btn");

let activeSupportMode = "incident";

const SEVERITY_LABEL = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "긴급",
};

const PRESETS = {
  "incident-agent": {
    mode: "incident",
    solution: "PCGuard",
    symptom: "에이전트가 관리 서버에 연결되지 않습니다. 방화벽 설정은 완료된 상태입니다.",
    environment: "Windows 11, 내부망",
    impact: "부서/그룹",
  },
  "incident-license": {
    mode: "incident",
    solution: "PCGuard",
    symptom: "라이선스 등록 후에도 에이전트 수가 0으로 표시되고 라이선스 오류가 발생합니다.",
    environment: "Windows Server 2019",
    impact: "전사",
  },
  "complaint-slow": {
    mode: "complaint",
    solution: "PCGuard",
    content: "PCGuard 설치 이후 PC 속도가 느려졌다고 민원이 접수되었습니다.",
    request: "원인 설명 및 성능 영향 안내",
    environment: "Windows 10, 일반 사무용 PC",
  },
  "complaint-remove": {
    mode: "complaint",
    solution: "PCGuard",
    content: "솔루션 제거 방법과 제거 시 보안 정책 해제 여부를 문의합니다.",
    request: "제거 절차 및 유의사항 안내",
    environment: "Windows 11",
  },
};

const WELCOME_COPY = {
  incident: {
    title: "장애 대응 방안 생성",
    desc: "메뉴얼·Runbook을 검색해 증상별 확인 순서, 조치, 에스컬레이션 기준을 제안합니다.",
    chips: `
      <button type="button" class="suggestion-chip" data-support-preset="incident-agent">에이전트 연결 실패</button>
      <button type="button" class="suggestion-chip" data-support-preset="incident-license">라이선스 오류</button>`,
  },
  complaint: {
    title: "민원 대응 방안 생성",
    desc: "메뉴얼·응대 가이드를 검색해 고객 응대 멘트와 내부 조치를 분리해 제안합니다.",
    chips: `
      <button type="button" class="suggestion-chip" data-support-preset="complaint-slow">성능 저하 민원</button>
      <button type="button" class="suggestion-chip" data-support-preset="complaint-remove">제거 방법 문의</button>`,
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setSupportStatus(message, type = "") {
  supportStatus.textContent = message || "";
  supportStatus.className = "status";
  if (type) supportStatus.classList.add(type);
}

function renderList(items, emptyText = "항목 없음") {
  if (!items?.length) return `<p class="empty-inline">${escapeHtml(emptyText)}</p>`;
  return `<ol class="response-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function renderIncidentResponse(data) {
  const r = data.response;
  const severity = SEVERITY_LABEL[r.severity] || r.severity || "보통";

  return `
    <article class="response-card">
      <div class="response-header">
        <h3>장애 대응안</h3>
        <span class="severity-badge severity-${r.severity || "medium"}">${escapeHtml(severity)}</span>
      </div>
      ${r.docNotFound ? '<p class="doc-warning">관련 문서를 찾지 못했습니다. 담당자 확인이 필요합니다.</p>' : ""}
      <section class="response-section">
        <h4>증상 요약</h4>
        <p>${escapeHtml(r.summary || "")}</p>
      </section>
      <section class="response-section">
        <h4>가능 원인</h4>
        ${renderList(r.possibleCauses)}
      </section>
      <section class="response-section">
        <h4>확인 순서</h4>
        ${renderList(r.checklist)}
      </section>
      <section class="response-section">
        <h4>조치 방법</h4>
        ${renderList(r.actions)}
      </section>
      <section class="response-section">
        <h4>에스컬레이션</h4>
        <p>${escapeHtml(r.escalation || "")}</p>
      </section>
      <section class="response-section response-highlight">
        <h4>고객 안내 요약</h4>
        <p>${escapeHtml(r.customerNote || "")}</p>
      </section>
    </article>`;
}

function renderComplaintResponse(data) {
  const r = data.response;

  return `
    <article class="response-card">
      <div class="response-header">
        <h3>민원 대응안</h3>
      </div>
      ${r.docNotFound ? '<p class="doc-warning">관련 문서를 찾지 못했습니다. 담당 부서 확인이 필요합니다.</p>' : ""}
      <section class="response-section">
        <h4>민원 요약</h4>
        <p>${escapeHtml(r.summary || "")}</p>
      </section>
      <section class="response-section">
        <h4>상황 이해</h4>
        <p>${escapeHtml(r.understanding || "")}</p>
      </section>
      <section class="response-section response-highlight">
        <h4>고객 응대 멘트</h4>
        <p class="script-text">${escapeHtml(r.responseScript || "")}</p>
      </section>
      <section class="response-section">
        <h4>내부 조치</h4>
        ${renderList(r.internalActions)}
      </section>
      <section class="response-section">
        <h4>에스컬레이션</h4>
        <p>${escapeHtml(r.escalation || "")}</p>
      </section>
      <section class="response-section">
        <h4>후속 안내</h4>
        <p>${escapeHtml(r.followUp || "")}</p>
      </section>
    </article>`;
}

function switchSupportMode(mode) {
  activeSupportMode = mode;
  const copy = WELCOME_COPY[mode];

  document.querySelectorAll(".support-mode-tab").forEach((tab) => {
    const isActive = tab.dataset.supportMode === mode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  incidentForm.classList.toggle("hidden", mode !== "incident");
  complaintForm.classList.toggle("hidden", mode !== "complaint");

  supportWelcomeTitle.textContent = copy.title;
  supportWelcomeDesc.textContent = copy.desc;
  supportSuggestions.innerHTML = copy.chips;
  bindPresetChips();
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청 처리에 실패했습니다.");
  return data;
}

async function handleRespond(mode, payload, btn) {
  setSupportStatus(
    mode === "incident" ? "장애 대응 문서를 검색하는 중..." : "민원 응대 문서를 검색하는 중...",
    "loading"
  );
  btn.disabled = true;

  try {
    const data = await postJson("/api/respond", { mode, ...payload });

    supportWelcome.classList.add("hidden");
    supportResults.classList.remove("hidden");
    supportResults.innerHTML =
      mode === "incident" ? renderIncidentResponse(data) : renderComplaintResponse(data);

    setSupportStatus("", "");
    supportResults.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setSupportStatus(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function applyPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;

  switchSupportMode(preset.mode);

  if (preset.mode === "incident") {
    document.getElementById("incident-solution").value = preset.solution || "";
    document.getElementById("incident-symptom").value = preset.symptom || "";
    document.getElementById("incident-environment").value = preset.environment || "";
    document.getElementById("incident-impact").value = preset.impact || "";
  } else {
    document.getElementById("complaint-solution").value = preset.solution || "";
    document.getElementById("complaint-content").value = preset.content || "";
    document.getElementById("complaint-request").value = preset.request || "";
    document.getElementById("complaint-environment").value = preset.environment || "";
  }
}

function bindPresetChips() {
  document.querySelectorAll("[data-support-preset]").forEach((chip) => {
    chip.addEventListener("click", () => applyPreset(chip.dataset.supportPreset));
  });
}

document.querySelectorAll(".support-mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchSupportMode(tab.dataset.supportMode));
});

incidentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const symptom = document.getElementById("incident-symptom").value.trim();
  if (!symptom) {
    setSupportStatus("증상을 입력해 주세요.", "error");
    return;
  }
  handleRespond("incident", {
    solution: document.getElementById("incident-solution").value.trim(),
    symptom,
    environment: document.getElementById("incident-environment").value.trim(),
    impact: document.getElementById("incident-impact").value,
  }, incidentBtn);
});

complaintForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const content = document.getElementById("complaint-content").value.trim();
  if (!content) {
    setSupportStatus("민원 내용을 입력해 주세요.", "error");
    return;
  }
  handleRespond("complaint", {
    solution: document.getElementById("complaint-solution").value.trim(),
    content,
    request: document.getElementById("complaint-request").value.trim(),
    environment: document.getElementById("complaint-environment").value.trim(),
  }, complaintBtn);
});

bindPresetChips();
