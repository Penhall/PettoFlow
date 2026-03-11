const STATUS_CLASS = { 'A Fazer': 'todo', 'Em Progresso': 'progress', 'Concluído': 'done' }

const Time = ({ tasks }) => {
  const members = [...new Set(tasks.map(t => t.owner).filter(Boolean))]

  return (
    <div className="team-view">
      <h3 className="section-title">Membros do Time</h3>
      <div className="team-grid">
        {members.map(member => {
          const memberTasks = tasks.filter(t => t.owner === member)
          const done = memberTasks.filter(t => t.status === 'Concluído').length
          const initials = member.split(' ').map(n => n[0]).join('').slice(0, 2)

          return (
            <div key={member} className="member-card">
              <div className="member-avatar">{initials}</div>
              <div className="member-info">
                <h4>{member}</h4>
                <span>{memberTasks.length} tarefa{memberTasks.length !== 1 ? 's' : ''} · {done} concluída{done !== 1 ? 's' : ''}</span>
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
          )
        })}
      </div>
    </div>
  )
}

export default Time
