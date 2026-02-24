import { useMemo, useState } from 'react'

type CardId = 'strike' | 'defend' | 'bash'

type Actor = {
  hp: number
  maxHp: number
  block: number
  vulnerable: number
}

type Player = Actor & {
  energy: number
  drawPile: CardId[]
  hand: CardId[]
  discardPile: CardId[]
  exhaustPile: CardId[]
}

type EnemyIntent =
  | { id: 'chant'; label: string; strength: number }
  | { id: 'ritual_attack'; label: string; attack: number }

type Enemy = Actor & {
  name: string
  strength: number
  intentIndex: number
  intent: EnemyIntent
}

type BattlePhase = 'player' | 'won' | 'lost'

type BattleState = {
  turn: number
  phase: BattlePhase
  player: Player
  enemy: Enemy
  log: string[]
}

type CardDef = {
  id: CardId
  name: string
  cost: number
  description: string
}

type PileType = 'draw' | 'discard' | 'exhaust'
type BuffItem = { label: string; value: number }

const STARTING_DECK: CardId[] = [
  'strike',
  'strike',
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'defend',
  'bash',
]

const CARDS: Record<CardId, CardDef> = {
  strike: { id: 'strike', name: '打击', cost: 1, description: '造成 6 点伤害。' },
  defend: { id: 'defend', name: '防御', cost: 1, description: '获得 5 点护甲。' },
  bash: { id: 'bash', name: '重击', cost: 2, description: '造成 8 点伤害，施加 2 层易伤。' },
}

const INTENT_ROTATION: EnemyIntent[] = [
  { id: 'chant', label: '吟唱 (+3 力量)', strength: 3 },
  { id: 'ritual_attack', label: '祭祀斩击 (6)', attack: 6 },
  { id: 'ritual_attack', label: '祭祀斩击 (6)', attack: 6 },
]

const PILE_LABEL: Record<PileType, string> = {
  draw: '抽牌堆',
  discard: '弃牌堆',
  exhaust: '消耗牌堆',
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function drawCards(player: Player, amount: number): Player {
  let drawPile = [...player.drawPile]
  let discardPile = [...player.discardPile]
  const hand = [...player.hand]

  for (let i = 0; i < amount; i += 1) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) {
        break
      }
      drawPile = shuffle(discardPile)
      discardPile = []
    }

    const next = drawPile.pop()
    if (next) {
      hand.push(next)
    }
  }

  return {
    ...player,
    drawPile,
    discardPile,
    hand,
  }
}

function applyVulnerable(damage: number, target: Actor): number {
  if (target.vulnerable <= 0) {
    return damage
  }
  return Math.floor(damage * 1.5)
}

function dealDamage(target: Actor, rawDamage: number): { target: Actor; hpLoss: number } {
  const blocked = Math.min(target.block, rawDamage)
  const hpLoss = Math.max(rawDamage - blocked, 0)

  return {
    target: {
      ...target,
      block: target.block - blocked,
      hp: Math.max(target.hp - hpLoss, 0),
    },
    hpLoss,
  }
}

function createInitialState(): BattleState {
  const playerBase: Player = {
    hp: 80,
    maxHp: 80,
    block: 0,
    vulnerable: 0,
    energy: 3,
    drawPile: shuffle(STARTING_DECK),
    hand: [],
    discardPile: [],
    exhaustPile: [],
  }

  return {
    turn: 1,
    phase: 'player',
    player: drawCards(playerBase, 5),
    enemy: {
      name: '邪教徒',
      hp: 50,
      maxHp: 50,
      block: 0,
      vulnerable: 0,
      strength: 0,
      intentIndex: 0,
      intent: INTENT_ROTATION[0],
    },
    log: ['战斗开始：红裤衩 vs 邪教徒'],
  }
}

