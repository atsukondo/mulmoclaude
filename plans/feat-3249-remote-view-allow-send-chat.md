# feat(remote-host): スマホの remote view で `allowSendChat` を尊重する (#3249)

## Request

#3249（報告者 @shinsuchi）。#3062 で入った `views[]` の `allowSendChat: true` が、
スマホ（mulmoserver.web.app）で開いた `target: "mobile"` のビューでは効かず、
ボタンを押しても入力画面（下書き）で止まる。PC では期待どおり送信される。

ユーザー判断: **案 B（`allowSendChat` を載せてスマホが尊重する）で、ホストとスマホの両方をやる。**

## 検証（報告を鵜呑みにせず自分で辿った）

報告の3点はすべて事実だった:

1. `server/workspace/collections/remoteView.ts:89` が返すのは
   `{ id, label, icon?, target: "mobile" }` だけ。型 `RemoteViewInfo` にも
   `allowSendChat` が無い。`getRemoteView.ts` は `view` をそのまま透過するので、
   スマホは知りようがない
2. `customViewSendsChat()` の呼び出し元は `CollectionCustomView.vue` と
   `CollectionRemoteViewPreview.vue` の2つだけ（どちらも PC）。remote-host 経路に無い
3. コメントと実機の挙動が食い違う

## 報告に無かった発見 — これは載せ忘れではなく設計の分岐

コードは2箇所で「**スマホは常に送信する**」を意図的な設計として明記している:

- `packages/core/src/collection/core/viewChatPolicy.ts` —
  「The phone runtime does not consult this: it always sends, because a phone has
  no Enter key for the user to press (receptron/mulmoterminal#1253).」
- `packages/core/src/remote-view/index.ts` — 同趣旨が2箇所

つまり `allowSendChat` が payload に無いのは意図どおりで、欠けているのは
「スマホは常に送る」というスマホアプリ側の実装。観測された「下書きで止まる」は
**アプリがホストの契約と逆のことをしている**状態。

案 B を採ると **#1253 の判断（Enter キーが無いから常に送る）を覆す**ことになるので、
上記2箇所のコメントは同時に直さないと嘘になる。次に読む人が案 A を実装してしまう。

## やること（この repo = ホスト側）

1. `RemoteViewInfo` に `allowSendChat: boolean` を足す（optional ではなく必須）。
   optional にすると「載っていない」と「false」が区別できず、スマホ側が
   `=== true` で読む限り同じだが、**古いホストと新しいスマホの組み合わせ**で
   「宣言したのに効かない」が静かに起きる。必須にすれば型で漏れが止まる
2. `remoteView.ts` の組み立てで `allowSendChat: customViewSendsChat(view)` を載せる。
   **判定の正はスキーマ側1箇所のまま**（default-deny を維持）
3. `viewChatPolicy.ts` と `remote-view/index.ts` のコメントを、
   「スマホも宣言に従う」に直す
4. テスト: payload に載ること、宣言なし＝`false`、宣言あり＝`true`

## やらないこと（この repo の外）

スマホアプリ（`mulmoserver.web.app`）は**別リポジトリ**。
`mc-start-chat` を受けたとき `view.allowSendChat === true` なら `openPromptChat` ではなく
`startChat` をホストへ送る変更が要る。**ホスト側だけでは利用者から見て何も変わらない。**

## 互換性

- ホストが新しくスマホが古い → スマホは知らないフィールドを無視するだけ。現状どおり下書き
- ホストが古くスマホが新しい → `allowSendChat` が来ないので `=== true` が偽。下書き（default-deny）

どちらも安全側に倒れる。
