// src/components/Calendar/CalendarView.jsx
import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { AnimatePresence } from 'framer-motion'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import CalendarFilters from './CalendarFilters'

const ALL_TYPES = ['task', 'activity', 'receivable', 'transaction']

export default function CalendarView({
  filterTypes,      // undefined = unified view; ['task'] = tasks only
  tasks = [],
  clients = [],
  team = [],
  columns = [],
  onUpdateTask,     // (id, updates) => void — from App.jsx
  onAddTask,        // (form) => void — from App.jsx
}) {
  const [activeTypes, setActiveTypes] = useState(filterTypes ?? ALL_TYPES)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { events, loading } = useCalendarEvents({
    tasks,
    types: filterTypes ?? activeTypes,
  })

  const fcEvents = events.map(ev => ({
    id: ev.id,
    title: ev.title,
    date: ev.date,
    backgroundColor: ev.color,
    borderColor: ev.color,
    extendedProps: { calendarEvent: ev },
  }))

  const handleEventClick = ({ event }) => {
    setSelectedEvent(event.extendedProps.calendarEvent)
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      {!filterTypes && (
        <CalendarFilters active={activeTypes} onChange={setActiveTypes} />
      )}

      {loading && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Carregando eventos...</p>
      )}

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        locale={ptBrLocale}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth',
        }}
        events={fcEvents}
        eventClick={handleEventClick}
        height="auto"
        editable={false}
      />

      {/* EventDetailPanel — wired in Task 6 */}
      <AnimatePresence>
        {selectedEvent && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: 'var(--card-bg)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
            }}
          >
            <strong>{selectedEvent.title}</strong>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {selectedEvent.type} · {selectedEvent.date}
            </p>
            <button
              style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setSelectedEvent(null)}
            >
              Fechar
            </button>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
