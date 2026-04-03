# Import Specification

## Formatos aceitos
- XLSX
- CSV

## Pipeline
1. leitura bruta
2. mapeamento de colunas
3. normalização
4. validação
5. transformação em entidades
6. persistência
7. recálculo
8. renderização

## Colunas mínimas
- id
- task
- duration
- start
- finish
- progress
- predecessors

## Estratégias de hierarquia
- WBS visual
- parentId explícito
- nível estrutural

## Regras
- datas devem virar ISO
- duração em dias úteis
- progresso entre 0 e 100
- predecessoras com FS, SS, FF, SF
- não aceitar ciclos
