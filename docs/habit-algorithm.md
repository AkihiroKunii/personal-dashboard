# habit-engine 実装仕様

出典: 「単一ユーザー向け習慣化アプリの実行計画アルゴリズム設計」(deep research文書, 2026)を実装向けに圧縮したもの。
設計判断の学術的根拠は原文書を参照。本書はClaude Codeが実装時に参照する仕様のみを記載する。

---

## 1. 設計原理(実装判断に迷ったらここへ戻る)

1. **目標ではなく行動を扱う。**「英語を頑張る」は入力として不完全。「平日の朝食後に5分シャドーイング」のような trigger-action 形式(実行意図)へ正規化して初めて計画対象になる。
2. **文脈固定 > 時刻固定。**cueの優先順位は event-based > location-based > time-based。時刻通知は cue 未確立の初期1〜2週間の補助にとどめる。
3. **最適化目標は短期生産量ではない。**中長期の自動化確率と再開可能性の最大化、認知負荷・通知負荷・失敗コストの最小化。
4. **失敗設計が継続率を決める。**一度の未実行(lapse)を連鎖的放棄(relapse)にしない。binary streakは採用しない。
5. **報酬は「統制」ではなく「情報」。**ポイント・ランキング型の外的報酬は使わない。進捗の可視化、価値理由の再提示、観察ベースの振り返り文言を使う。
6. **v1は解釈可能なルール+軽量確率モデル。**full RLは実装しない。contextual banditは通知最適化用途に限り将来フェーズで検討。

## 2. ドメインモデル(7オブジェクト)

| オブジェクト | 役割 | 主要フィールド |
|---|---|---|
| `UserProfile` | 個人差変数の保持 | values[], availableWindows[], maxNotificationsPerDay, 時間帯別エネルギー |
| `HabitSpec` | 正規化済みの活動仕様 | activity, targetFrequencyPerWeek, goalType, preferredContexts[], constraints[], why |
| `PlanLadder` | 活動の4段階分解 | minimal / standard / stretch / recovery 各実行単位 |
| `ContextAnchor` | 文脈手がかり | type(event/location/time), label, 対応する時間窓 |
| `PlanAssignment` | 週間計画の1エントリ | habitId, step, window, anchor, date |
| `Observation` | 日次記録 | completed, effort, contextMatch, promptUsed, timestamp |
| `HabitState` | システム推定の進行度 | stage, momentum, completionRate(直近7/14日), promptDependence |

**重要な分離**: 「活動」(ユーザーの希望)と「習慣状態」(システムの推定)は別物。同一活動でも文脈が異なれば独立した HabitState を持つ(例: 朝の英語=maintenance、夜の英語=initiation)。

`UserProfile` / `HabitSpec` のJSONスキーマ例は原文書 §推奨アルゴリズムアーキテクチャ のサンプルに準拠する。

## 3. 活動正規化 (canonicalize)

入力された生の活動を以下に分類・推定する:

- 活動タイプ: `skill` / `physical` / `admin` / `reflective` / `environment-prep`
- 推定属性: `friction`, `setup_cost`, `cueability`, `reward_delay`, `safety_level`

分類例: 英語学習=skill(setup_cost低, reward_delay高, cueability高)、家計簿=admin(reward_delay中)、筋トレ=physical(setup_cost中)。

## 4. 分解ラダー (buildLadder)

活動タイプ別のテンプレート初期値:

| タイプ | 最小実行単位 | 標準 | 伸長 | 復旧 |
|---|---|---|---|---|
| skill | 3〜5分の単一練習 | 10〜20分 | 25〜40分 | 1分の再接続 |
| physical | 1セット or 3〜5分の軽運動 | 10〜20分 | 25〜40分 | 30〜90秒の代替運動 |
| admin | 1件記録・1アクション | 5〜10分 | 15〜30分 | 写真保存・メモのみ |
| reflective | 一行記録 | 5分 | 15分 | 気分タグのみ |

制約: 最小実行単位は「小さいが、本人がその活動だと認識できる最小有意味単位」。小さすぎ(価値接続が切れる)も大きすぎ(ability超過)も不可。ユーザーによる編集を許可する。

## 5. 週間計画生成 (generatePlan)

制約付き割当問題として実装。活動ステップ s × 候補時間窓 w の効用:

