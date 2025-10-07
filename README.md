# Jira MCP Server v2.0.0

Um servidor MCP (Model Context Protocol) completo para integração com Jira, permitindo que assistentes de IA interajam com sua instância do Jira.

## 🚀 Instalação

### Via npx (Recomendado)

```bash
npx @guhcostan/jira-mcp
```

### Via npm global

```bash
npm install -g @guhcostan/jira-mcp
jira-mcp
```

### Desenvolvimento local

```bash
git clone https://github.com/guhcostan/jira-mcp.git
cd jira-mcp
npm install
npm run build
```

## 🔧 Configuração

### 1. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
JIRA_URL=https://your-jira-instance.com
JIRA_API_TOKEN=your-bearer-token-here
```

**Nota**: Este servidor usa **Bearer Token** (Jira Data Center/Server). Para Jira Cloud, você pode precisar usar Basic Auth.

### 2. Configure no Claude Desktop ou Cursor

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@guhcostan/jira-mcp"],
      "env": {
        "JIRA_URL": "https://your-jira-instance.com",
        "JIRA_API_TOKEN": "your-bearer-token-here"
      }
    }
  }
}
```

**Para desenvolvimento local**, use:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/your/jira-mcp/build/index.js"],
      "env": {
        "JIRA_URL": "https://your-jira-instance.com",
        "JIRA_API_TOKEN": "your-bearer-token-here"
      }
    }
  }
}
```

### 3. Reinicie o Claude Desktop / Cursor

Feche e reabra completamente o aplicativo para carregar o servidor MCP.

## 📚 Recursos

Este servidor MCP fornece **32 ferramentas** para interagir com o Jira:

### 📖 Operações de Leitura (17 tools)

#### Issues
- `jira_get_issue` - Obter detalhes de uma issue
- `jira_search` - Buscar issues com JQL
- `jira_get_project_issues` - Issues de um projeto
- `jira_batch_get_changelogs` - Changelogs em batch
- `jira_download_attachments` - Info de anexos

#### Projetos
- `jira_get_all_projects` - Listar todos os projetos
- `jira_get_project` - Detalhes de um projeto
- `jira_get_project_versions` - Versões do projeto

#### Outros
- `jira_get_worklog` - Worklogs de uma issue
- `jira_get_transitions` - Transições disponíveis
- `jira_search_fields` - Buscar campos do Jira
- `jira_get_agile_boards` - Listar boards ágeis
- `jira_get_board_issues` - Issues de um board
- `jira_get_sprints_from_board` - Sprints de um board
- `jira_get_sprint_issues` - Issues de um sprint
- `jira_get_issue_link_types` - Tipos de links
- `jira_get_user_profile` - Informações de usuário

### ✏️ Operações de Escrita (15 tools)

#### Issues
- `jira_create_issue` - Criar issue
- `jira_batch_create_issues` - Criar múltiplas issues
- `jira_update_issue` - Atualizar issue
- `jira_delete_issue` - Deletar issue
- `jira_assign_issue` - Atribuir issue

#### Outros
- `jira_add_comment` - Adicionar comentário
- `jira_transition_issue` - Mudar status
- `jira_add_worklog` - Adicionar worklog
- `jira_link_to_epic` - Vincular a épico
- `jira_create_sprint` - Criar sprint
- `jira_update_sprint` - Atualizar sprint
- `jira_create_issue_link` - Criar link entre issues
- `jira_remove_issue_link` - Remover link
- `jira_create_version` - Criar versão
- `jira_batch_create_versions` - Criar múltiplas versões

## 💡 Exemplos de Uso

### Buscar Issues

```javascript
// No Claude/Cursor, basta perguntar:
"Busque as últimas 10 issues abertas do projeto ABC"
"Quais são os bugs críticos do sprint atual?"
```

### Criar Issue

```javascript
"Crie uma issue do tipo Task no projeto XYZ com título 'Implementar autenticação'"
```

### Gerenciar Sprint

```javascript
"Liste todos os sprints ativos do board 123"
"Mova a issue ABC-456 para o sprint 789"
```

### JQL Avançado

```javascript
"Busque issues com JQL: project = DEV AND status = 'In Progress' AND assignee = currentUser()"
```

## 🔍 Referência de Ferramentas

### jira_get_issue
Obter detalhes de uma issue específica.

**Parâmetros:**
- `issueKey` (required): A chave da issue (ex: PROJ-123)
- `fields` (optional): Campos a retornar (ex: "summary,status,assignee")
- `expand` (optional): Expandir campos (ex: "changelog,renderedFields")

### jira_search
Buscar issues usando JQL.

**Parâmetros:**
- `jql` (required): Query JQL (ex: "project = PROJ AND status = Open")
- `maxResults` (optional): Número máximo de resultados (default: 50)
- `startAt` (optional): Índice inicial para paginação (default: 0)
- `fields` (optional): Campos a retornar

### jira_create_issue
Criar uma nova issue.

**Parâmetros:**
- `project` (required): Chave do projeto
- `summary` (required): Título da issue
- `issueType` (required): Tipo (Task, Bug, Story, etc)
- `description` (optional): Descrição
- `priority` (optional): Prioridade (High, Medium, Low)
- `assignee` (optional): Account ID do responsável
- `labels` (optional): Array de labels
- `parentKey` (optional): Chave da issue pai (para subtasks)

### jira_transition_issue
Transicionar uma issue para outro status.

**Parâmetros:**
- `issueKey` (required): Chave da issue
- `transition` (required): Nome ou ID da transição

### jira_create_sprint
Criar um novo sprint.

**Parâmetros:**
- `boardId` (required): ID do board
- `name` (required): Nome do sprint
- `startDate` (optional): Data de início (ISO 8601)
- `endDate` (optional): Data de fim (ISO 8601)
- `goal` (optional): Objetivo do sprint

## 🔐 Autenticação

### Jira Data Center/Server (Bearer Token)

Este servidor usa Bearer Token por padrão, ideal para instâncias Jira Data Center/Server:

```
Authorization: Bearer YOUR_TOKEN
```

### Jira Cloud (Basic Auth)

Se você usa Jira Cloud, pode precisar modificar a autenticação para Basic Auth no código.

### Como obter um API Token

1. Acesse as configurações de segurança da sua conta Jira
2. Gere um novo API token
3. Use o token no arquivo `.env`

## 🛠️ Desenvolvimento

### Estrutura do Projeto

```
jira-mcp/
├── src/
│   └── index.ts          # Servidor MCP principal
├── build/                # Arquivos compilados
├── package.json
├── tsconfig.json
├── .env                  # Credenciais (não fazer commit!)
├── .gitignore
└── README.md
```

### Scripts Disponíveis

```bash
npm run build          # Compilar TypeScript
npm run watch          # Compilar em modo watch
npm run prepare        # Executado automaticamente no npm install
```

### Testar Localmente

```bash
# Compilar
npm run build

# Executar diretamente
node build/index.js
```

## 📝 Notas Importantes

- ✅ Suporta Jira Data Center/Server com Bearer Token
- ✅ 32 ferramentas completas (17 leitura + 15 escrita)
- ✅ Suporte a JQL para buscas avançadas
- ✅ Operações em batch para melhor performance
- ⚠️ Requer permissões adequadas no Jira para cada operação
- ⚠️ Rate limiting é aplicado pelo Jira

## 🐛 Solução de Problemas

### Erro 401 - Unauthorized

- Verifique se o token está correto
- Confirme se está usando Bearer Token (não Basic Auth)
- Verifique se o token não expirou

### O servidor não aparece no Claude/Cursor

1. Verifique se o caminho no config está correto
2. Reinicie completamente o aplicativo
3. Verifique os logs do Claude/Cursor

### Erros de permissão

- Confirme que sua conta tem permissões para a operação
- Verifique as permissões do projeto

## 📄 Licença

MIT

## 👤 Autor

Gustavo Neves

## 🔗 Links

- GitHub: https://github.com/guhcostan/jira-mcp
- npm: https://www.npmjs.com/package/@guhcostan/jira-mcp
- Issues: https://github.com/guhcostan/jira-mcp/issues

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request