function HpBlockBar({ hp, maxHp, block }: { hp: number; maxHp: number; block: number }) {
  const hpPercent = Math.max((hp / maxHp) * 100, 0)
  return (
    <div className="bars">
      <div className="bar hp-bar">
        <div className="fill" style={{ width: `${hpPercent}%` }} />
        <span>{hp}/{maxHp} HP</span>
      </div>
      <div className="bar block-bar">
        <div className="fill" style={{ width: `${Math.min((block / 30) * 100, 100)}%` }} />
        <span>{block} 护甲</span>
      </div>
    </div>
  )
}

function BuffSlots({ title, buffs, rightAlign = false }: { title: string; buffs: BuffItem[]; rightAlign?: boolean }) {
  return (
    <div className={`buff-slots ${rightAlign ? 'right' : ''}`}>
      <p className="buff-title">{title}</p>
      <div className="buff-list">
        {buffs.map((buff) => (
          <div key={buff.label} className={`buff-chip ${buff.value > 0 ? 'active' : 'inactive'}`}>
            <span>{buff.label}</span>
            <strong>{buff.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function RelicBurningBlood() {
  return (
    <div className="relic" title="燃烧之血">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="fire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe07a" />
            <stop offset="55%" stopColor="#ff7a30" />
            <stop offset="100%" stopColor="#b32514" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="#3a1d12" stroke="#f4b56f" strokeWidth="3" />
        <path d="M34 13c3 9-4 12-4 18 0 4 3 7 7 7 5 0 9-4 9-10 0-8-5-12-12-15z" fill="url(#fire)" />
        <path d="M24 26c0 0-8 5-8 14 0 7 6 12 14 12s14-5 14-12c0-6-4-11-9-13 1 7-2 11-7 11-4 0-7-3-7-7 0-2 1-4 3-5z" fill="url(#fire)" />
      </svg>
      <span>燃烧之血</span>
    </div>
  )
}

function FighterIronclad() {
  return (
    <svg className="fighter-svg" viewBox="0 0 180 180" aria-label="红裤衩">
      <circle cx="90" cy="30" r="18" fill="#f2b48a" />
      <rect x="58" y="50" width="64" height="58" rx="10" fill="#cb2f2f" />
      <rect x="62" y="104" width="56" height="24" rx="6" fill="#8d1c1f" />
      <rect x="48" y="58" width="10" height="44" rx="4" fill="#f2b48a" />
      <rect x="122" y="58" width="10" height="44" rx="4" fill="#f2b48a" />
      <rect x="66" y="128" width="18" height="38" rx="6" fill="#f2b48a" />
      <rect x="96" y="128" width="18" height="38" rx="6" fill="#f2b48a" />
    </svg>
  )
}

function FighterCultist() {
  return (
    <svg className="fighter-svg" viewBox="0 0 180 180" aria-label="蓝色邪教徒">
      <circle cx="90" cy="34" r="14" fill="#f0d9b5" />
      <path d="M52 58c6-16 18-24 38-24s32 8 38 24v78H52z" fill="#265ea8" />
      <path d="M70 82h40v54H70z" fill="#1d3f75" />
      <circle cx="84" cy="32" r="3" fill="#111" />
      <circle cx="96" cy="32" r="3" fill="#111" />
      <path d="M83 42h14" stroke="#111" strokeWidth="2" />
      <rect x="40" y="70" width="12" height="46" rx="5" fill="#f0d9b5" />
      <rect x="128" y="70" width="12" height="46" rx="5" fill="#f0d9b5" />
    </svg>
  )
}

function App() {
  const [state, setState] = useState<BattleState>(() => createInitialState())
  const [openedPile, setOpenedPile] = useState<PileType | null>(null)

  const statusText = useMemo(() => {
    if (state.phase === 'won') {
      return '胜利'
    }
    if (state.phase === 'lost') {
      return '失败'
    }
    return `第 ${state.turn} 回合`
  }, [state.phase, state.turn])

  const playCard = (handIndex: number) => {
    setState((prev) => {
      if (prev.phase !== 'player') {
        return prev
      }

      const cardId = prev.player.hand[handIndex]
      if (!cardId) {
        return prev
      }

      const card = CARDS[cardId]
      if (card.cost > prev.player.energy) {
        return prev
      }

      const nextHand = [...prev.player.hand]
      nextHand.splice(handIndex, 1)

      let player: Player = {
        ...prev.player,
        energy: prev.player.energy - card.cost,
        hand: nextHand,
        discardPile: [...prev.player.discardPile, cardId],
      }
      let enemy: Enemy = { ...prev.enemy }
      const log = [...prev.log]

      if (card.id === 'strike') {
        const damage = applyVulnerable(6, enemy)
        const result = dealDamage(enemy, damage)
        enemy = { ...enemy, ...result.target }
        log.push(`红裤衩使用打击，造成 ${result.hpLoss} 点伤害。`)
      }

      if (card.id === 'defend') {
        player = { ...player, block: player.block + 5 }
        log.push('红裤衩使用防御，获得 5 点护甲。')
      }

      if (card.id === 'bash') {
        const damage = applyVulnerable(8, enemy)
        const result = dealDamage(enemy, damage)
        enemy = {
          ...enemy,
          ...result.target,
          vulnerable: result.target.vulnerable + 2,
        }
        log.push(`红裤衩使用重击，造成 ${result.hpLoss} 点伤害并施加 2 层易伤。`)
      }

      if (enemy.hp <= 0) {
        log.push('邪教徒被击败。')
        return { ...prev, player, enemy, log, phase: 'won' }
      }

      return { ...prev, player, enemy, log }
    })
  }

  const endTurn = () => {
    setState((prev) => {
      if (prev.phase !== 'player') {
        return prev
      }

      const log = [...prev.log]
      const handToDiscard = [...prev.player.hand]
      let player: Player = {
        ...prev.player,
        hand: [],
        discardPile: [...prev.player.discardPile, ...handToDiscard],
        vulnerable: Math.max(prev.player.vulnerable - 1, 0),
      }

      let enemy: Enemy = {
        ...prev.enemy,
        block: 0,
      }

      const intent = enemy.intent
      log.push(`邪教徒意图：${intent.label}`)

      if (intent.id === 'chant') {
        enemy = {
          ...enemy,
          strength: enemy.strength + intent.strength,
        }
        log.push(`邪教徒吟唱，获得 ${intent.strength} 点力量。`)
      }

      if (intent.id === 'ritual_attack') {
        const damage = applyVulnerable(intent.attack + enemy.strength, player)
        const result = dealDamage(player, damage)
        player = { ...player, ...result.target }
        log.push(`邪教徒斩击，造成 ${result.hpLoss} 点伤害。`)
      }

      enemy = { ...enemy, vulnerable: Math.max(enemy.vulnerable - 1, 0) }

      if (player.hp <= 0) {
        log.push('红裤衩倒下了。')
        return { ...prev, player, enemy, log, phase: 'lost' }
      }

      const nextIntentIndex = (enemy.intentIndex + 1) % INTENT_ROTATION.length
      enemy = {
        ...enemy,
        intentIndex: nextIntentIndex,
        intent: INTENT_ROTATION[nextIntentIndex],
      }

      player = drawCards(
        {
          ...player,
          block: 0,
          energy: 3,
        },
        5,
      )

      log.push(`进入第 ${prev.turn + 1} 回合。`)

      return {
        ...prev,
        turn: prev.turn + 1,
        player,
        enemy,
        log,
      }
    })
  }

  const pileCards = useMemo(() => {
    if (!openedPile) {
      return []
    }
    if (openedPile === 'draw') {
      return [...state.player.drawPile].reverse()
    }
    if (openedPile === 'discard') {
      return [...state.player.discardPile].reverse()
    }
    return [...state.player.exhaustPile].reverse()
  }, [openedPile, state.player.discardPile, state.player.drawPile, state.player.exhaustPile])

  return (
    <main className="battle-page">
      <header className="topbar">
        <div className="top-left">
          <RelicBurningBlood />
        </div>
        <div className="top-right">
          <div className="status">{statusText}</div>
          <button
            className="secondary"
            onClick={() => {
              setState(createInitialState())
              setOpenedPile(null)
            }}
          >
            重新开始
          </button>
        </div>
      </header>

      <section className="arena">
        <article className="fighter-card left">
          <FighterIronclad />
          <h2>红裤衩</h2>
          <BuffSlots
            title="Buff 槽"
            buffs={[
              { label: '力量', value: 0 },
              { label: '易伤', value: state.player.vulnerable },
            ]}
          />
          <HpBlockBar hp={state.player.hp} maxHp={state.player.maxHp} block={state.player.block} />
        </article>

        <article className="fighter-card right">
          <FighterCultist />
          <h2>{state.enemy.name}</h2>
          <p className="intent">意图: {state.enemy.intent.label}</p>
          <BuffSlots
            title="Buff 槽"
            rightAlign
            buffs={[
              { label: '力量', value: state.enemy.strength },
              { label: '易伤', value: state.enemy.vulnerable },
            ]}
          />
          <HpBlockBar hp={state.enemy.hp} maxHp={state.enemy.maxHp} block={state.enemy.block} />
        </article>
      </section>

      <section className="hud-row">
        <aside className="side-modules">
          <button
            className="module module-button"
            disabled={state.player.drawPile.length === 0}
            onClick={() => setOpenedPile('draw')}
          >
            <h3>抽牌堆</h3>
            <p>{state.player.drawPile.length}</p>
          </button>
          <div className="module">
            <h3>费用</h3>
            <p>{state.player.energy}</p>
          </div>
        </aside>

        <section className="center-play">
          <div className="hand-area">
            {state.player.hand.map((cardId, index) => {
              const card = CARDS[cardId]
              const disabled = state.phase !== 'player' || state.player.energy < card.cost
              return (
                <button
                  key={`${card.id}-${index}`}
                  className="card"
                  disabled={disabled}
                  onClick={() => playCard(index)}
                >
                  <strong>{card.name}</strong>
                  <span>费用: {card.cost}</span>
                  <small>{card.description}</small>
                </button>
              )
            })}
          </div>
          <div className="actions">
            <button className="primary" onClick={endTurn} disabled={state.phase !== 'player'}>
              结束回合
            </button>
          </div>
        </section>

        <aside className="side-modules">
          <button
            className="module module-button"
            disabled={state.player.discardPile.length === 0}
            onClick={() => setOpenedPile('discard')}
          >
            <h3>弃牌堆</h3>
            <p>{state.player.discardPile.length}</p>
          </button>
          <button
            className="module module-button"
            disabled={state.player.exhaustPile.length === 0}
            onClick={() => setOpenedPile('exhaust')}
          >
            <h3>消耗牌堆</h3>
            <p>{state.player.exhaustPile.length}</p>
          </button>
        </aside>
      </section>

      {openedPile && (
        <section className="modal-backdrop" onClick={() => setOpenedPile(null)}>
          <div className="pile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="pile-preview-header">
              <h3>{PILE_LABEL[openedPile]}内容</h3>
              <button className="secondary" onClick={() => setOpenedPile(null)}>
                关闭
              </button>
            </div>
            {pileCards.length > 0 ? (
              <ul>
                {pileCards.map((cardId, index) => (
                  <li key={`${cardId}-${index}`}>
                    {index + 1}. {CARDS[cardId].name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>当前为空。</p>
            )}
          </div>
        </section>
      )}

      <section className="log">
        <h3>战斗日志</h3>
        <ul>
          {[...state.log].slice(-8).reverse().map((entry, i) => (
            <li key={`${entry}-${i}`}>{entry}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
