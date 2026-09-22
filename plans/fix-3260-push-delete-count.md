# 削除件数の表示を実態に合わせる（#3260）

## 症状

`propagateDeletes` を有効にしたコレクションで push すると、Google から実際に
消えたのに「{localDeletes}件のローカル削除は**未反映**」と表示される。

## 原因

`CollectionView.vue:695` が4つしか読んでいなかった。#3247 で `deletedInGoogle` を
足し `pushWroteSomething` も数えるようにしたが、**文言を直していなかった**。

`localDeletes` は「こちらで何件消えたか」で伝播の有無で意味が変わらない。伝播した
分は `deletedInGoogle`。なので `localDeletes` をそのまま「未反映」と呼ぶのは、
オプトインした瞬間に嘘になる。

## 直し方

「未反映」の件数は **`localDeletes - deletedInGoogle`**。

文言は2種類に分け、**伝播していないときは今と同じ文**にする（オプトインしていない
大多数の表示を変えない）:

- `pushDone`（既存）— `deletedInGoogle === 0` のとき。この分岐では
  `deletesNotApplied === localDeletes` なので表示は不変
- `pushDoneWithDeletes`（新規）— `deletedInGoogle > 0` のとき。削除件数を含む

件数の導出は `calendarPushResult.ts`（既存の純粋モジュール）へ。remainder は
`Math.max(..., 0)` で下限を切る — 古いホストは `deletedInGoogle` を返さず、負の
件数はそのまま画面に出るため。

## 非目標

- 件数の常時5個表示。オプトインしていない利用者に `0 deleted in Google` は邪魔

## 検証

- `test/plugins/collection/test_calendarPushCounts.ts` — 伝播オフ / フィールド欠落 /
  全部通った / 一部拒否 / 負にならない / 他3件の素通し、および
  `pushWroteSomething` と文言選択が一致すること
- 8ロケールに `pushDoneWithDeletes` があり、5つのプレースホルダが揃うことを機械確認
