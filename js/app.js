/**
 * OWASP VWAD — shared data and routing
 * Loads collection, assigns unique slugs, provides search and app-by-slug.
 */
(function () {
  'use strict';

  function slugify(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function assignSlugs(collection) {
    var seen = {};
    collection.forEach(function (app, i) {
      var base = slugify(app.name);
      var slug = base;
      var n = 1;
      while (seen[slug]) {
        n += 1;
        slug = base + '-' + n;
      }
      seen[slug] = true;
      app._slug = slug;
      app._index = i;
    });
    return collection;
  }

  var base = '';
  if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
    var scriptUrl = document.currentScript.src;
    var dir = scriptUrl.slice(0, scriptUrl.lastIndexOf('/') + 1);
    base = dir.replace(/js\/?$/i, '');
  }
  if (!base && typeof window !== 'undefined' && window.VWAD_BASE) {
    base = window.VWAD_BASE + (window.VWAD_BASE ? '/' : '');
  }
  var collectionPromise = fetch(base + 'data/collection.json')
    .then(function (r) {
      if (!r.ok) throw new Error('Failed to load collection');
      return r.json();
    })
    .then(assignSlugs);

  function getAppBySlug(slug) {
    return collectionPromise.then(function (list) {
      return list.find(function (app) {
        return app._slug === slug;
      }) || null;
    });
  }

  function searchApps(query, filters) {
    query = (query || '').toLowerCase().trim();
    filters = filters || {};
    return collectionPromise.then(function (list) {
      return list.filter(function (app) {
        if (filters.collection && filters.collection.length) {
          var hasCollection = (app.collection || []).some(function (c) {
            return filters.collection.indexOf(c) !== -1;
          });
          if (!hasCollection) return false;
        }
        if (filters.technology && filters.technology.length) {
          var tech = (app.technology || []).map(function (t) {
            return t.toLowerCase();
          });
          var hasTech = filters.technology.some(function (t) {
            return tech.indexOf(t.toLowerCase()) !== -1;
          });
          if (!hasTech) return false;
        }
        if (!query) return true;
        var searchable = [
          app.name,
          app.author,
          app.notes,
          (app.technology || []).join(' '),
          (app.collection || []).join(' ')
        ].join(' ').toLowerCase();
        return searchable.indexOf(query) !== -1;
      });
    });
  }

  function getPathSlug() {
    var pathname = window.location.pathname || '';
    var parts = pathname.split('app/');
    if (parts.length >= 2) {
      var after = (parts[1].replace(/\/$/, '') || '').split('/')[0];
      if (after && after !== 'html') return after;
    }
    if (window.location.hash) return window.location.hash.replace(/^#/, '').trim() || null;
    return null;
  }

  /** Returns { label, slug } for last_contributed age band; null if no/invalid date. */
  function getUpdatedBand(isoDate) {
    if (!isoDate) return null;
    var then = new Date(isoDate).getTime();
    if (isNaN(then)) return null;
    var days = (Date.now() - then) / (24 * 60 * 60 * 1000);
    if (days < 30) return { label: '< 1mo', slug: 'lt1mo' };
    if (days < 30 * 6) return { label: '< 6mo', slug: 'lt6mo' };
    if (days < 365) return { label: '< 1y', slug: 'lt1y' };
    if (days < 365 * 2) return { label: '< 2y', slug: 'lt2y' };
    return { label: '2y+', slug: '2y' };
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return iso;
    }
  }

  /**
   * Renders a single app as HTML (same layout as detail page).
   * options.backLink: true = "← Back to directory", 'slug' = "View full details" link to app/#slug, false/omit = no link
   * options.titleLink: 'slug' = wrap title in <a href="app/#{slug}"> (e.g. featured app → detail page)
   */
  function renderApp(app, options) {
    if (!app || typeof app !== 'object') return '';
    options = options || {};
    var html = '<article class="app-detail">';
    var titleText = escapeHtml(app.name || '');
    if (options.titleLink === 'slug' && app._slug) {
      var detailUrl = (typeof window !== 'undefined' && window.VWAD_BASE ? window.VWAD_BASE + '/' : '') + 'app/#' + escapeHtml(app._slug);
      html += '<h1 class="app-detail-title"><a href="' + detailUrl + '">' + titleText + '</a></h1>';
    } else {
      html += '<h1 class="app-detail-title">' + titleText + '</h1>';
    }

    html += '<div class="app-detail-meta">';
    if (app.collection && app.collection.length) {
      html += '<div class="app-detail-row"><span class="label">Collections</span> ';
      html += app.collection.map(function (c) {
        return '<span class="pill pill-collection">' + escapeHtml(c) + '</span>';
      }).join(' ');
      html += '</div>';
    }
    if (app.technology && app.technology.length) {
      html += '<div class="app-detail-row"><span class="label">Technology</span> ';
      html += app.technology.map(function (t) {
        return '<span class="pill">' + escapeHtml(t) + '</span>';
      }).join(' ');
      html += '</div>';
    }
    if (app.author) {
      html += '<div class="app-detail-row"><span class="label">Author</span> ' + escapeHtml(app.author) + '</div>';
    }
    if (app.stars != null) {
      var starsCount = String(app.stars);
      var badgeUrl = 'https://img.shields.io/badge/stars-' + encodeURIComponent(starsCount) + '-007ec6?style=flat';
      html += '<div class="app-detail-row"><span class="label">Stars</span> ';
      html += '<img class="app-detail-stars-badge" src="' + escapeHtml(badgeUrl) + '" alt="' + escapeHtml(starsCount) + ' stars" loading="lazy"></div>';
    }
    if (app.last_contributed) {
      var band = getUpdatedBand(app.last_contributed);
      var pill = band ? ' <span class="pill pill-updated pill-updated-' + escapeHtml(band.slug) + '">' + escapeHtml(band.label) + '</span>' : '';
      html += '<div class="app-detail-row"><span class="label">Last contribution</span> ' + escapeHtml(formatDate(app.last_contributed)) + pill + '</div>';
    }
    html += '</div>';

    html += '<div class="app-detail-links">';
    html += '<a href="' + escapeHtml(app.url || '#') + '" class="btn btn-primary" target="_blank" rel="noopener">Main link</a>';
    if (app.references && app.references.length) {
      app.references.forEach(function (ref) {
        html += ' <a href="' + escapeHtml(ref.url) + '" class="btn btn-secondary" target="_blank" rel="noopener">' + escapeHtml(ref.name) + '</a>';
      });
    }
    html += '</div>';

    if (app.notes) {
      html += '<div class="app-detail-notes"><h2>Notes</h2><p>' + escapeHtml(app.notes) + '</p></div>';
    }

    if (options.backLink === true) {
      var base = (typeof window !== 'undefined' && window.VWAD_BASE) ? window.VWAD_BASE + '/' : './';
      html += '<p class="app-detail-back"><a href="' + base + '">← Back to directory</a></p>';
    } else if (options.backLink === 'slug' && app._slug) {
      var appUrl = (typeof window !== 'undefined' && window.VWAD_BASE ? window.VWAD_BASE + '/' : '') + 'app/#' + escapeHtml(app._slug);
      html += '<p class="app-detail-back"><a href="' + appUrl + '">View full details</a></p>';
    }
    html += '</article>';
    return html;
  }

  window.VWAD = {
    getCollection: function () {
      return collectionPromise;
    },
    getAppBySlug: getAppBySlug,
    searchApps: searchApps,
    getPathSlug: getPathSlug,
    getUpdatedBand: getUpdatedBand,
    renderApp: renderApp,
    slugify: slugify
  };
})();
