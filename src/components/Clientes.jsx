const clients = [
  { id: 1, name: 'SAO Design Co.', contact: 'contato@saodesign.com', project: 'Projeto Design Web SAO', status: 'Ativo' },
  { id: 2, name: 'TechBrasil Ltda.', contact: 'ti@techbrasil.com.br', project: 'Sistema E-commerce', status: 'Em negociação' },
]

const Clientes = () => (
  <div className="clients-view">
    <h3 className="section-title">Clientes</h3>
    <div className="clients-grid">
      {clients.map(client => (
        <div key={client.id} className="client-card">
          <div className="client-header">
            <div className="client-avatar">{client.name[0]}</div>
            <div>
              <h4>{client.name}</h4>
              <span className="client-contact">{client.contact}</span>
            </div>
            <span className={`status-badge ${client.status === 'Ativo' ? 'done' : 'progress'}`}>
              {client.status}
            </span>
          </div>
          <div className="client-project">
            <span>Projeto: {client.project}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default Clientes
