function getRepoName() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] || null;
}

function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(2) + " MB";
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function createLayerHTML(layers) {
  return layers.map(l => `
    <div class="layer">
      ${l.digest} — ${formatSize(l.size)}
    </div>
  `).join("");
}

function createTagCard(tag) {
  const totalSize = tag.layers.reduce((acc, l) => acc + l.size, 0);

  return `
    <div class="card">
      <div class="tag">
        ${tag.name}
        <span class="badge">${tag.info.architecture}</span>
      </div>

      <div class="meta">
        Created: ${new Date(tag.info.created).toLocaleString()} <br>
        OS: ${tag.info.os} <br>
        Size: ${formatSize(totalSize)} <br>
        Digest: ${tag.digest}
      </div>

      <h3>Layers</h3>
      <div>
        ${createLayerHTML(tag.layers)}
      </div>
    </div>
  `;
}

async function loadRepo() {
  const repo = getRepoName();
  const repoEl = document.getElementById("repoName");
  const contentEl = document.getElementById("content");

  if (!repo) {
    repoEl.innerText = "No repository found";
    return;
  }

  repoEl.innerText = repo;

  try {
    const token = getCookie("access_token");

    const res = await fetch(`/api/repos/${repo}?full=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("API error");
    }

    const data = await res.json();

    contentEl.innerHTML = data.tags
      .map(createTagCard)
      .join("");

  } catch (err) {
    console.error(err);
    contentEl.innerHTML = `<p>Failed to load repository</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadRepo);