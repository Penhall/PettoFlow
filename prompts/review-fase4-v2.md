Revisão final das correções da Fase 4 — Notificações (PettoFlow/NexusCRM).

Valide se as correções abaixo foram aplicadas corretamente no diff (git diff HEAD):

#1: useNotifications sem polling/Realtime — polling centralizado em App.jsx
#2: NotificationBell e ReminderToast recebem props em vez de chamar hook
#3: bot_config filtrado por tenant no worker
#4: CSS dropdown consertado (flex layout, sem overflow hidden)
#5: Worker com CRON_SECRET auth
#6: ON CONFLICT DO NOTHING na inserção de notificações
#7: UNIQUE constraint na migration
#8: Índice correto para query do worker
#9: Batch memberships query (N+1 eliminado)
#10: Escape key fecha dropdown
#11: Click em notificação fecha dropdown
#12: aria-haspopup adicionado
#13: Cor badge usa var(--color-badge)

Aponte se alguma correção ficou incompleta ou introduziu novo problema.
