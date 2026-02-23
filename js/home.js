/**
 * Home page: browse all apps, search by any criteria, link to app pages
 */
(function () {
  'use strict';

  var COLLECTIONS = ['online', 'offline', 'mobile', 'container', 'platform'];

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getAppUrl(app) {
    return 'app/#' + (app._slug || '');
  }

  function sortApps(apps, sortBy, sortDir) {
    if (!sortBy || !sortDir || !apps.length) return apps.slice();
    var mult = sortDir === 'desc' ? -1 : 1;
    return apps.slice().sort(function (a, b) {
      var va, vb;
      if (sortBy === 'name') {
        va = (a.name || '').toLowerCase();
        vb = (b.name || '').toLowerCase();
        return mult * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      if (sortBy === 'author') {
        va = (a.author || '').toLowerCase();
        vb = (b.author || '').toLowerCase();
        return mult * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      if (sortBy === 'stars') {
        va = a.stars != null ? Number(a.stars) : -1;
        vb = b.stars != null ? Number(b.stars) : -1;
        return mult * (va - vb);
      }
      if (sortBy === 'updated') {
        va = a.last_contributed ? new Date(a.last_contributed).getTime() : 0;
        vb = b.last_contributed ? new Date(b.last_contributed).getTime() : 0;
        return mult * (va - vb);
      }
      return 0;
    });
  }

  function renderTable(apps, sortState) {
    if (!apps.length) {
      return '<p class="muted">No applications match.</p>';
    }
    var sortBy = sortState && sortState.column;
    var sortDir = sortState && sortState.dir;
    var th = function (key, label) {
      var isSortable = key === 'name' || key === 'author' || key === 'stars' || key === 'updated';
      if (!isSortable) return '<th>' + escapeHtml(label) + '</th>';
      var ariaSort = sortBy === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      var cls = 'sortable' + (sortBy === key ? ' sorted-' + sortDir : '');
      return '<th class="' + cls + '" scope="col" data-sort="' + escapeHtml(key) + '" aria-sort="' + ariaSort + '"><button type="button">' + escapeHtml(label) + '</button></th>';
    };
    var clearSortHtml = sortState ? '<div class="table-toolbar"><button type="button" class="sort-clear">Clear sort</button></div>' : '';
    var html = '<div class="table-scroll-outer"><div class="table-wrap">' + clearSortHtml + '<table class="apps-table"><thead><tr>';
    html += th('name', 'Name') + '<th>Collections</th><th>Technology</th>' + th('author', 'Author') + th('stars', 'Stars') + th('updated', 'Updated');
    html += '</tr></thead><tbody>';
    apps.forEach(function (app) {
      var url = getAppUrl(app);
      var updatedBand = window.VWAD && window.VWAD.getUpdatedBand ? window.VWAD.getUpdatedBand(app.last_contributed) : null;
      var updatedCell = updatedBand
        ? '<span class="pill pill-updated pill-updated-' + escapeHtml(updatedBand.slug) + '" title="Last contribution">' + escapeHtml(updatedBand.label) + '</span>'
        : '—';
      html += '<tr>';
      html += '<td><a href="' + escapeHtml(url) + '">' + escapeHtml(app.name) + '</a></td>';
      html += '<td>' + (app.collection || []).map(function (c) {
        return '<span class="pill pill-collection">' + escapeHtml(c) + '</span>';
      }).join(' ') + '</td>';
      html += '<td>' + (app.technology || []).slice(0, 3).map(function (t) {
        return '<span class="pill">' + escapeHtml(t) + '</span>';
      }).join(' ') + (app.technology && app.technology.length > 3 ? ' …' : '') + '</td>';
      html += '<td>' + escapeHtml(app.author || '—') + '</td>';
      html += '<td>' + (app.stars != null ? escapeHtml(String(app.stars)) : '—') + '</td>';
      html += '<td>' + updatedCell + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function initSearch() {
    var searchInput = document.getElementById('search-input');
    var collectionSelect = document.getElementById('filter-collection');
    var techInput = document.getElementById('filter-technology');
    var resultsEl = document.getElementById('browse-results');
    var countEl = document.getElementById('result-count');
    if (!resultsEl) return;

    var sortState = null;

    function runSearch() {
      var query = searchInput ? searchInput.value.trim() : '';
      var collection = collectionSelect && collectionSelect.value ? [collectionSelect.value] : [];
      var techFilter = techInput ? techInput.value.trim() : '';
      var filters = { collection: collection };
      if (techFilter) filters.technology = [techFilter];

      window.VWAD.searchApps(query, filters).then(function (apps) {
        var sorted = sortState ? sortApps(apps, sortState.column, sortState.dir) : apps.slice();
        if (countEl) countEl.textContent = apps.length + ' application' + (apps.length === 1 ? '' : 's');
        resultsEl.innerHTML = renderTable(sorted, sortState);
        resultsEl.querySelectorAll('.apps-table th.sortable button').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var th = btn.closest('th');
            var col = th && th.getAttribute('data-sort');
            if (!col) return;
            if (sortState && sortState.column === col) {
              if (sortState.dir === 'asc') {
                sortState.dir = 'desc';
              } else {
                sortState = null;
              }
            } else {
              sortState = { column: col, dir: 'asc' };
            }
            runSearch();
          });
        });
        var clearBtn = resultsEl.querySelector('.sort-clear');
        if (clearBtn) clearBtn.addEventListener('click', function () { sortState = null; runSearch(); });
        var scrollOuter = resultsEl.querySelector('.table-scroll-outer');
        if (scrollOuter) {
          bindTableScrollFade(scrollOuter);
          updateTableScrollFade(scrollOuter);
          requestAnimationFrame(function () {
            updateTableScrollFade(scrollOuter);
          });
        }
      });
    }

    function updateTableScrollFade(outer) {
      if (!outer) return;
      var wrap = outer.querySelector('.table-wrap');
      if (!wrap) return;
      var scrollable = wrap.scrollWidth > wrap.clientWidth;
      var atStart = wrap.scrollLeft <= 2;
      var atEnd = wrap.scrollLeft >= wrap.scrollWidth - wrap.clientWidth - 2;
      outer.classList.toggle('scrollable', scrollable);
      outer.classList.toggle('show-left', scrollable && !atStart);
      outer.classList.toggle('show-right', scrollable && !atEnd);
    }

    function bindTableScrollFade(outer) {
      if (!outer) return;
      var wrap = outer.querySelector('.table-wrap');
      if (!wrap) return;
      wrap.addEventListener('scroll', function () { updateTableScrollFade(outer); });
      window.addEventListener('resize', function () { updateTableScrollFade(outer); });
      // Shift + wheel: horizontal scroll (common in spreadsheets, IDEs, design tools)
      wrap.addEventListener('wheel', function (e) {
        if (!e.shiftKey || wrap.scrollWidth <= wrap.clientWidth) return;
        wrap.scrollLeft += e.deltaY;
        e.preventDefault();
      }, { passive: false });
      // Keyboard: Arrow Left/Right when table area has focus (e.g. after Tab or click)
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('title', 'Shift+scroll or arrow keys to scroll horizontally');
      wrap.addEventListener('keydown', function (e) {
        if (wrap.scrollWidth <= wrap.clientWidth) return;
        var step = 40;
        if (e.key === 'ArrowLeft') {
          wrap.scrollLeft -= step;
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          wrap.scrollLeft += step;
          e.preventDefault();
        }
      });
    }

    if (searchInput) searchInput.addEventListener('input', runSearch);
    if (searchInput) searchInput.addEventListener('change', runSearch);
    if (collectionSelect) collectionSelect.addEventListener('change', runSearch);
    if (techInput) techInput.addEventListener('input', runSearch);
    if (techInput) techInput.addEventListener('change', runSearch);

    runSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
