/*
 * manual-kit / mock.js — 吹き出しの引き出し線を、実際の位置を測って引き直す
 *
 * CSS だけだと、複数行にまたがる赤枠（.mk-hl）の右端が取れず、線が枠の中から出てしまう。
 * ここでは枠と吹き出しの位置を測り、線を「枠の右端の真ん中 → 吹き出し」に引き、
 * 吹き出しを枠の高さの真ん中にそろえる。動かない環境では CSS の .mk-co-lead のまま。
 * 狭い画面（吹き出しを出さないとき）は何もしない。
 */
(function () {
  function layout(root) {
    (root || document).querySelectorAll('.mk-co').forEach(function (co) {
      co.querySelectorAll('.mk-co-drawn').forEach(function (e) { e.remove(); });
      if (parseFloat(getComputedStyle(co).paddingRight) === 0) { co.classList.remove('mk-co--js'); return; }
      co.classList.add('mk-co--js');
      var cr = co.getBoundingClientRect();
      co.querySelectorAll('.mk-co-note').forEach(function (note) {
        var hl = note.previousElementSibling;
        while (hl && !hl.classList.contains('mk-hl')) hl = hl.previousElementSibling;
        if (!hl) return;
        var hr = hl.getBoundingClientRect();
        var y = hr.top + hr.height / 2 - cr.top;
        note.style.marginTop = '0';
        note.style.top = (y - note.offsetHeight / 2) + 'px';
        var x1 = hr.right - cr.left + 2;                       // 枠線（2px）の外側から
        var x2 = note.getBoundingClientRect().left - cr.left;
        var line = document.createElement('span');
        line.className = 'mk-co-drawn';
        line.style.left = x1 + 'px';
        line.style.top = y + 'px';
        line.style.width = Math.max(0, x2 - x1) + 'px';
        co.appendChild(line);
      });
    });
  }
  window.mkLayout = layout;
  function run() { layout(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  window.addEventListener('resize', run);
})();
