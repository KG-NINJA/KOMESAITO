# COMSIGHT-like Programming Tank MVP (#KGNINJA)

Simple browser MVP inspired by PC-8801 "COMSIGHT": two tanks on a 16x16 grid, Canvas-based rendering, JSON-rule AIs, deterministic tick engine. No build/tools needed.

## GitHub Pages 公開手順

このプロジェクトは静的サイトとしてそのまま GitHub Pages にデプロイできます（ビルド不要）。

1) GitHub → Settings → Pages
- Source: `Deploy from a branch`
- Branch: `main`（または公開用ブランチ）
- Folder: `/root`
- Save → 数分後に `https://<username>.github.io/<repo>/` で公開

必要ファイルはリポジトリのルート直下:
- `index.html`（エントリ。`<script type="module" src="./dist/main.js">`）
- `dist/` 配下（`main.js`, `render3rd.js`, `render.js`, `engine.js`, `ai.js`, `types.js` など）

備考: `index.html` は `file:` で開かれた場合のみ `bundle.js` にフォールバックします。Pages では HTTP 配信のため ESM で動作します。

## 使い方（ローカルでも同様）
- `index.html` をブラウザで開く（Chrome/Edge/Firefox）
- Play/Pause/Step/Reset を操作
- 2つの AI エディタを編集し Apply AI で反映
- 敵 AI プリセット（Aggressive/Runner/Ambush）をドロップダウンで選択
- 「Tweet My AI」ボタンで AI1 をワンクリック投稿（`#KGNINJA #KOMESAITO`）

## ルール概要
- Actions: `MOVE`, `TURN_LEFT`, `TURN_RIGHT`, `FIRE`, `FIRE_ROCKET`, `SCAN`, `WAIT`
- Tanks: 5 HP, 移動1マス, 弾のクールダウン2tick
- Sensing: `enemy_ahead`, `wall_ahead`（直進方向の可視/壁）他、スキャン結果条件
- 終了: どちらかが全滅、または1000tickで引き分け

## AI JSON 仕様
- 先に一致したルールが発火
- 条件: `enemy_ahead`, `wall_ahead`, `has_scan`, `scanning`, `scan_ahead`, `scan_left`, `scan_right`, `scan_back`, `random<p`, `else`
- 例:
```
{
  "name": "Seeker",
  "rules": [
    { "if": "enemy_ahead", "do": "FIRE" },
    { "if": "wall_ahead", "do": "TURN_RIGHT" },
    { "if": "random<0.1", "do": "TURN_LEFT" },
    { "if": "else", "do": "MOVE" }
  ]
}
```

## メモ
- 外部依存なし。`src/` は TypeScript、実行は `dist/` の ES Modules
- 小規模構成なので拡張しやすいです（ルール追加、武器・装甲、UI強化など）

## ライセンス / クレジット
- デモ目的。オリジナル COMSIGHT とは無関係です。
