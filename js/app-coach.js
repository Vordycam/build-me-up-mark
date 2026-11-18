/* Coach tab: the goal playbooks, the evidence behind them, and the champion insights.
   Features:
     - goal switcher (defaults to your goal) showing the full playbook: who it is for, body-fat range,
       energy, protein, lifting, cardio, progression and recovery rules
     - the studies each playbook leans on, in plain words
     - champion cards for the goal: titles, philosophy, signature protocol, the principle the app encodes,
       and a quote with its source (quotes not traced to a primary source are marked) */
(function () {
  'use strict';
  var A = window.App;
  var view = { goal: null };

  A.register('coach', function (el) {
    var p = A.profile();
    if (!view.goal) view.goal = p ? p.goal : 'lean';
    var pb = DATA.PLAYBOOKS[view.goal];
    el.appendChild(A.h('<div class="chips mb">' + Object.keys(DATA.GOALS).map(function (g) { return '<button class="chip' + (view.goal === g ? ' on' : '') + '" data-action="coach-goal" data-g="' + g + '">' + DATA.GOALS[g].label + '</button>'; }).join('') + '</div>'));
    el.appendChild(A.h('<div class="card prog-card goal-' + view.goal + '"><h2>' + A.esc(pb.title) + '</h2><p class="muted">' + A.esc(pb.who) + '</p><dl class="playbook"><dt>Body fat</dt><dd>' + A.esc(pb.bodyFat) + '</dd><dt>Energy</dt><dd>' + A.esc(pb.energy) + '</dd><dt>Protein</dt><dd>' + A.esc(pb.protein) + '</dd><dt>Lifting</dt><dd>' + A.esc(pb.lifting) + '</dd><dt>Cardio</dt><dd>' + A.esc(pb.cardio) + '</dd><dt>Progression</dt><dd>' + A.esc(pb.progression) + '</dd><dt>Recovery</dt><dd>' + A.esc(pb.recovery) + '</dd></dl></div>'));
    el.appendChild(A.h('<div class="card flat"><h3>The evidence</h3><ul class="steps evidence">' + pb.evidence.map(function (e) { return '<li>' + A.esc(e) + '</li>'; }).join('') + '</ul><p class="small muted">Full notes and sources are in the repository under docs/SCIENCE.md.</p></div>'));
    el.appendChild(A.h('<h2 class="mb">Champions of ' + DATA.GOALS[view.goal].label.toLowerCase() + '</h2>'));
    DATA.CHAMPIONS.filter(function (c) { return c.goal === view.goal; }).forEach(function (c) {
      el.appendChild(A.h('<div class="card champ-card"><h3>' + A.esc(c.name) + '</h3><p class="small muted">' + A.esc(c.era) + ' · ' + A.esc(c.titles) + '</p><p class="small">' + A.esc(c.philosophy) + '</p><p class="small"><strong>Signature protocol:</strong> ' + A.esc(c.protocol) + '</p><blockquote>' + A.esc(c.quote) + '</blockquote><p class="small muted">' + (c.verified ? 'Source: ' : 'Widely attributed, not traced to a primary source. See: ') + '<a href="' + A.esc(c.source) + '" rel="nofollow" target="_blank">' + A.esc(c.source.replace(/^https?:\/\//, '').split('/')[0]) + '</a></p><p class="small"><strong>What the app takes from this:</strong> ' + A.esc(c.principle) + '</p></div>'));
    });
    var progs = DATA.PROGRAMS.filter(function (pr) { return pr.goal === view.goal; });
    el.appendChild(A.h('<div class="card flat"><h3>Programs for this goal</h3><div class="chips">' + progs.map(function (pr) { return '<button class="chip" data-action="open-program" data-id="' + pr.id + '">' + A.esc(pr.name) + '</button>'; }).join('') + '</div></div>'));
  });
  A.action('coach-goal', function (el) { view.goal = el.getAttribute('data-g'); A.render('coach'); });
})();
