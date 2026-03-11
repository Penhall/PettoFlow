import { Building2, ExternalLink } from 'lucide-react'

const clients = [
  { id: 1, name: 'SAO Design Co.', industry: 'Design & Branding', projects: 3, revenue: 'R$ 24.000', status: 'Ativo' },
  { id: 2, name: 'TechBrasil Ltda.', industry: 'Tecnologia', projects: 1, revenue: 'R$ 8.500', status: 'Em negociação' },
  { id: 3, name: 'Marca Viva', industry: 'Marketing Digital', projects: 2, revenue: 'R$ 15.000', status: 'Ativo' },
]

const ClientesView = () => (
  <div className="clients-view">
    <h3 className="section-title">Clientes</h3>
    <div className="clients-list">
      {clients.map(client => (
        <div key={client.id} className="client-item">
          <div className="client-icon">
            <Building2 size={24} />
          </div>
          <div className="client-main">
            <h3>{client.name}</h3>
            <span>{client.industry}</span>
          </div>
          <div className="client-stats">
            <div className="stat">
              <span className="label">Projetos</span>
              <span className="value">{client.projects}</span>
            </div>
            <div className="stat">
              <span className="label">Receita</span>
              <span className="value">{client.revenue}</span>
            </div>
          </div>
          <div className="client-actions">
            <span className={`status-badge ${client.status === 'Ativo' ? 'done' : 'progress'}`}>
              {client.status}
            </span>
            <button className="icon-link"><ExternalLink size={18} /></button>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default ClientesView
