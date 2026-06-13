import { useStore, type View } from './store'
import BodyView from './components/BodyView'
import StatsView from './components/StatsView'
import SettingsView from './components/SettingsView'

const TABS: { key: View; label: string; icon: string }[] = [
  { key: 'body', label: '身体', icon: '🧍' },
  { key: 'stats', label: '统计', icon: '📊' },
  { key: 'settings', label: '设置', icon: '⚙️' },
]

export default function App() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  return (
    <div className="app">
      <div className="content">
        {view === 'body' && <BodyView />}
        {view === 'stats' && <StatsView />}
        {view === 'settings' && <SettingsView />}
      </div>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={view === t.key ? 'tab active' : 'tab'}
            onClick={() => setView(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
