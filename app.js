const PANELS = {
  ask: {
    el: document.getElementById("panel-ask"),
    title: "솔루션 문서 Q&A",
    subtitle: "메뉴얼 검색 · AI 질문 답변",
    footer: "AI가 문서를 참고해 답변합니다. 공식 문서와 반드시 대조해 확인하세요.",
  },
  search: {
    el: document.getElementById("panel-search"),
    title: "솔루션 문서 검색",
    subtitle: "키워드 검색 · 관련 구간 · 출처 확인",
    footer: "검색 결과는 임베딩·키워드 기반으로 정렬됩니다.",
  },
  support: {
    el: document.getElementById("panel-support"),
    title: "장애·민원 대응",
    subtitle: "메뉴얼 기반 장애 조치 · 민원 응대안",
    footer: "대응안은 인덱싱된 메뉴얼·Runbook 기준이며, 현장 상황에 맞게 검증 후 적용하세요.",
  },
};

let activePanel = "ask";

function switchPanel(name) {
  if (!PANELS[name]) return;

  activePanel = name;
  const meta = PANELS[name];

  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === name);
  });

  Object.entries(PANELS).forEach(([key, panel]) => {
    const isActive = key === name;
    panel.el.classList.toggle("hidden", !isActive);
    panel.el.classList.toggle("panel-active", isActive);
  });

  document.title = meta.title;
  document.getElementById("brand-subtitle").textContent = meta.subtitle;
  document.getElementById("footer-text").textContent = meta.footer;
}

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchPanel(tab.dataset.panel));
});

window.AppShell = { switchPanel, getActivePanel: () => activePanel };
