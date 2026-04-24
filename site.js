const SAVED_ENTRIES_STORAGE_KEY = 'digitalMindsSavedEntries.v1';
const CURRICULUM_TRACKER_STORAGE_KEY = 'digitalMindsCurriculumTracker.v1';
const CONTENT_ENTRY_DIRECTORIES = ['philosophers', 'eras'];
const LEGACY_ROOT_ENTRY_HREFS = new Set(['index.html', 'index-curricula.html', 'about.html', 'glossary.html']);

document.addEventListener('DOMContentLoaded', () => {
  setupNavMenus();
  setupGlossaryTerms();
  setupEssayEnhancements();
  setupSavedEntries();
});

function setupNavMenus() {
  const groups = Array.from(document.querySelectorAll('.nav-group'));
  if (!groups.length) return;

  const closeAll = (except = null) => {
    groups.forEach((group) => {
      if (except && group === except) return;
      group.classList.remove('is-open');
      const button = group.querySelector('.nav-label');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  };

  groups.forEach((group) => {
    const button = group.querySelector('.nav-label');
    if (!button) return;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = group.classList.contains('is-open');
      closeAll(group);
      group.classList.toggle('is-open', !isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    });

    group.querySelectorAll('.nav-sublink').forEach((link) => {
      link.addEventListener('click', () => closeAll());
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-nav')) closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

function setupGlossaryTerms() {
  const terms = Array.from(document.querySelectorAll('.gloss-term[data-glossary-enhanced="true"]'));
  if (!terms.length) return;

  const closeAll = (except = null) => {
    terms.forEach((term) => {
      if (except && term === except) return;
      term.classList.remove('is-open');
      term.setAttribute('aria-expanded', 'false');
    });
  };

  terms.forEach((term) => {
    term.setAttribute('aria-expanded', 'false');

    term.addEventListener('click', (event) => {
      const isCoarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
      if (!isCoarse) return;
      if (term.classList.contains('is-open')) return;
      event.preventDefault();
      closeAll(term);
      term.classList.add('is-open');
      term.setAttribute('aria-expanded', 'true');
    });

    term.addEventListener('focus', () => {
      closeAll(term);
      term.classList.add('is-open');
      term.setAttribute('aria-expanded', 'true');
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.gloss-term')) closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}

function setupEssayEnhancements() {
  const essay = document.querySelector('.essay');
  const main = document.querySelector('main');
  if (!essay || !main) return;

  const totalWords = countWords(essay.textContent);
  if (!totalWords) return;

  const sections = buildEssaySections(essay);
  const shell = createEssayEnhancements(sections, totalWords);
  main.append(shell.root);
  document.body.prepend(shell.hairline);

  if (sections.length < 2) {
    shell.root.classList.add('essay-enhancements--meter-only');
    shell.tocMeta.textContent = 'Reading guide';
    shell.tocList.hidden = true;
  } else {
    sections.forEach((section) => {
      shell.tocList.append(createEssayTocItem(section));
    });
  }

  const setExpanded = (nextExpanded) => {
    shell.root.classList.toggle('is-expanded', nextExpanded);
    shell.label.setAttribute('aria-expanded', String(nextExpanded));
    shell.label.setAttribute('aria-label', nextExpanded ? 'Collapse table of contents' : 'Expand table of contents');
  };

  let frame = 0;
  const updateUi = () => {
    const progress = measureEssayProgress(essay);
    const percent = Math.round(progress * 100);
    const minutesLeft = Math.ceil(((1 - progress) * totalWords) / 215);
    const isInlineToc = window.matchMedia('(max-width: 980px)').matches;
    const tocVisibility = isInlineToc ? 1 : Math.max(0, Math.min(1, (window.scrollY - 12) / 120));
    shell.root.style.setProperty('--essay-toc-visibility', tocVisibility.toFixed(3));
    shell.root.classList.toggle('is-visible', tocVisibility > 0.16);
    shell.percent.textContent = `${percent}%`;
    shell.time.textContent = progress >= 0.995 ? 'Done reading' : `${Math.max(1, minutesLeft)} min left`;
    shell.tocMeta.textContent = progress >= 0.995 ? 'Done reading' : `${percent}% · ${Math.max(1, minutesLeft)} min left`;
    shell.hairline.setAttribute('aria-valuenow', String(percent));
    shell.hairlineFill.style.width = `${percent}%`;

    const activeSection = findActiveEssaySection(sections);
    syncActiveEssayToc(shell.tocList, activeSection?.id || '');
  };

  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      updateUi();
    });
  };

  shell.label.addEventListener('click', () => {
    setExpanded(!shell.root.classList.contains('is-expanded'));
  });

  shell.root.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setExpanded(false);
  });

  shell.tocList.addEventListener('click', (event) => {
    const link = event.target.closest('[data-essay-section-id]');
    if (!link) return;
    event.preventDefault();
    const sectionId = link.getAttribute('data-essay-section-id');
    const target = sectionId ? document.getElementById(sectionId) : null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) setExpanded(false);
  });

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  scheduleUpdate();
}

function buildEssaySections(essay) {
  const seen = new Set();
  const numberedParagraphs = Array.from(document.querySelectorAll('.essay p > strong'));
  const candidates = [
    ...Array.from(essay.querySelectorAll('h2, h3, h4')).map((node) => ({ node, label: cleanText(node.textContent) })),
    ...numberedParagraphs
      .map((node) => {
        const paragraph = node.closest('p');
        const strongText = cleanText(node.textContent);
        const paragraphText = cleanText(paragraph?.textContent);
        if (!paragraph || !isEssaySectionLabel(strongText) || paragraphText !== strongText) return null;
        return { node: paragraph, label: strongText };
      })
      .filter(Boolean),
  ];

  return candidates.reduce((sections, candidate, index) => {
    const node = candidate?.node;
    const label = cleanText(candidate?.label);
    if (!node || !label) return sections;
    const key = `${node.tagName}:${label}`;
    if (seen.has(key)) return sections;
    seen.add(key);
    if (!node.id) node.id = `essay-section-${slugify(label) || index + 1}`;
    sections.push({ node, label, id: node.id });
    return sections;
  }, []);
}

function isEssaySectionLabel(value) {
  return /^(?:\d+\.|[IVXLCDM]+\.)\s+/i.test(cleanText(value));
}

function createEssayEnhancements(sections, totalWords) {
  const root = document.createElement('aside');
  root.className = 'essay-enhancements';

  const hairline = document.createElement('div');
  hairline.className = 'essay-progress-hairline';
  hairline.setAttribute('role', 'progressbar');
  hairline.setAttribute('aria-label', 'Reading progress');
  hairline.setAttribute('aria-valuemin', '0');
  hairline.setAttribute('aria-valuemax', '100');
  hairline.setAttribute('aria-valuenow', '0');

  const hairlineFill = document.createElement('span');
  hairlineFill.className = 'essay-progress-hairline-fill';
  hairline.append(hairlineFill);

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'essay-toc-label';
  label.setAttribute('aria-expanded', 'false');
  label.setAttribute('aria-label', 'Expand table of contents');
  label.textContent = 'Table of contents';

  const tocShell = document.createElement('section');
  tocShell.className = 'essay-toc-shell';

  const tocMeta = document.createElement('p');
  tocMeta.className = 'essay-toc-meta';
  tocMeta.textContent = `${Math.max(1, Math.ceil(totalWords / 215))} min left`;

  const readingMeta = document.createElement('div');
  readingMeta.className = 'essay-reading-meta';

  const percent = document.createElement('strong');
  percent.className = 'essay-reading-percent';
  percent.textContent = '0%';

  const time = document.createElement('span');
  time.className = 'essay-reading-time';
  time.textContent = `${Math.max(1, Math.ceil(totalWords / 215))} min left`;

  readingMeta.append(percent, time);

  const tocList = document.createElement('ol');
  tocList.className = 'essay-toc-list';

  tocShell.append(tocMeta, readingMeta, tocList);
  root.append(label, tocShell);

  return { root, label, tocShell, tocMeta, tocList, percent, time, hairline, hairlineFill };
}

function createEssayTocItem(section) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = `#${section.id}`;
  link.className = 'essay-toc-link';
  link.setAttribute('data-essay-section-id', section.id);
  link.textContent = section.label;
  item.append(link);
  return item;
}

function syncActiveEssayToc(list, activeId) {
  Array.from(list.querySelectorAll('.essay-toc-link')).forEach((link) => {
    const isActive = link.getAttribute('data-essay-section-id') === activeId;
    link.classList.toggle('is-active', isActive);
    link.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
}

function findActiveEssaySection(sections) {
  if (!sections.length) return null;
  const threshold = window.innerHeight * 0.28;
  let active = sections[0];
  sections.forEach((section) => {
    const top = section.node.getBoundingClientRect().top;
    if (top <= threshold) active = section;
  });
  return active;
}

function measureEssayProgress(essay) {
  const rect = essay.getBoundingClientRect();
  const total = rect.height + window.innerHeight;
  if (!total) return 0;
  const seen = window.innerHeight - rect.top;
  return Math.max(0, Math.min(1, seen / total));
}

function countWords(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

function setupSavedEntries() {
  const candidates = collectSavableEntries();
  const curriculumData = collectCurriculumTracks();
  let savedEntries = loadSavedEntries();
  let savedCurricula = loadSavedCurricula();
  const onHomePage = isHomePage();
  const currentEssayHref = getCurrentEssayHref();

  if (!candidates.length && !savedEntries.length && !savedCurricula.length && !onHomePage) return;

  const shell = createSavedEntriesShell();
  const essayReadControl = createEssayReadControl();
  document.body.append(shell.toggle, shell.backdrop, shell.panel);

  const setPanelOpen = (nextOpen) => {
    shell.panel.classList.toggle('is-open', nextOpen);
    shell.backdrop.classList.toggle('is-open', nextOpen);
    shell.toggle.setAttribute('aria-expanded', String(nextOpen));
  };

  const syncUi = () => {
    renderSavedLibrary(savedEntries, savedCurricula, shell);
    syncCandidateButtons(candidates, savedEntries);
    syncCurriculumButtons(curriculumData, savedCurricula, shell);
    markEssayEntryReadState(essayReadControl, savedEntries, savedCurricula, currentEssayHref);
  };

  const setSavedEntries = (nextEntries) => {
    savedEntries = dedupeEntries(nextEntries);
    writeSavedEntries(savedEntries);
    syncUi();
  };

  const setSavedCurricula = (nextCurricula) => {
    savedCurricula = dedupeCurricula(nextCurricula);
    writeSavedCurricula(savedCurricula);
    syncUi();
  };

  candidates.forEach((candidate) => {
    candidate.button.addEventListener('click', () => {
      const exists = savedEntries.some((entry) => entry.href === candidate.entry.href);
      if (exists) {
        setSavedEntries(savedEntries.filter((entry) => entry.href !== candidate.entry.href));
        return;
      }
      setSavedEntries([{ ...candidate.entry, completed: false }, ...savedEntries]);
    });
  });

  curriculumData.forEach((curriculum) => {
    curriculum.button.addEventListener('click', () => {
      const exists = savedCurricula.some((entry) => entry.id === curriculum.track.id);
      if (exists) {
        setPanelOpen(true);
        return;
      }
      setSavedCurricula([curriculum.track, ...savedCurricula]);
      setPanelOpen(true);
    });
  });

  shell.toggle.addEventListener('click', () => {
    const isOpen = shell.panel.classList.contains('is-open');
    setPanelOpen(!isOpen);
  });

  shell.closeButton.addEventListener('click', () => {
    setPanelOpen(false);
  });

  shell.backdrop.addEventListener('click', () => {
    setPanelOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setPanelOpen(false);
  });

  shell.clearButton.addEventListener('click', () => {
    setSavedEntries([]);
    setSavedCurricula([]);
  });

  shell.curriculaList.addEventListener('click', (event) => {
    const curriculumButton = event.target.closest('[data-remove-curriculum]');
    if (curriculumButton) {
      const curriculumId = curriculumButton.getAttribute('data-remove-curriculum');
      setSavedCurricula(savedCurricula.filter((curriculum) => curriculum.id !== curriculumId));
      return;
    }

    const entryButton = event.target.closest('[data-curriculum-entry-key]');
    if (!entryButton) return;
    const curriculumId = entryButton.getAttribute('data-curriculum-id');
    const entryKey = entryButton.getAttribute('data-curriculum-entry-key');
    setSavedCurricula(toggleCurriculumEntry(savedCurricula, curriculumId, entryKey));
  });

  shell.list.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-href]');
    if (removeButton) {
      const href = removeButton.getAttribute('data-remove-href');
      setSavedEntries(savedEntries.filter((entry) => entry.href !== href));
      return;
    }

    const readButton = event.target.closest('[data-entry-href]');
    if (!readButton) return;
    const href = readButton.getAttribute('data-entry-href');
    setSavedEntries(toggleSavedEntry(savedEntries, href));
  });

  if (essayReadControl?.button) {
    essayReadControl.button.addEventListener('click', () => {
      const nextState = !isEssayFullyRead(savedEntries, savedCurricula, currentEssayHref);
      setSavedEntries(setSavedEntryCompletionByHref(savedEntries, currentEssayHref, nextState));
      setSavedCurricula(setCurriculumEntryCompletionByHref(savedCurricula, currentEssayHref, nextState));
    });
  }

  syncUi();
}

function collectSavableEntries() {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (entry, targetHeading, variant) => {
    if (!entry || !entry.href || seen.has(entry.href) || !targetHeading) return;
    seen.add(entry.href);
    const button = createSaveButton(variant);
    const slot = document.createElement('div');
    slot.className = `save-entry-slot save-entry-slot--${variant}`;
    slot.append(button);
    targetHeading.insertAdjacentElement('afterend', slot);
    candidates.push({ entry, button });
  };

  const essayHeading = document.querySelector('.essay-header h1');
  if (essayHeading) {
    const essayKicker = document.querySelector('.essay-header .kicker');
    const entry = {
      href: normalizeEntryHref(window.location.href),
      title: cleanText(essayHeading.textContent),
      context: cleanText(essayKicker?.textContent) || 'Essay',
      completed: false,
    };
    addCandidate(entry, essayKicker || essayHeading, 'inline');
  }

  const sectionTitle = cleanText(document.querySelector('.era-page-header h1')?.textContent);
  const cards = Array.from(document.querySelectorAll('.philosopher-card h3 a'));
  cards.forEach((link) => {
    const href = normalizeEntryHref(link.getAttribute('href'));
    const title = cleanText(link.textContent);
    const heading = link.closest('h3');
    addCandidate(
      {
        href,
        title,
        context: sectionTitle || cleanText(document.querySelector('h1')?.textContent) || 'Entry',
        completed: false,
      },
      heading,
      'card'
    );
  });

  return candidates;
}

function collectCurriculumTracks() {
  const panels = Array.from(document.querySelectorAll('[data-curriculum-panel]'));
  if (!panels.length) return [];

  const linkIndex = buildCurriculumLinkIndex();

  return panels.map((panel) => {
    const title = cleanText(panel.querySelector('.curricula-summary h3')?.textContent);
    const description = cleanText(panel.querySelector('.curricula-summary p')?.textContent);
    const blocks = Array.from(panel.querySelectorAll('.curriculum-block')).map((block, blockIndex) => {
      const blockTitle = cleanText(block.querySelector('h4')?.textContent) || `Block ${blockIndex + 1}`;
      const blockLabel = cleanText(block.querySelector('.curriculum-block-index')?.textContent) || `Block ${String(blockIndex + 1).padStart(2, '0')}`;
      const entries = extractCurriculumEntries(block, linkIndex).map((entryTitle, entryIndex) => ({
        id: slugify(`${blockLabel}-${entryTitle}-${entryIndex}`),
        title: entryTitle,
        href: resolveCurriculumEntryHref(entryTitle, linkIndex),
        completed: false,
      }));

      return {
        id: slugify(`${blockLabel}-${blockTitle}`),
        index: blockLabel,
        title: blockTitle,
        entries,
      };
    }).filter((block) => block.entries.length);

    const track = {
      id: cleanText(panel.getAttribute('data-curriculum-panel')),
      title,
      description,
      blocks,
      startedAt: '',
    };

    const button = createCurriculumButton(track.id);
    panel.querySelector('.curricula-summary')?.append(button);

    return { track, button };
  }).filter(({ track }) => track.id && track.title && track.blocks.length);
}

function buildCurriculumLinkIndex() {
  const index = new Map();
  const addValue = (label, href) => {
    const normalizedLabel = normalizeLookupLabel(label);
    const normalizedHref = normalizeEntryHref(href);
    if (!normalizedLabel || !normalizedHref || index.has(normalizedLabel)) return;
    index.set(normalizedLabel, normalizedHref);
  };

  const addAliases = (label, href) => {
    addValue(label, href);
    const tokens = normalizeLookupLabel(label).split(/\s+/).filter(Boolean);
    if (tokens.length > 1) addValue(tokens[tokens.length - 1], href);
  };

  Array.from(document.querySelectorAll('a[href]')).forEach((link) => {
    addAliases(link.textContent, link.getAttribute('href'));
    const title = cleanText(link.querySelector('title')?.textContent);
    if (title) addAliases(title.replace(/\s+—\s+.*$/, ''), link.getAttribute('href'));
  });

  return index;
}

function extractCurriculumEntries(block, linkIndex) {
  const list = block.querySelector('[data-curriculum-entry-list]') || block.querySelector('ul');
  const line = cleanText(list?.textContent).replace(/^Thinkers:\s*/i, '');
  if (!line) return [];

  return line
    .split(',')
    .flatMap((part) => splitCurriculumEntryPart(part, linkIndex))
    .map(cleanText)
    .filter(Boolean);
}

function splitCurriculumEntryPart(part, linkIndex) {
  const cleaned = cleanText(part);
  if (!cleaned) return [];
  if (resolveCurriculumEntryHref(cleaned, linkIndex)) return [cleaned];

  const slashSplit = cleaned.split('/').map(cleanText).filter(Boolean);
  if (slashSplit.length > 1) {
    return slashSplit.flatMap((piece) => splitCurriculumEntryPart(piece, linkIndex));
  }

  const ampersandSplit = cleaned.split(/\s+&\s+/).map(cleanText).filter(Boolean);
  if (ampersandSplit.length > 1) return ampersandSplit;

  return [cleaned];
}

function resolveCurriculumEntryHref(entryTitle, linkIndex) {
  return linkIndex.get(normalizeLookupLabel(entryTitle)) || '';
}

function createSaveButton(variant) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `save-entry-btn save-entry-btn--${variant}`;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Bookmark this entry');
  button.innerHTML = '<span aria-hidden="true">⟡</span><span class="save-entry-btn-label">Bookmark</span>';
  return button;
}

function createCurriculumButton(curriculumId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'curriculum-start-btn';
  button.setAttribute('data-curriculum-start', curriculumId);
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span class="curriculum-start-btn-label">Get started</span>';
  return button;
}

function createEssayReadControl() {
  const essay = document.querySelector('.essay');
  const footer = document.querySelector('.essay-footer');
  if (!essay || !footer) return null;

  const slot = document.createElement('div');
  slot.className = 'saved-entry-read-slot';
  slot.hidden = true;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'saved-entry-read-btn';
  slot.append(button);
  essay.insertAdjacentElement('afterend', slot);

  return { slot, button };
}

function syncCandidateButtons(candidates, savedEntries) {
  const savedSet = new Set(savedEntries.map((entry) => entry.href));
  candidates.forEach(({ entry, button }) => {
    const isSaved = savedSet.has(entry.href);
    button.classList.toggle('is-saved', isSaved);
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', isSaved ? 'Remove bookmark' : 'Bookmark this entry');
    button.querySelector('.save-entry-btn-label').textContent = isSaved ? 'Bookmarked' : 'Bookmark';
    button.querySelector('span[aria-hidden="true"]').textContent = isSaved ? '◆' : '⟡';
  });
}

function syncCurriculumButtons(curriculumData, savedCurricula, shell) {
  const savedSet = new Set(savedCurricula.map((curriculum) => curriculum.id));
  curriculumData.forEach(({ track, button }) => {
    const isSaved = savedSet.has(track.id);
    button.classList.toggle('is-active', isSaved);
    button.setAttribute('aria-pressed', String(isSaved));
    button.querySelector('.curriculum-start-btn-label').textContent = isSaved ? 'Tracking curriculum' : 'Get started';
  });

  const activeCurricula = savedCurricula.length;
  shell.toggle.setAttribute('aria-label', activeCurricula ? `Open bookmarks and ${activeCurricula} curriculum tracks` : 'Open bookmarks');
}

function createSavedEntriesShell() {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'saved-entries-toggle';
  toggle.innerHTML = '<svg class="saved-entries-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4.75a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14.3a.45.45 0 0 1-.73.36L12 16.14l-4.27 3.27a.45.45 0 0 1-.73-.36z"/></svg><span class="saved-entries-count">0</span>';
  toggle.setAttribute('aria-label', 'Open bookmarks');
  toggle.setAttribute('aria-expanded', 'false');

  const backdrop = document.createElement('div');
  backdrop.className = 'saved-entries-backdrop';

  const panel = document.createElement('aside');
  panel.className = 'saved-entries-panel';

  const header = document.createElement('div');
  header.className = 'saved-entries-header';
  const title = document.createElement('h2');
  title.textContent = 'Bookmarks';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'saved-entries-close';
  closeButton.setAttribute('aria-label', 'Close bookmarks panel');
  closeButton.innerHTML = '<svg class="saved-entries-close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.75 7.75l8.5 8.5m0-8.5l-8.5 8.5"/></svg>';
  header.append(title, closeButton);

  const body = document.createElement('div');
  body.className = 'saved-entries-body';

  const curriculaList = document.createElement('div');
  curriculaList.className = 'saved-curricula-list';

  const entriesSection = document.createElement('section');
  entriesSection.className = 'saved-entries-section';
  const entriesHeading = document.createElement('h3');
  entriesHeading.className = 'saved-entries-section-title';
  entriesHeading.textContent = 'Bookmarked essays';
  const list = document.createElement('ul');
  list.className = 'saved-entries-list';
  entriesSection.append(entriesHeading, list);

  const empty = document.createElement('p');
  empty.className = 'saved-entries-empty';
  empty.textContent = 'Bookmark an entry to keep it handy.';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'saved-entries-clear';
  clearButton.textContent = 'Clear all';

  body.append(curriculaList, entriesSection, empty);
  panel.append(header, body, clearButton);

  return {
    toggle,
    backdrop,
    panel,
    curriculaList,
    entriesSection,
    entriesHeading,
    list,
    empty,
    clearButton,
    closeButton,
    count: toggle.querySelector('.saved-entries-count'),
  };
}

function renderSavedLibrary(savedEntries, savedCurricula, shell) {
  const totalCount = savedEntries.length + savedCurricula.reduce((sum, curriculum) => sum + countCurriculumEntries(curriculum), 0);
  const unreadEntries = savedEntries.filter((entry) => !entry.completed).length;
  shell.count.textContent = String(totalCount);
  shell.curriculaList.innerHTML = '';
  shell.list.innerHTML = '';
  shell.entriesHeading.textContent = unreadEntries ? `Bookmarked essays · ${unreadEntries} unread` : 'Bookmarked essays';

  const hasCurricula = savedCurricula.length > 0;
  const hasEntries = savedEntries.length > 0;

  shell.entriesSection.hidden = !hasEntries;

  if (!hasCurricula && !hasEntries) {
    shell.empty.hidden = false;
    shell.clearButton.hidden = true;
    return;
  }

  shell.empty.hidden = true;
  shell.clearButton.hidden = false;

  savedCurricula.forEach((curriculum) => {
    shell.curriculaList.append(createCurriculumPanel(curriculum));
  });

  savedEntries.forEach((entry) => {
    shell.list.append(createSavedEntryItem(entry));
  });
}

function createSavedEntryItem(entry) {
  const item = document.createElement('li');
  item.className = 'saved-curriculum-entry saved-entries-item';
  item.classList.toggle('is-complete', Boolean(entry.completed));

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'saved-curriculum-entry-toggle';
  toggle.setAttribute('data-entry-href', entry.href);
  toggle.setAttribute('aria-pressed', String(Boolean(entry.completed)));
  toggle.setAttribute('aria-label', entry.completed ? `Mark ${entry.title} as unread` : `Mark ${entry.title} as read`);
  toggle.textContent = entry.completed ? '✓' : '○';

  const content = document.createElement('div');
  content.className = 'saved-entry-details';

  const link = document.createElement('a');
  link.className = 'saved-curriculum-entry-link';
  link.href = formatEntryLinkHref(entry.href);
  link.textContent = entry.title;

  const meta = document.createElement('div');
  meta.className = 'saved-entries-meta';
  meta.textContent = entry.context || '';

  content.append(link, meta);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'saved-entries-remove';
  removeButton.setAttribute('data-remove-href', entry.href);
  removeButton.setAttribute('aria-label', `Remove ${entry.title} from bookmarks`);
  removeButton.textContent = 'Remove';

  item.append(toggle, content, removeButton);
  return item;
}

function createCurriculumPanel(curriculum) {
  const section = document.createElement('section');
  section.className = 'saved-curriculum';

  const header = document.createElement('div');
  header.className = 'saved-curriculum-header';

  const headingWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'saved-curriculum-title';
  title.textContent = curriculum.title;
  const description = document.createElement('p');
  description.className = 'saved-curriculum-description';
  description.textContent = curriculum.description || '';
  headingWrap.append(title, description);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'saved-curriculum-remove';
  removeButton.setAttribute('data-remove-curriculum', curriculum.id);
  removeButton.textContent = 'Remove track';

  header.append(headingWrap, removeButton);

  const totalEntries = countCurriculumEntries(curriculum);
  const completedEntries = countCompletedCurriculumEntries(curriculum);
  const progress = document.createElement('div');
  progress.className = 'saved-curriculum-progress';

  const progressMeta = document.createElement('div');
  progressMeta.className = 'saved-curriculum-progress-meta';
  progressMeta.innerHTML = `<span>Curriculum progress</span><strong>${completedEntries} / ${totalEntries} complete</strong>`;

  const progressBar = document.createElement('div');
  progressBar.className = 'saved-curriculum-progress-bar';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-label', `Curriculum progress for ${curriculum.title}`);
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', String(totalEntries));
  progressBar.setAttribute('aria-valuenow', String(completedEntries));

  const progressFill = document.createElement('span');
  progressFill.style.width = totalEntries ? `${(completedEntries / totalEntries) * 100}%` : '0%';
  progressBar.append(progressFill);
  progress.append(progressMeta, progressBar);

  const blocks = document.createElement('div');
  blocks.className = 'saved-curriculum-blocks';

  curriculum.blocks.forEach((block) => {
    const blockSection = document.createElement('section');
    blockSection.className = 'saved-curriculum-block';

    const blockTitle = document.createElement('h4');
    blockTitle.className = 'saved-curriculum-block-title';
    blockTitle.textContent = `${block.index} · ${block.title}`;

    const entryList = document.createElement('ul');
    entryList.className = 'saved-curriculum-entry-list';

    block.entries.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'saved-curriculum-entry';
      item.classList.toggle('is-complete', Boolean(entry.completed));

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'saved-curriculum-entry-toggle';
      toggle.setAttribute('data-curriculum-id', curriculum.id);
      toggle.setAttribute('data-curriculum-entry-key', entry.id);
      toggle.setAttribute('aria-pressed', String(Boolean(entry.completed)));
      toggle.setAttribute('aria-label', entry.completed ? `Mark ${entry.title} as incomplete` : `Mark ${entry.title} as complete`);
      toggle.textContent = entry.completed ? '✓' : '○';

      const label = entry.href ? document.createElement('a') : document.createElement('span');
      label.className = 'saved-curriculum-entry-link';
      label.textContent = entry.title;
      if (entry.href) label.href = formatEntryLinkHref(entry.href);

      item.append(toggle, label);
      entryList.append(item);
    });

    blockSection.append(blockTitle, entryList);
    blocks.append(blockSection);
  });

  section.append(header, progress, blocks);
  return section;
}

function markEssayEntryReadState(control, savedEntries, savedCurricula, href) {
  if (!control?.slot || !control.button || !href) return;

  const bookmarked = isEssayBookmarked(savedEntries, savedCurricula, href);
  control.slot.hidden = !bookmarked;
  if (!bookmarked) return;

  const isRead = isEssayFullyRead(savedEntries, savedCurricula, href);
  control.button.textContent = isRead ? 'Mark as unread' : 'Mark as read';
  control.button.setAttribute('aria-pressed', String(isRead));
  control.button.setAttribute('aria-label', isRead ? 'Mark as unread' : 'Mark as read');
}

function loadSavedEntries() {
  try {
    const raw = window.localStorage.getItem(SAVED_ENTRIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeEntries(parsed);
  } catch (error) {
    return [];
  }
}

function writeSavedEntries(entries) {
  try {
    window.localStorage.setItem(SAVED_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    // Ignore write errors (private mode/storage restrictions).
  }
}

function loadSavedCurricula() {
  try {
    const raw = window.localStorage.getItem(CURRICULUM_TRACKER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeCurricula(parsed);
  } catch (error) {
    return [];
  }
}

function writeSavedCurricula(curricula) {
  try {
    window.localStorage.setItem(CURRICULUM_TRACKER_STORAGE_KEY, JSON.stringify(curricula));
  } catch (error) {
    // Ignore write errors (private mode/storage restrictions).
  }
}

function dedupeEntries(entries) {
  const seen = new Set();
  const clean = [];
  entries.forEach((entry) => {
    const href = normalizeEntryHref(entry?.href);
    const title = cleanText(entry?.title);
    if (!href || !title || seen.has(href)) return;
    seen.add(href);
    clean.push({
      href,
      title,
      context: cleanText(entry?.context) || '',
      completed: Boolean(entry?.completed),
    });
  });
  return clean;
}

function dedupeCurricula(curricula) {
  const seen = new Set();
  const clean = [];
  curricula.forEach((curriculum) => {
    const id = cleanText(curriculum?.id);
    const title = cleanText(curriculum?.title);
    if (!id || !title || seen.has(id)) return;
    seen.add(id);
    clean.push({
      id,
      title,
      description: cleanText(curriculum?.description) || '',
      startedAt: cleanText(curriculum?.startedAt) || '',
      blocks: dedupeCurriculumBlocks(curriculum?.blocks || []),
    });
  });
  return clean;
}

function dedupeCurriculumBlocks(blocks) {
  return blocks.map((block, blockIndex) => ({
    id: cleanText(block?.id) || `block-${blockIndex + 1}`,
    index: cleanText(block?.index) || `Block ${String(blockIndex + 1).padStart(2, '0')}`,
    title: cleanText(block?.title) || `Block ${blockIndex + 1}`,
    entries: dedupeCurriculumEntries(block?.entries || []),
  })).filter((block) => block.entries.length);
}

function dedupeCurriculumEntries(entries) {
  const seen = new Set();
  const clean = [];
  entries.forEach((entry, entryIndex) => {
    const id = cleanText(entry?.id) || `entry-${entryIndex + 1}`;
    const title = cleanText(entry?.title);
    const key = `${id}::${title}`;
    if (!title || seen.has(key)) return;
    seen.add(key);
    clean.push({
      id,
      title,
      href: normalizeEntryHref(entry?.href),
      completed: Boolean(entry?.completed),
    });
  });
  return clean;
}

function toggleSavedEntry(savedEntries, href) {
  return savedEntries.map((entry) => {
    if (entry.href !== href) return entry;
    return { ...entry, completed: !entry.completed };
  });
}

function toggleCurriculumEntry(curricula, curriculumId, entryId) {
  return curricula.map((curriculum) => {
    if (curriculum.id !== curriculumId) return curriculum;
    return {
      ...curriculum,
      blocks: curriculum.blocks.map((block) => ({
        ...block,
        entries: block.entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          return { ...entry, completed: !entry.completed };
        }),
      })),
    };
  });
}

function setSavedEntryCompletionByHref(savedEntries, href, completed) {
  return savedEntries.map((entry) => {
    if (entry.href !== href) return entry;
    return { ...entry, completed };
  });
}

function setCurriculumEntryCompletionByHref(curricula, href, completed) {
  return curricula.map((curriculum) => ({
    ...curriculum,
    blocks: curriculum.blocks.map((block) => ({
      ...block,
      entries: block.entries.map((entry) => {
        if (entry.href !== href) return entry;
        return { ...entry, completed };
      }),
    })),
  }));
}

function isEssayBookmarked(savedEntries, savedCurricula, href) {
  if (!href) return false;
  return savedEntries.some((entry) => entry.href === href)
    || savedCurricula.some((curriculum) => curriculum.blocks.some((block) => block.entries.some((entry) => entry.href === href)));
}

function isEssayFullyRead(savedEntries, savedCurricula, href) {
  if (!href) return false;
  const matches = [
    ...savedEntries.filter((entry) => entry.href === href).map((entry) => entry.completed),
    ...savedCurricula.flatMap((curriculum) => curriculum.blocks.flatMap((block) => block.entries.filter((entry) => entry.href === href).map((entry) => entry.completed))),
  ];
  return matches.length > 0 && matches.every(Boolean);
}

function getCurrentEssayHref() {
  if (!document.querySelector('.essay-header h1')) return '';
  return normalizeEntryHref(window.location.href);
}

function formatEntryLinkHref(href) {
  const normalizedHref = normalizeEntryHref(href);
  if (!normalizedHref) return '';
  const path = window.location.pathname || '';
  const inContentDirectory = CONTENT_ENTRY_DIRECTORIES.some((directory) => path.includes(`/${directory}/`));
  return inContentDirectory ? `../${normalizedHref}` : normalizedHref;
}

function countCurriculumEntries(curriculum) {
  return curriculum.blocks.reduce((sum, block) => sum + block.entries.length, 0);
}

function countCompletedCurriculumEntries(curriculum) {
  return curriculum.blocks.reduce((sum, block) => sum + block.entries.filter((entry) => entry.completed).length, 0);
}

function normalizeEntryHref(value) {
  const rawValue = cleanText(value);
  if (!rawValue) return '';
  const isBareHtmlHref = !rawValue.includes('/') && rawValue.endsWith('.html');
  const isAlreadySiteRelative = CONTENT_ENTRY_DIRECTORIES.some((directory) => rawValue.startsWith(`${directory}/`));
  if (isAlreadySiteRelative) return rawValue;
  if (isBareHtmlHref && !LEGACY_ROOT_ENTRY_HREFS.has(rawValue)) {
    return `philosophers/${rawValue}`;
  }

  try {
    const url = new URL(rawValue, window.location.href);
    const pathname = url.pathname.split('/').filter(Boolean).join('/');
    if (!pathname) return '';

    for (const directory of CONTENT_ENTRY_DIRECTORIES) {
      const marker = `${directory}/`;
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex !== -1) return pathname.slice(markerIndex);
    }

    if (!pathname.includes('/') && pathname.endsWith('.html') && !LEGACY_ROOT_ENTRY_HREFS.has(pathname)) {
      return `philosophers/${pathname}`;
    }

    return pathname.split('/').pop() || '';
  } catch (error) {
    return '';
  }
}

function isHomePage() {
  const path = window.location.pathname || '';
  return document.body.classList.contains('page-home')
    || document.body.classList.contains('page-home-curricula')
    || path.endsWith('/index.html')
    || path.endsWith('/index-curricula.html')
    || path === '/'
    || path === '';
}

function normalizeLookupLabel(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+[—–-]\s+.*$/, '')
    .replace(/[()]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[’']/g, '')
    .replace(/\./g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function slugify(value) {
  return normalizeLookupLabel(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}
