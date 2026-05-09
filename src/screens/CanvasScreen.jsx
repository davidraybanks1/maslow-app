import { useState } from 'react'
import Canvas from '../components/Canvas'
import { LAYERS, LAYER_ORDER } from '../lib/constants'
import styles from './CanvasScreen.module.css'

export default function CanvasScreen({ state, updateCanvas }) {
  const [tradeState, setTradeState] = useState(null)

  function handleChangeMode(needId, newMode, canFit) {
    if (canFit) {
      updateCanvas(needId, newMode)
    } else {
      setTradeState({ needId, newMode })
    }
  }

  function completeTrade(tradeId) {
    if (!tradeState) return
    const curIdx = LAYER_ORDER.indexOf(state.canvas[tradeId])
    updateCanvas(tradeId, LAYER_ORDER[curIdx - 1])
    updateCanvas(tradeState.needId, tradeState.newMode)
    setTradeState(null)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>your maslow</div>
          <div className={styles.sub}>
            {tradeState
              ? 'tap a need to drop it a mode and make room'
              : 'tap ▾ on any need to change its mode'}
          </div>
        </div>
      </div>

      <div className={styles.canvasWrap}>
        <Canvas
          canvas={state.canvas}
          onChangeMode={handleChangeMode}
        />
      </div>

      {tradeState && (
        <div className={styles.tradeOverlay}>
          <div className={styles.tradeCard}>
            <div className={styles.tradeTitle}>make room</div>
            <div className={styles.tradeSub}>
              Upgrading to <strong>{tradeState.newMode}</strong> needs space. Tap a need to drop it one mode.
            </div>
            <div className={styles.tradeNeeds}>
              {Object.entries(state.canvas)
                .filter(([id, mode]) => id !== tradeState.needId && LAYER_ORDER.indexOf(mode) > 0)
                .map(([id, mode]) => {
                  const lyr = LAYERS[mode]
                  return (
                    <div
                      key={id}
                      className={styles.tradeNeed}
                      onClick={() => completeTrade(id)}
                      style={{ borderColor: lyr.border }}
                    >
                      <div className={styles.tradeNeedPip} style={{ background: lyr.pip }} />
                      <span style={{ color: lyr.text }}>{id}</span>
                      <span className={styles.tradeNeedMode}>{mode}</span>
                    </div>
                  )
                })}
            </div>
            <button className="btn-ghost" onClick={() => setTradeState(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}