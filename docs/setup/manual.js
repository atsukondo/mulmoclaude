document.querySelectorAll('.cmd button').forEach(function(btn){
  btn.addEventListener('click',function(){
    var pre=btn.parentElement.querySelector('pre');
    function done(){btn.textContent='コピーしました';setTimeout(function(){btn.textContent='コピー'},1600)}
    function fallback(){var r=document.createRange();r.selectNodeContents(pre);var s=getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='選択しました'}
    try{navigator.clipboard.writeText(pre.textContent).then(done,fallback)}catch(e){fallback()}
  });
});
