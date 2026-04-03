# Data Model

## Entidades principais

### Project
- id
- name
- description
- timezone
- currency
- startDate
- endDate
- calendarId
- defaultZoom

### Task
- id
- projectId
- wbsCode
- name
- type
- parentId
- orderIndex
- startDate
- endDate
- durationDays
- progressPercent
- isCritical
- calendarId
- notes
- cost

### Dependency
- id
- projectId
- sourceTaskId
- targetTaskId
- type
- lagDays

### Calendar
- id
- projectId
- name
- countryCode
- workingWeekdays
- hoursPerDay
- isDefault

### Holiday
- id
- calendarId
- name
- date
- scope
- locationCode
- recurring

### Baseline
- id
- projectId
- name
- createdAt

## Regras
- WBS visual nunca é o ID interno real
- dependências apontam para IDs internos
- hierarquia usa parentId e orderIndex
- summaries agregam filhos
- calendário afeta cálculo de datas
