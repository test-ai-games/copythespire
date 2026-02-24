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
}

type EnemyIntent =
  | { id: 'chomp'; label: string; attack: number }
  | { id: 'bellow'; label: string; block: number; strength: number }
  | { id: 'thrash'; label: string; attack: number; block: number }

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
  defend: { id: 'defend', name: '防御', cost: 1, description: '获得 5 点格挡。' },
  bash: { id: 'bash', name: '重击', cost: 2, description: '造成 8 点伤害，施加 2 层易伤。' },
}

const INTENT_ROTATION: EnemyIntent[] = [
  { id: 'chomp', label: '啃咬', attack: 11 },
  { id: 'bellow', label: '怒吼', block: 6, strength: 2 },
  { id: 'thrash', label: '拍击', attack: 7, block: 5 },
]

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
  }

  return {
    turn: 1,
    phase: 'player',
    player: drawCards(playerBase, 5),
    enemy: {
      name: '咔咔',
      hp: 42,
      maxHp: 42,
      block: 0,
      vulnerable: 0,
      strength: 0,
      intentIndex: 0,
      intent: INTENT_ROTATION[0],
    },
    log: ['战斗开始：红裤衩 vs 咔咔'],
  }
}

function App() {
  const [state, setState] = useState<BattleState>(() => createInitialState())

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
        log.push('红裤衩使用防御，获得 5 点格挡。')
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
        log.push('咔咔被击败。')
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
      log.push(`咔咔意图：${intent.label}`)

      if (intent.id === 'chomp') {
        const damage = applyVulnerable(intent.attack + enemy.strength, player)
        const result = dealDamage(player, damage)
        player = { ...player, ...result.target }
        log.push(`咔咔啃咬，造成 ${result.hpLoss} 点伤害。`)
      }

      if (intent.id === 'bellow') {
        enemy = {
          ...enemy,
          block: enemy.block + intent.block,
          strength: enemy.strength + intent.strength,
        }
        log.push(`咔咔怒吼，获得 ${intent.block} 格挡和 ${intent.strength} 力量。`)
      }

      if (intent.id === 'thrash') {
        const damage = applyVulnerable(intent.attack + enemy.strength, player)
        const result = dealDamage(player, damage)
        player = { ...player, ...result.target }
        enemy = { ...enemy, block: enemy.block + intent.block }
        log.push(`咔咔拍击，造成 ${result.hpLoss} 点伤害并获得 ${intent.block} 格挡。`)
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

  return (
    <main className="battle-page">
      <header className="topbar">
        <h1>CopyTheSpire - 战斗原型</h1>
        <div className="status">{statusText}</div>
        <button className="secondary" onClick={() => setState(createInitialState())}>
          重新开始
        </button>
      </header>

      <section className="arena">
        <article className="panel enemy">
          <h2>{state.enemy.name}</h2>
          <p>HP: {state.enemy.hp}/{state.enemy.maxHp}</p>
          <p>格挡: {state.enemy.block}</p>
          <p>力量: {state.enemy.strength}</p>
          <p>易伤: {state.enemy.vulnerable}</p>
          <p className="intent">意图: {state.enemy.intent.label}</p>
        </article>

        <article className="panel player">
          <h2>红裤衩</h2>
          <p>HP: {state.player.hp}/{state.player.maxHp}</p>
          <p>格挡: {state.player.block}</p>
          <p>能量: {state.player.energy}</p>
          <p>易伤: {state.player.vulnerable}</p>
          <p>
            牌堆: 抽牌堆 {state.player.drawPile.length} / 弃牌堆 {state.player.discardPile.length}
          </p>
        </article>
      </section>

      <section className="hand-area">
        {state.player.hand.map((cardId, index) => {
          const card = CARDS[cardId]
          const disabled = state.phase !== 'player' || state.player.energy < card.cost
          return (
            <button key={`${card.id}-${index}`} className="card" disabled={disabled} onClick={() => playCard(index)}>
              <strong>{card.name}</strong>
              <span>费用: {card.cost}</span>
              <small>{card.description}</small>
            </button>
          )
        })}
      </section>

      <section className="actions">
        <button className="primary" onClick={endTurn} disabled={state.phase !== 'player'}>
          结束回合
        </button>
      </section>

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
