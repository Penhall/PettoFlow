import { Mail, Phone } from 'lucide-react'

const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }

const TimeView = ({ tasks, team }) => {
  const members = (team || []).map(member => {
    const memberTasks = tasks.filter(t => t.owner === member.name)
    const done = memberTasks.filter(t => t.status === 'Concluído').length
    const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2)
    return { ...member, initials, memberTasks, done }
  })

  return (
    <div className="team-view">
      <h3 className="section-title">Membros do Time</h3>
      <div className="team-grid">
        {members.map(({ name, initials, memberTasks, done }) => (
          <div key={name} className="member-card">
            <div className="member-header">
              <div className="avatar">{initials}</div>
              <div className="member-info">
                <h3>{name}</h3>
                <span className="role">{memberTasks.length} tarefa{memberTasks.length !== 1 ? 's' : ''} · {done} concluída{done !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="member-actions">
              <button className="action-icon-btn"><Mail size={16} /></button>
              <button className="action-icon-btn"><Phone size={16} /></button>
            </div>
            <div className="member-tasks">
              {memberTasks.map(t => (
                <div key={t.id} className="member-task-row">
                  <span>{t.title}</span>
                  <span className={`status-badge ${STATUS_CLASS[t.status]}`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TimeView
