import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import FullCalendar from '@fullcalendar/react'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useAccounts } from '../../hooks/useAccounts'
import { useActivities } from '../../hooks/useActivities'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useFinRules } from '../../hooks/useFinRules'
import { useReceivables } from '../../hooks/useReceivables'
import { useTransactions } from '../../hooks/useTransactions'
import { getPrincipalAccount } from '../../lib/financeUtils'
import ActivityForm from '../Activities/ActivityForm'
import CalendarFilters from './CalendarFilters'
import EventDetailPanel from './EventDetailPanel'

const ALL_TYPES = ['task', 'activity', 'receivable', 'transaction']
const EMPTY_FILTERS = {}

export default function CalendarView({
  filterTypes,
  tasks = [],
  clients = [],
  team = [],
  columns = [],
  onUpdateTask,
  onAddTask,
  onEmptyDateClick,
  contextArea,
  activeTypes: controlledActiveTypes,
  onActiveTypesChange,
  showFilters,
}) {
  const [internalActiveTypes, setInternalActiveTypes] = useState(filterTypes ?? ALL_TYPES)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [dateClickDate, setDateClickDate] = useState(null)

  const activeTypes = controlledActiveTypes ?? internalActiveTypes
  const setActiveTypes = onActiveTypesChange ?? setInternalActiveTypes
  const shouldShowFilters = showFilters ?? !filterTypes

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

  const fcEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: { calendarEvent: event },
  }))

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const calendarProps = isMobile
    ? {
        initialView: 'listMonth',
        headerToolbar: {
          left: 'prev,next',
          center: 'title',
          right: 'today',
        },
      }
    : {
        initialView: 'dayGridMonth',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listMonth',
        },
      }

  return (
    <div className="calendar-view-wrapper">
      {shouldShowFilters ? (
        <CalendarFilters active={activeTypes} onChange={setActiveTypes} />
      ) : null}

      {loading ? <p className="calendar-view-wrapper__loading">Carregando eventos...</p> : null}

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        locale={ptBrLocale}
        {...calendarProps}
        events={fcEvents}
        eventClick={({ event }) => setSelectedEvent(event.extendedProps.calendarEvent)}
        dateClick={({ dateStr }) => {
          if (onEmptyDateClick) {
            onEmptyDateClick(dateStr)
            return
          }

          setDateClickDate(dateStr)
        }}
        height="auto"
        editable={false}
      />

      <AnimatePresence>
        {selectedEvent ? (
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
            contextArea={contextArea}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dateClickDate ? (
          <ActivityForm
            activity={{ scheduled_at: `${dateClickDate}T09:00` }}
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
        ) : null}
      </AnimatePresence>
    </div>
  )
}
