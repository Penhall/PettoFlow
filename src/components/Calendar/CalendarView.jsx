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
import EventDetailPanel from './EventDetailPanel'
import { useActivities } from '../../hooks/useActivities'
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'
import { useFinRules } from '../../hooks/useFinRules'
import { useAccounts } from '../../hooks/useAccounts'
import { getPrincipalAccount } from '../../lib/financeUtils'
import ActivityForm from '../Activities/ActivityForm'

const ALL_TYPES = ['task', 'activity', 'receivable', 'transaction']
const EMPTY_FILTERS = {}

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
  const [dateClickDate, setDateClickDate] = useState(null)

  const { addActivity, updateActivity } = useActivities()
  const { invoiceReceivable, createReceivableFromActivity } = useReceivables()
  const { rules } = useFinRules()
  const { addTransaction } = useTransactions(EMPTY_FILTERS, rules)
  const { accounts } = useAccounts()
  const principalAccount = getPrincipalAccount(accounts)

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
        dateClick={({ dateStr }) => setDateClickDate(dateStr)}
        height="auto"
        editable={false}
      />

      {/* EventDetailPanel */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            clients={clients}
            tasks={tasks}
            team={team}
            columns={columns}
            onUpdateTask={onUpdateTask}
            onUpdateActivity={updateActivity}
            onInvoice={(id, amount, date) => invoiceReceivable(id, amount, date, addTransaction)}
            onAddActivity={addActivity}
            onAddTask={onAddTask}
            createReceivableFromActivity={createReceivableFromActivity}
            principalAccountId={principalAccount?.id ?? null}
          />
        )}
      </AnimatePresence>

      {/* Date click → new activity */}
      <AnimatePresence>
        {dateClickDate && (
          <ActivityForm
            activity={{ scheduled_at: dateClickDate + 'T09:00' }}
            clients={clients}
            tasks={tasks}
            team={team}
            templates={[]}
            onSave={async (form) => {
              await addActivity(form)
              setDateClickDate(null)
            }}
            onClose={() => setDateClickDate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
