# fix: 拒否された削除を「書き出しの失敗」から分ける (#3272)

## Request

「#3272 を先にやる」

## 何が起きているか（実物で確認した）

`propagateDeletes` を有効にしたコレクションで、削除が一件でも Google に拒否されると、画面は
「書き出しに失敗しました」だけになり、**成功した作成・更新の件数が消える**。

3箇所が連なっている:

1. `packages/core/src/google/collectionPush.ts` の `tally` — 掃除が拒否した削除
   （`deletes.skipped`）を、押し出せなかったレコードと同じ `skipped` に混ぜている
2. `packages/plugins/collection-plugin/src/vue/calendarPushResult.ts` の `pushProblems` —
   `errors` と `skipped` を連結する
3. 同 `components/CollectionView.vue` の `reportPush` — `problems` が空でなければ早期 return し、
   件数を出す経路に到達しない

## なぜ早期 return 自体は正しかったか

`skipped` に入るのが押し出せないレコードだけだった頃は、「この操作は頼んだことをやっていない」が
正しい読み方だった。`propagateDeletes` が、その読み方が成り立たない最初の項目を持ち込んだ。
**拒否された削除は「押し出しが失敗した」ではなく「消さないでおいた」**で、残りの書き出しは成功して
いる。

## 直しかた（両方やる。片方では足りない）

1. **core が区別を残す**: 結果に `keptInGoogle: string[]` を足し、`tally` は掃除の拒否をそこへ
   入れる（`skipped` からは外す）。`DeleteSweep` は既にその区別を持っている
2. **プラグインが件数と併記する**: `pushKeptDeletes` で取り出し、成功の文に「ただし削除は
   見送った」を添える。`pushProblems` には混ぜない

経路上の写し替えも合わせる:

- `server/api/routes/collectionCalendarPush.ts` の `CollectionPushBody` に項目を足す
- `packages/plugins/collection-plugin/src/vue/uiContext.ts` の `CollectionPushResult` では
  **optional** にする（古いホストの応答にはキーが無い。`deletedInGoogle?` と同じ前例）
- `collectionSync.ts` の `reportAutoPush`（自動書き出しの記録）でも別建てで出す。誰も見ていない
  実行なので、拒否は記録に残す

## テスト

- core: `tally` が両者を分けること。掃除の拒否は `skipped` に現れず `keptInGoogle` に入る
- プラグイン: `pushKeptDeletes` が拒否を返し、`pushProblems` がそれを含まないこと。
  古いホストの応答（キー無し）でも空配列になること
- i18n: 8ロケールにキーを足す

## やらないこと

`pushProblems` の早期 return は残す。押し出せなかったレコードは今も「頼んだことをやっていない」で、
そこを件数と混ぜると読み手が判断できなくなる。分けるのは**拒否された削除だけ**。
