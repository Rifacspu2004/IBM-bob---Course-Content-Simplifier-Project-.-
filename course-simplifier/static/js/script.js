/* ─────────────────────────────────────────
   Course Content Simplifier – script.js
   IBM Granite · Flask Backend
───────────────────────────────────────── */

// ── State ─────────────────────────────────
let lastContent  = '';
let lastSubject  = '';
let lastLevel    = 'intermediate';
let lastResponse = null;

// ── DOM helpers ───────────────────────────
const $ = id => document.getElementById(id);
const textarea   = $('content');
const simplifyBtn = $('simplifyBtn');
const compareBtn  = $('compareBtn');

// Character counter
textarea.addEventListener('input', () => {
  $('charCount').textContent = textarea.value.length;
});

// ── Utilities ─────────────────────────────
function getLevel() {
  const checked = document.querySelector('input[name="level"]:checked');
  return checked ? checked.value : 'intermediate';
}

function getSubject() {
  return $('subject').value || 'General';
}

function showError(msg) {
  const banner = $('errorBanner');
  banner.textContent = msg;
  banner.classList.remove('hidden');
  $('loadingState').classList.add('hidden');
  $('outputCard').classList.add('hidden');
  $('compareCard').classList.add('hidden');
}

function clearError() {
  $('errorBanner').classList.add('hidden');
}

function setLoading(state) {
  simplifyBtn.disabled = state;
  compareBtn.disabled  = state;
  $('loadingState').classList.toggle('hidden', !state);
}

function copyOutput() {
  if (!lastResponse) return;
  const r = lastResponse;
  const terms = (r.important_terms || []).map(t => `• ${t.term}: ${t.definition}`).join('\n');
  const concepts = (r.key_concepts || []).map(c => `• ${c}`).join('\n');
  const text = [
    `LEVEL: ${lastLevel.toUpperCase()}  |  SUBJECT: ${lastSubject}`,
    '',
    '── EXPLANATION ──',
    r.simplified_explanation || '',
    '',
    '── KEY CONCEPTS ──',
    concepts,
    '',
    '── EXAMPLE ──',
    r.example || '',
    '',
    '── IMPORTANT TERMS ──',
    terms,
    '',
    '── SUMMARY ──',
    r.summary || '',
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    const btn = event.currentTarget;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }).catch(() => alert('Copy failed – please select and copy manually.'));
}

// ── Render helpers ────────────────────────
function levelTagClass(level) {
  return { beginner: 'tag-beginner', intermediate: 'tag-intermediate', expert: 'tag-expert' }[level] || 'tag-intermediate';
}

function renderOutput(data, level, subject) {
  lastResponse = data;
  lastLevel    = level;
  lastSubject  = subject;

  const r = data;

  // Tags
  const lt = $('levelTag');
  lt.textContent = level.charAt(0).toUpperCase() + level.slice(1);
  lt.className = `tag ${levelTagClass(level)}`;
  $('subjectTag').textContent = subject;

  // Explanation
  $('explanationText').textContent = r.simplified_explanation || '—';

  // Key Concepts
  const ul = $('conceptsList');
  ul.innerHTML = '';
  (r.key_concepts || []).forEach(c => {
    const li = document.createElement('li');
    li.textContent = c;
    ul.appendChild(li);
  });

  // Example
  $('exampleText').textContent = r.example || '—';

  // Terms
  const tg = $('termsList');
  tg.innerHTML = '';
  (r.important_terms || []).forEach(t => {
    const div = document.createElement('div');
    div.className = 'term-item';
    div.innerHTML = `<div class="term-name">${escHtml(t.term)}</div><div class="term-def">${escHtml(t.definition)}</div>`;
    tg.appendChild(div);
  });

  // Summary
  $('summaryText').textContent = r.summary || '—';

  $('outputCard').classList.remove('hidden');
  $('outputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Simplify ──────────────────────────────
async function simplifyContent() {
  const content = textarea.value.trim();
  const level   = getLevel();
  const subject = getSubject();

  clearError();
  $('outputCard').classList.add('hidden');
  $('compareCard').classList.add('hidden');

  if (!content) { showError('Please paste some academic content before simplifying.'); return; }
  if (content.length < 20) { showError('Content is too short. Please provide at least a few sentences.'); return; }

  lastContent = content;
  setLoading(true);

  try {
    const res = await fetch('/api/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, subject, level }),
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      showError(json.error || `Server error (${res.status}). Please try again.`);
      return;
    }
    renderOutput(json.result, level, subject);
  } catch (err) {
    showError('Network error – could not reach the server. Make sure the Flask backend is running.');
  } finally {
    setLoading(false);
  }
}

// ── Regenerate ────────────────────────────
function regenerate() {
  textarea.value = lastContent;
  $('charCount').textContent = lastContent.length;
  const radio = document.querySelector(`input[name="level"][value="${lastLevel}"]`);
  if (radio) radio.checked = true;
  simplifyContent();
}

// ── Try Another Level ─────────────────────
function tryAnotherLevel() {
  const levels = ['beginner', 'intermediate', 'expert'];
  const idx  = levels.indexOf(lastLevel);
  const next = levels[(idx + 1) % levels.length];
  const radio = document.querySelector(`input[name="level"][value="${next}"]`);
  if (radio) radio.checked = true;
  simplifyContent();
}

// ── Compare All Levels ────────────────────
async function compareAllLevels() {
  const content = textarea.value.trim();
  const subject = getSubject();

  clearError();
  $('outputCard').classList.add('hidden');
  $('compareCard').classList.add('hidden');

  if (!content) { showError('Please paste some academic content before comparing levels.'); return; }
  if (content.length < 20) { showError('Content is too short. Please provide at least a few sentences.'); return; }

  lastContent = content;
  setLoading(true);

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, subject }),
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      showError(json.error || `Server error (${res.status}). Please try again.`);
      return;
    }
    renderCompare(json.results, json.errors, subject);
  } catch (err) {
    showError('Network error – could not reach the server.');
  } finally {
    setLoading(false);
  }
}

function renderCompare(results, errors, subject) {
  const grid = $('compareGrid');
  grid.innerHTML = '';

  ['beginner', 'intermediate', 'expert'].forEach(level => {
    const col = document.createElement('div');
    col.className = 'compare-col';

    const header = document.createElement('div');
    header.className = `compare-col-header ${level}`;
    header.textContent = level.charAt(0).toUpperCase() + level.slice(1);
    col.appendChild(header);

    const body = document.createElement('div');
    body.className = 'compare-col-body';

    if (errors && errors[level]) {
      body.innerHTML = `<span style="color:#dc2626">Error: ${escHtml(errors[level])}</span>`;
    } else if (results && results[level]) {
      const r = results[level];
      body.innerHTML = `
        <p style="margin-bottom:10px">${escHtml(r.simplified_explanation || '')}</p>
        <p style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Summary</p>
        <p style="font-size:13px;color:#475569">${escHtml(r.summary || '')}</p>
      `;
    } else {
      body.textContent = 'No result.';
    }
    col.appendChild(body);
    grid.appendChild(col);
  });

  $('compareCard').classList.remove('hidden');
  $('compareCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Clear ─────────────────────────────────
function clearAll() {
  textarea.value = '';
  $('charCount').textContent = '0';
  $('subject').value = '';
  document.querySelector('input[name="level"][value="intermediate"]').checked = true;
  $('outputCard').classList.add('hidden');
  $('compareCard').classList.add('hidden');
  clearError();
  lastContent  = '';
  lastResponse = null;
  lastLevel    = 'intermediate';
  textarea.focus();
}

// ── Enter key shortcut ────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') simplifyContent();
});