```
U(s,w) = α·P_complete(s,w) + β·C_cue(s,w) + γ·F_preference(w)
       + δ·G_gap(s) − ε·B_burden(w) − ζ·K_conflict(s,w)
```

- P_complete: 完了確率(コールドスタート時はルール近似、履歴蓄積後にBeta-Binomialで更新)
- C_cue: cue品質(event > location > time)
- F_preference: 時間帯エネルギー等の選好適合
- G_gap: 週目標との差分
- B_burden: 通知・疲労負荷
- K_conflict: スケジュール衝突

解法は **greedy + local repair** で十分(厳密最適化は不要)。制約: 週目標頻度、最小間隔日数、1日の最大負荷。係数α〜ζは設定ファイルで外出しし、テストで感度を確認できるようにする。

## 6. 状態遷移 (applyObservation)

HabitState.stage は5段階: `initiate → stabilize → scale → maintain`、異常時 `recover`。

| 遷移 | 条件(初期値) | 動作 |
|---|---|---|
| 開始 | 新規習慣 | 必ず `initiate`(最小実行単位のみ) |
| 難度上げ | 直近14日の完了率が高く、努力感が低い | stabilize→scale(標準/伸長単位へ) |
| 難度下げ | 直近7〜14日の完了率低下、または疲労・抵抗上昇 | 一段下の単位へ縮小 |
| recover突入 | 未実行の連続(閾値は設定値、初期3回) | §7の介入順序を開始 |
| maintain | 自己開始率が高く、通知なしで安定 | 通知を縮小・停止 |

momentumスコア: `momentum = decay(momentum) + (completed ? 1 : 0)`。減衰付き累積。未実行1回でゼロにしない。

## 7. 失敗回復の介入順序(固定)

recover状態では以下を**この順番で**提示する(問題はmotivation欠如とは限らず、ability・cue・負荷のミスマッチが多いため):

1. 復旧単位の提示
2. 難度縮小
3. cue再設計(アンカー再選択)
4. 価値理由(why)の再接続

振り返り文言は評価ではなく観察ベース(自己批判を誘発する表現を避ける)。

## 8. 通知ポリシー

- 初期(cue確立前の1〜2週間)のみ time-based reminder を補助として許可
- 定着に応じて通知を縮小し、event cue による自己開始へ移行
- 1日の通知上限は UserProfile.maxNotificationsPerDay を厳守
- v1では `choose_daily_intervention` はルールベースのみ実装(bandit分岐はインターフェースだけ切っておく)

## 9. 計測(週次レビューで表示する指標)

完了率だけでは不十分。以下を追跡する:

- 完了率 / 文脈一致率 / 自己開始率(通知なしでの実行比率) / 努力感 / 通知依存度 / momentum
- automaticity自己報告(短い1問、週1回)

## 10. 実装フェーズ(Claude Codeセッション分割の単位)

| フェーズ | 成果物 | 完了条件 |
|---|---|---|
| Foundation | ドメインモデル7種 + IndexedDB永続化 | JSON入出力が安定し、活動登録・履歴保存が可能 |
| Planning | canonicalizer, ladder_builder, window_generator, scheduler | 複数活動から一貫した週間計画を返せる(単体テスト付き) |
| Execution | checkin, momentum_score, review | 完了・努力・cue一致を記録し日次提案ができる |
| Adaptation | difficulty_manager, recovery_engine, anchor_reselector | 失敗後に縮小・再計画できる |
| Personalization | success_model(Beta-Binomial), utility_scorer | 文脈別成功率で計画順位が変わる |
| Optimization | (実装しない) | 将来フェーズ: 通知bandit。v1ではインターフェース定義のみ |

**UIより先にエンジン(純粋関数+テスト)を完成させること。**

## 11. サンプルシナリオ(テストケースの基準)

入力: 「英語学習 週5」「筋トレ 週3」「家計記録 毎日」+ 時間窓(朝食後20分[平日], 帰宅後30分[月水金], 就寝前10分[毎日])

期待出力の性質:
- 月〜金の朝食後に英語の最小単位(5分)。一部曜日に標準単位への拡張
- 月水金の帰宅後に筋トレ標準単位
- 毎日夕食後または就寝前に家計記録(3分)
- 各活動に recovery 版が併記される
- 通知は初週2/日以内、以降event cueへ移行
- 複数活動間で文脈・負荷の衝突がない(K_conflictが機能している)
