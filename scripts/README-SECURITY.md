# Security Audit Suite 🔒

Este diretório contém ferramentas para auditar a segurança e o isolamento multi-tenant do sistema SaaS.

## `security-audit.js`

Este script simula um ataque interno onde um usuário tenta acessar dados de outra organização.

### O que ele testa:
1.  **Leitura Cruzada:** Usuário da Org A tentando ler contatos da Org B.
2.  **Injeção de Dados:** Usuário da Org A tentando inserir dados na Org B.
3.  **Movimentação de Dados:** Usuário da Org A tentando alterar o `organization_id` de um registro.
4.  **Escopo Padrão:** Verificar se `select(*)` retorna apenas dados locais.
5.  **Acesso Público:** Verificar se usuários não autenticados (Anon) são bloqueados.

### Como rodar:

```bash
# Requer .env com VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
node scripts/security-audit.js
```

### Resultados:
- **Verde (PASS):** O sistema bloqueou a ação não autorizada.
- **Vermelho (FAIL):** O sistema PERMITIU uma ação indevida (Vazamento de dados).

---

## Integração CI/CD

Este teste deve rodar a cada Pull Request ou Deploy em produção. Se falhar, o deploy deve ser cancelado imediatamente.

Veja `.github/workflows/security-audit.yml` para a configuração.
