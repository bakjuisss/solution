const nb114Status = document.getElementById("nb114-status");
const nb114Form = document.getElementById("nb114-form");
const nb114Input = document.getElementById("nb114-input");
const nb114Solution = document.getElementById("nb114-solution");
const nb114Btn = document.getElementById("nb114-btn");
const nb114Welcome = document.getElementById("nb114-welcome");
const nb114Results = document.getElementById("nb114-results");
const nb114List = document.getElementById("nb114-list");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setNb114Status(message, type = "") {
  nb114Status.textContent = message || "";
  nb114Status.className = "status";
  if (type) nb114Status.classList.add(type);
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

function renderInquiryCard(item) {
  const tags = (item.tags || [])
    .map((tag) => `<span class="nb114-tag">${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="nb114-card" data-inquiry-id="${escapeHtml(item.id)}">
      <div class="nb114-card-header">
        <div>
          <h3>${escapeHtml(item.title || item.id)}</h3>
          <p class="nb114-meta">
            ${escapeHtml(item.id)} · ${escapeHtml(item.solution || "-")} · ${escapeHtml(item.date || "-")}
            ${item.customer ? ` · ${escapeHtml(item.customer)}` : ""}
          </p>
        </div>
        <span class="nb114-badge">${escapeHtml(item.category || "문의")}</span>
      </div>
      ${tags ? `<div class="nb114-tags">${tags}</div>` : ""}
      <section class="nb114-section">
        <h4>문의</h4>
        <p>${escapeHtml(item.question || "")}</p>
      </section>
      <section class="nb114-section">
        <h4>응대</h4>
        <p>${escapeHtml(item.response || "")}</p>
      </section>
      <div class="nb114-actions">
        <button type="button" class="nb114-use-btn" data-use-inquiry="${escapeHtml(item.id)}">이 사례로 대응</button>
      </div>
    </article>`;
}

function dispatchUseInquiry(item) {
  const isIncident = /장애|오류|실패|연결|접속|다운|미수신/i.test(
    `${item.category} ${item.title} ${item.question}`
  );

  window.dispatchEvent(
    new CustomEvent("nb114:use-case", {
      detail: {
        mode: isIncident ? "incident" : "complaint",
        solution: item.solution || "",
        symptom: item.question || item.title || "",
        content: item.question || item.title || "",
        environment: item.customer || "",
        impact: "",
        request: item.response ? "과거 응대 내용 참고" : "",
      },
    })
  );

  if (window.AppShell?.switchPanel) {
    window.AppShell.switchPanel("support");
  }
}

async function handleNb114Search(query) {
  setNb114Status("문의 이력을 검색하는 중...", "loading");
  nb114Btn.disabled = true;

  try {
    const data = await postJson("/api/nb114-inquiries", {
      query,
      solution: nb114Solution.value.trim(),
      limit: 20,
    });

    nb114Welcome.classList.add("hidden");
    nb114Results.classList.remove("hidden");

    if (!data.results.length) {
      nb114List.innerHTML = `<p class="empty-result">관련 문의 이력을 찾지 못했습니다.</p>`;
    } else {
      nb114List.innerHTML = data.results.map(renderInquiryCard).join("");
      nb114List.querySelectorAll("[data-use-inquiry]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = data.results.find((row) => row.id === btn.dataset.useInquiry);
          if (item) dispatchUseInquiry(item);
        });
      });
    }

    setNb114Status("", "");
  } catch (err) {
    setNb114Status(err.message, "error");
  } finally {
    nb114Btn.disabled = false;
  }
}

nb114Form.addEventListener("submit", (e) => {
  e.preventDefault();
  handleNb114Search(nb114Input.value.trim());
});

document.querySelectorAll(".suggestion-chip[data-nb114]").forEach((chip) => {
  chip.addEventListener("click", () => {
    nb114Input.value = chip.dataset.nb114;
    handleNb114Search(chip.dataset.nb114);
  });
});
