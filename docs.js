const askForm = document.getElementById("ask-form");
const askInput = document.getElementById("ask-input");
const askBtn = document.getElementById("ask-btn");
const askStatus = document.getElementById("ask-status");
const askWelcome = document.getElementById("ask-welcome");
const askChat = document.getElementById("ask-chat");

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const searchStatus = document.getElementById("search-status");
const searchWelcome = document.getElementById("search-welcome");
const searchResults = document.getElementById("search-results");
const searchResultsTitle = document.getElementById("search-results-title");
const searchList = document.getElementById("search-list");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightTerms(text, query) {
  const safe = escapeHtml(text);
  const terms = String(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map(escapeHtml);

  if (!terms.length) return safe;

  const pattern = new RegExp(`(${terms.join("|")})`, "gi");
  return safe.replace(pattern, "<mark>$1</mark>");
}

function setStatus(el, message, type = "") {
  el.textContent = message || "";
  el.className = "status";
  if (type) el.classList.add(type);
}

function formatMeta(item) {
  const parts = [item.fileName];
  if (item.page) parts.push(`p.${item.page}`);
  if (item.section) parts.push(item.section);
  return parts.join(" · ");
}

function appendChatMessage(role, content) {
  askWelcome.classList.add("hidden");
  askChat.classList.remove("hidden");

  const isUser = role === "user";
  const html = `
    <div class="chat-message ${isUser ? "chat-user" : "chat-assistant"}">
      <div class="chat-role">${isUser ? "질문" : "답변"}</div>
      <div class="chat-body">${isUser ? escapeHtml(content) : escapeHtml(content).replace(/\n/g, "<br>")}</div>
    </div>`;

  askChat.insertAdjacentHTML("beforeend", html);
  askChat.scrollTop = askChat.scrollHeight;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "요청 처리에 실패했습니다.");
  }
  return data;
}

async function handleAsk(question) {
  setStatus(askStatus, "문서를 검색하고 답변을 생성하는 중...", "loading");
  askBtn.disabled = true;

  try {
    const data = await postJson("/api/ask", { question });
    appendChatMessage("user", question);
    appendChatMessage("assistant", data.answer);

    if (window.HistoryStore) {
      HistoryStore.addRecord({
        type: "ask",
        input: { question },
        response: { answer: data.answer },
        searchMode: data.searchMode,
      });
      window.dispatchEvent(new CustomEvent("history:updated"));
    }

    setStatus(askStatus, "", "");
    askInput.value = "";
  } catch (err) {
    setStatus(askStatus, err.message, "error");
  } finally {
    askBtn.disabled = false;
    askInput.focus();
  }
}

async function handleSearch(query) {
  setStatus(searchStatus, "관련 구간을 검색하는 중...", "loading");
  searchBtn.disabled = true;

  try {
    const data = await postJson("/api/search-docs", { query });

    searchWelcome.classList.add("hidden");
    searchResults.classList.remove("hidden");
    searchResultsTitle.textContent = `"${query}" 검색 결과 (${data.results.length}건)`;

    if (!data.results.length) {
      searchList.innerHTML = `<p class="empty-result">관련 구간을 찾지 못했습니다.</p>`;
    } else {
      searchList.innerHTML = data.results
        .map(
          (item) => `
          <article class="result-card">
            <div class="result-header">
              <h3>${escapeHtml(item.title || item.fileName)}</h3>
              <span class="result-score">${Math.round((item.score || 0) * 100)}%</span>
            </div>
            <p class="result-meta">${escapeHtml(formatMeta(item))}</p>
            <p class="result-excerpt">${highlightTerms(item.excerpt || item.content || "", query)}</p>
          </article>`
        )
        .join("");
    }

    setStatus(searchStatus, "", "");
  } catch (err) {
    setStatus(searchStatus, err.message, "error");
  } finally {
    searchBtn.disabled = false;
  }
}

askForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = askInput.value.trim();
  if (!question) {
    setStatus(askStatus, "질문을 입력해 주세요.", "error");
    return;
  }
  handleAsk(question);
});

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    setStatus(searchStatus, "검색어를 입력해 주세요.", "error");
    return;
  }
  handleSearch(query);
});

document.querySelectorAll(".suggestion-chip[data-ask]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const question = chip.dataset.ask;
    askInput.value = question;
    handleAsk(question);
  });
});
